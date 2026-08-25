from typing import Optional

from supabase import create_client, Client

from app.core.config import settings


supabase: Client = create_client(
    settings.supabase_url,
    settings.supabase_key,
)


def upload_file(
    file_path: str,
    file_data: bytes,
    content_type: Optional[str] = None,
) -> str:
    options = {
        "upsert": "false",
        "cache-control": "3600",
    }

    if content_type:
        options["content-type"] = content_type

    supabase.storage.from_(settings.supabase_bucket).upload(
        file_path,
        file_data,
        options,
    )

    return (
        f"{settings.supabase_url}/storage/v1/object/public/"
        f"{settings.supabase_bucket}/{file_path}"
    )