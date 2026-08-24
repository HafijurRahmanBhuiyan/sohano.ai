import json
import os
from typing import AsyncIterator, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, rate_limit
from app.core.config import settings
from app.db.session import get_db
from app.models.attachment import Attachment
from app.models.chat import Chat
from app.models.message import Message
from app.models.user import User
from app.schemas.chat import (
    ChatCreate,
    ChatOut,
    ChatRename,
    ChatWithMessages,
    MessageOut,
    SendMessageRequest,
)
from app.services.file_processor import is_image
from app.services.llm_service import LLMImage, LLMMessage, encode_image_bytes, get_llm_provider

router = APIRouter(prefix="/chats", tags=["chats"])


def _get_owned_chat(db: Session, chat_id: str, user: User) -> Chat:
    chat = db.get(Chat, chat_id)
    if chat is None or chat.user_id != user.id:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@router.get("", response_model=List[ChatOut])
def list_chats(
    q: str = "",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Chat]:
    query = db.query(Chat).filter(Chat.user_id == user.id)
    if q.strip():
        like = f"%{q.strip()}%"
        query = (
            query.join(Message, Message.chat_id == Chat.id, isouter=True)
            .filter(or_(Chat.title.ilike(like), Message.content.ilike(like)))
            .distinct()
        )
    return query.order_by(Chat.updated_at.desc()).all()


@router.post("", response_model=ChatWithMessages, status_code=201)
def create_chat(
    payload: ChatCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Chat:
    chat = Chat(user_id=user.id, title=(payload.title or "New chat").strip()[:200])
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat


@router.get("/{chat_id}", response_model=ChatWithMessages)
def get_chat(
    chat_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Chat:
    chat = _get_owned_chat(db, chat_id, user)
    _ = chat.messages  # load relationship
    return chat


@router.patch("/{chat_id}", response_model=ChatOut)
def rename_chat(
    chat_id: str,
    payload: ChatRename,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Chat:
    chat = _get_owned_chat(db, chat_id, user)
    chat.title = payload.title.strip()[:200]
    db.commit()
    db.refresh(chat)
    return chat


@router.delete("/{chat_id}", status_code=204)
def delete_chat(
    chat_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    chat = _get_owned_chat(db, chat_id, user)
    db.delete(chat)
    db.commit()


def _build_llm_messages(db: Session, chat: Chat) -> List[LLMMessage]:
    msgs = (
        db.query(Message)
        .options(joinedload(Message.attachments))
        .filter(Message.chat_id == chat.id)
        .order_by(Message.created_at.asc())
        .limit(40)  # keep context bounded
        .all()
    )
    llm_messages: List[LLMMessage] = []
    for m in msgs:
        content = m.content
        images: List[LLMImage] = []
        for att in m.attachments:
            header = f"\n\n--- Attached file: {att.file_name} ---\n"
            if att.extracted_text:
                content += header + att.extracted_text[:60000] + "\n--- End of file ---"
            if is_image(att.file_name):
                try:
                    disk_path = os.path.join(settings.upload_dir, os.path.basename(att.file_url))
                    with open(disk_path, "rb") as fh:
                        raw = fh.read()
                    media = att.file_type if att.file_type.startswith("image/") else "image/png"
                    images.append(
                        LLMImage(media_type=media, data_b64=encode_image_bytes(raw))
                    )
                except OSError:
                    pass
        llm_messages.append(LLMMessage(role=m.role, content=content, images=images))
    return llm_messages


async def _stream_completion(llm_messages: List[LLMMessage]) -> AsyncIterator[str]:
    provider = get_llm_provider()
    async for chunk in provider.stream_generate(llm_messages):
        yield chunk


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/{chat_id}/messages")
async def send_message(
    chat_id: str,
    payload: SendMessageRequest,
    user: User = Depends(rate_limit),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    chat = _get_owned_chat(db, chat_id, user)

    # Persist the user's message with any pre-uploaded attachments.
    user_msg = Message(chat_id=chat.id, role="user", content=payload.content)
    db.add(user_msg)
    db.flush()

    attached: List[Attachment] = []
    for att_id in payload.attachment_ids[:10]:
        att = db.get(Attachment, att_id)
        if att and (att.message_id is None):
            att.message_id = user_msg.id
            attached.append(att)
    db.commit()
    db.refresh(user_msg)

    # Auto-title new chats from the first user message.
    title_updated = False
    first_user_msg_count = (
        db.query(Message).filter(Message.chat_id == chat.id, Message.role == "user").count()
    )
    if first_user_msg_count == 1 and chat.title in ("", "New chat"):
        chat.title = payload.content.strip().replace("\n", " ")[:60]
        db.commit()
        title_updated = True

    llm_messages = _build_llm_messages(db, chat)

    async def event_stream() -> AsyncIterator[str]:
        full_text: List[str] = []
        try:
            yield _sse(
                "meta",
                {"user_message": MessageOut.model_validate(user_msg).model_dump(mode="json")},
            )
            async for chunk in _stream_completion(llm_messages):
                if not chunk:
                    continue
                full_text.append(chunk)
                yield _sse("delta", {"text": chunk})
        except Exception as exc:  # graceful fallback on LLM failure
            yield _sse("error", {"detail": f"Sohano.ai couldn't generate a response. {exc}"})

        assistant_text = "".join(full_text).strip()
        if not assistant_text:
            assistant_text = (
                "Sorry — I wasn't able to generate a response just now. "
                "Please try again in a moment."
            )
            yield _sse("delta", {"text": assistant_text})

        assistant_msg = Message(chat_id=chat.id, role="assistant", content=assistant_text)
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)
        db.refresh(chat)

        yield _sse(
            "done",
            {
                "message": MessageOut.model_validate(assistant_msg).model_dump(mode="json"),
                "title": chat.title,
                "title_updated": title_updated,
            },
        )

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)


@router.post("/{chat_id}/regenerate")
async def regenerate(
    chat_id: str,
    user: User = Depends(rate_limit),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Delete the last assistant message and re-stream a fresh answer."""
    chat = _get_owned_chat(db, chat_id, user)
    last_assistant = (
        db.query(Message)
        .filter(Message.chat_id == chat.id, Message.role == "assistant")
        .order_by(Message.created_at.desc())
        .first()
    )
    if last_assistant:
        db.delete(last_assistant)
        db.commit()

    llm_messages = _build_llm_messages(db, chat)

    async def event_stream() -> AsyncIterator[str]:
        full_text: List[str] = []
        try:
            async for chunk in _stream_completion(llm_messages):
                if not chunk:
                    continue
                full_text.append(chunk)
                yield _sse("delta", {"text": chunk})
        except Exception as exc:
            yield _sse("error", {"detail": f"Sohano.ai couldn't generate a response. {exc}"})

        assistant_text = "".join(full_text).strip() or (
            "Sorry — I wasn't able to generate a response just now. Please try again."
        )
        if not "".join(full_text).strip():
            yield _sse("delta", {"text": assistant_text})

        assistant_msg = Message(chat_id=chat.id, role="assistant", content=assistant_text)
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)
        yield _sse("done", {"message": MessageOut.model_validate(assistant_msg).model_dump(mode="json")})

    headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)
