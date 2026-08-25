from typing import List

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, gen_uuid


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), default="")
    avatar_url: Mapped[str] = mapped_column(String(500), default="")
    # Email verification gate: login is blocked until True.
    is_verified: Mapped[bool] = mapped_column(default=False)
    # "local" (email+password) or "google" (OAuth account).
    auth_provider: Mapped[str] = mapped_column(String(20), default="local")

    chats: Mapped[List["Chat"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
