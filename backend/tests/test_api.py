import os
import sys

os.environ["DATABASE_URL"] = "sqlite:///./test_sohano.db"
os.environ["LLM_PROVIDER"] = "mock"
os.environ.setdefault("SECRET_KEY", "test-secret")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models.user import User


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    if os.path.exists("./test_sohano.db"):
        os.remove("./test_sohano.db")


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _google_user_token(email: str, name: str = "Test User") -> str:
    """Create (or reuse) a Google-style user directly and mint an app JWT."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            user = User(
                name=name,
                email=email,
                password_hash="",  # Google-only accounts have no password
                is_verified=True,
                auth_provider="google",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return create_access_token(user.id)
    finally:
        db.close()


@pytest.fixture()
def auth_headers(client):
    token = _google_user_token("hafij@sohano.ai", "Hafij")
    return {"Authorization": f"Bearer {token}"}


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_google_only_auth_surface(client):
    # Password signup/login endpoints no longer exist.
    assert client.post("/auth/signup", json={}).status_code != 201
    assert client.post("/auth/login", json={}).status_code != 200

    # Google not configured in tests -> provider disabled + start returns 404.
    providers = client.get("/auth/providers").json()
    assert providers == {"google": False}
    assert client.get("/auth/google").status_code == 404


def test_me_with_google_user(client):
    token = _google_user_token("me@example.com", "Me")
    res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "me@example.com"
    assert body["name"] == "Me"


def test_chat_crud_and_streaming(client, auth_headers):
    h = auth_headers

    created = client.post("/chats", json={}, headers=h)
    assert created.status_code == 201
    chat_id = created.json()["id"]

    listed = client.get("/chats", headers=h)
    assert listed.status_code == 200 and len(listed.json()) == 1

    # Send a message; response is SSE stream from the mock provider.
    res = client.post(
        f"/chats/{chat_id}/messages",
        json={"content": "Hello Sohano!", "attachment_ids": []},
        headers=h,
    )
    assert res.status_code == 200
    body = res.text
    assert "event: delta" in body
    assert "event: done" in body
    assert "mock mode" in body

    # Chat auto-titled
    chat = client.get(f"/chats/{chat_id}", headers=h).json()
    assert chat["title"].startswith("Hello Sohano!")
    assert len(chat["messages"]) == 2
    assert chat["messages"][0]["role"] == "user"
    assert chat["messages"][1]["role"] == "assistant"

    renamed = client.patch(f"/chats/{chat_id}", json={"title": "My chat"}, headers=h)
    assert renamed.json()["title"] == "My chat"

    deleted = client.delete(f"/chats/{chat_id}", headers=h)
    assert deleted.status_code == 204
    assert client.get(f"/chats/{chat_id}", headers=h).status_code == 404


def test_chats_isolated_per_user(client, auth_headers):
    other_token = _google_user_token("other@example.com", "Other")
    other_h = {"Authorization": f"Bearer {other_token}"}
    assert client.get("/chats", headers=other_h).json() == []

    created = client.post("/chats", json={}, headers=auth_headers).json()
    # Other user cannot access it
    assert client.get(f"/chats/{created['id']}", headers=other_h).status_code == 404


def test_upload_txt(client, auth_headers):
    res = client.post(
        "/upload",
        files={"files": ("notes.txt", b"The capital of France is Paris.", "text/plain")},
        headers=auth_headers,
    )
    assert res.status_code == 200
    atts = res.json()
    assert atts[0]["file_name"] == "notes.txt"
    assert "Paris" in atts[0]["extracted_text"]


def test_upload_rejects_bad_type(client, auth_headers):
    res = client.post(
        "/upload",
        files={"files": ("evil.exe", b"MZ...", "application/octet-stream")},
        headers=auth_headers,
    )
    assert res.status_code == 415


def test_auth_required(client):
    assert client.get("/chats").status_code == 401
