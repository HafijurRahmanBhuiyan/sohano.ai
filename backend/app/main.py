from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.routers import auth, chat, upload


def _migrate_users_table() -> None:
    """Lightweight idempotent migration for pre-existing databases."""
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("users")}
    is_postgres = engine.dialect.name == "postgresql"
    with engine.begin() as connection:
        if "is_verified" not in columns:
            default = "FALSE" if is_postgres else "0"
            connection.exec_driver_sql(
                f"ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT {default}"
            )
        if "auth_provider" not in columns:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'local'"
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _migrate_users_table()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files (dev convenience; swap for S3/CDN in production).
app.mount("/files", StaticFiles(directory=settings.upload_dir), name="files")

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(upload.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "app": settings.app_name}
