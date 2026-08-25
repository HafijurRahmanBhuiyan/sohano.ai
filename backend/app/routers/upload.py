import uuid
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import rate_limit
from app.db.session import get_db
from app.models.attachment import Attachment
from app.models.user import User
from app.schemas.chat import AttachmentOut
from app.services import file_processor
from app.services.supabase_storage import upload_file


router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("", response_model=List[AttachmentOut])
async def upload_files(
    files: List[UploadFile] = File(...),
    user: User = Depends(rate_limit),
    db: Session = Depends(get_db),
) -> List[AttachmentOut]:
    results: List[AttachmentOut] = []

    for file in files:
        raw = await file.read()

        if len(raw) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"'{file.filename}' exceeds the "
                    f"{settings.max_upload_mb}MB limit"
                ),
            )

        if not file.filename or not file_processor.is_allowed(file.filename):
            raise HTTPException(
                status_code=415,
                detail=(
                    f"Unsupported file type: '{file.filename}'. Allowed: "
                    + ", ".join(sorted(file_processor.ALLOWED_EXTS))
                ),
            )

        # Generate a unique filename for Supabase Storage
        stored_name = f"{uuid.uuid4()}-{file.filename}"

        # Upload the actual file to Supabase Storage
        file_url = upload_file(
            file_path=stored_name,
            file_data=raw,
            content_type=file.content_type,
        )

        # Extract content from the uploaded file
        if file_processor.is_image(file.filename):
            extracted = await file_processor.describe_image(
                raw,
                file.filename,
            )
            file_type = "image/" + file_processor.ext_of(file.filename)
        else:
            extracted = file_processor.extract_document(
                file.filename,
                raw,
            )
            file_type = file_processor.ext_of(file.filename)

        # Save attachment information in PostgreSQL
        att = Attachment(
            message_id=None,
            file_name=file.filename,
            file_url=file_url,
            file_type=file_type,
            extracted_text=extracted[:200000],
        )

        db.add(att)
        db.commit()
        db.refresh(att)

        results.append(AttachmentOut.model_validate(att))

    _ = user  # auth enforced via dependency

    return results