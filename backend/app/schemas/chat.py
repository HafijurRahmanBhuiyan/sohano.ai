from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class AttachmentOut(BaseModel):
    id: str
    file_name: str
    file_url: str
    file_type: str
    extracted_text: str = ""

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime
    attachments: List[AttachmentOut] = []

    class Config:
        from_attributes = True


class ChatCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)


class ChatRename(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class ChatOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatWithMessages(ChatOut):
    messages: List[MessageOut] = []


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=32000)
    attachment_ids: List[str] = []
