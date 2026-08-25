import secrets
import time
from typing import Dict
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import create_access_token
from app.db.session import get_db, SessionLocal
from app.models.user import User
from app.schemas.auth import (
    ProvidersResponse,
    UpdateProfileRequest,
    UserProfile,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# Google is the ONLY authentication method: every account is a real,
# Google-verified Gmail/Workspace address.

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

# In-memory OAuth state store (single-process deployments).
_oauth_states: Dict[str, float] = {}
_OAUTH_STATE_TTL = 600.0


def _prune_oauth_states() -> None:
    now = time.monotonic()
    for state in [s for s, t in _oauth_states.items() if now - t > _OAUTH_STATE_TTL]:
        _oauth_states.pop(state, None)


def _backend_public_base(request: Request) -> str:
    configured = settings.backend_origin.strip().rstrip("/")
    if configured:
        return configured
    return str(request.base_url).rstrip("/")


def _redirect_uri(request: Request) -> str:
    # Backend routes are mounted at the root (the /api prefix is stripped
    # by the Vite/nginx proxies), so callbacks go straight to the API host.
    return _backend_public_base(request) + "/auth/google/callback"


@router.get("/providers", response_model=ProvidersResponse)
def providers() -> ProvidersResponse:
    return ProvidersResponse(
        google=bool(settings.google_client_id and settings.google_client_secret)
    )


@router.get("/google")
def google_start(request: Request):
    if not (settings.google_client_id and settings.google_client_secret):
        raise HTTPException(
            status_code=404,
            detail="Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        )
    state = secrets.token_urlsafe(32)
    _prune_oauth_states()
    _oauth_states[state] = time.monotonic()
    params = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": _redirect_uri(request),
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "prompt": "select_account",
        }
    )
    return RedirectResponse(f"{_GOOGLE_AUTH_URL}?{params}", status_code=302)


@router.get("/google/callback")
def google_callback(code: str, state: str, request: Request) -> RedirectResponse:
    frontend = settings.primary_frontend_origin
    created_at = _oauth_states.pop(state, None)

    def fail(reason: str) -> RedirectResponse:
        return RedirectResponse(f"{frontend}/login?error={reason}", status_code=302)

    if created_at is None or time.monotonic() - created_at > _OAUTH_STATE_TTL:
        return fail("expired_state")

    try:
        token_res = httpx.post(
            _GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": _redirect_uri(request),
                "grant_type": "authorization_code",
            },
            timeout=15,
        )
        access_google_token = token_res.json().get("access_token")
        if token_res.status_code != 200 or not access_google_token:
            return fail("token_exchange_failed")

        info_res = httpx.get(
            _GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_google_token}"},
            timeout=15,
        )
        info = info_res.json()
        email = str(info.get("email", "")).lower()
        # Only accounts Google itself has verified may sign in.
        if info_res.status_code != 200 or not email or not info.get("email_verified"):
            return fail("unverified_google_email")
    except (httpx.HTTPError, ValueError):
        return fail("google_unreachable")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            user = User(
                name=str(info.get("name") or email.split("@")[0])[:120],
                email=email,
                password_hash="",  # no passwords in Google-only mode
                avatar_url=str(info.get("picture") or "")[:500],
                is_verified=True,
                auth_provider="google",
            )
            db.add(user)
        else:
            # Existing account (e.g. from the old password system): signing in
            # with its Gmail proves ownership, so it is marked verified and
            # keeps all of its chats/history.
            user.is_verified = True
            if not user.avatar_url and info.get("picture"):
                user.avatar_url = str(info["picture"])[:500]
        db.commit()
        db.refresh(user)
    finally:
        db.close()

    fragment = urlencode({"access_token": create_access_token(user.id)})
    return RedirectResponse(f"{frontend}/oauth/callback#{fragment}", status_code=302)


@router.get("/me", response_model=UserProfile)
def me(user: User = Depends(get_current_user)) -> UserProfile:
    return UserProfile.model_validate(user)


@router.patch("/me", response_model=UserProfile)
def update_profile(
    payload: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserProfile:
    if payload.name is not None:
        user.name = payload.name.strip()
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url
    db.commit()
    db.refresh(user)
    return UserProfile.model_validate(user)
