import os
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=os.path.join(BASE_DIR, ".env"), extra="ignore")

    app_name: str = "Sohano.ai"
    database_url: str = f"sqlite:///{os.path.join(BASE_DIR, 'sohano.db')}"

    secret_key: str = "dev-insecure-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    llm_provider: str = "anthropic"
    llm_model: str = "claude-sonnet-4-6"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""

    upload_dir: str = os.path.join(BASE_DIR, "uploads")
    max_upload_mb: int = 25

    rate_limit_per_minute: int = 20

    frontend_origin: str = "http://localhost:5173"
    backend_origin: str = ""

    supabase_url: str = ""
    supabase_key: str = ""
    supabase_bucket: str = "sohano-attachments"

    # --- Google OAuth (the only sign-in method) ---
    google_client_id: str = ""
    google_client_secret: str = ""

    @property
    def primary_frontend_origin(self) -> str:
        return self.frontend_origin.split(",")[0].strip().rstrip("/")

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.frontend_origin.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

os.makedirs(settings.upload_dir, exist_ok=True)
