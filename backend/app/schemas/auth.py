from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProvidersResponse(BaseModel):
    google: bool


class UserProfile(BaseModel):
    id: str
    name: str
    email: EmailStr
    avatar_url: str = ""

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
