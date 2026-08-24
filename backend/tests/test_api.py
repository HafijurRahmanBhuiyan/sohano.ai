import os
import sys

os.environ["DATABASE_URL"] = "sqlite:///./test_sohano.db"
os.environ["LLM_PROVIDER"] = "mock"
os.environ.setdefault("SECRET_KEY", "test-secret")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

from app.db.base import Base
from app.db.session import engine
from app.main import app


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


@pytest.fixture()
def auth_headers(client):
    client.post(
        "/auth/signup",
        json={"name": "Hafij", "email": "hafij@sohano.ai", "password": "supersecret1"},
    )
    res = client.post(
        "/auth/login", json={"email": "hafij@sohano.ai", "password": "supersecret1"}
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_signup_login_me(client):
    res = client.post(
        "/auth/signup",
        json={"name": "Test User", "email": "test@example.com", "password": "password123"},
    )
    assert res.status_code == 201
    assert "access_token" in res.json()

    # duplicate email rejected
    res = client.post(
        "/auth/signup",
        json={"name": "Test User", "email": "test@example.com", "password": "password123"},
    )
    assert res.status_code == 409

    res = client.post(
        "/auth/login", json={"email": "test@example.com", "password": "wrongpass1"}
    )
    assert res.status_code == 401

    res = client.post(
        "/auth/login", json={"email": "test@example.com", "password": "password123"}
    )
    assert res.status_code == 200
    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}

    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "test@example.com"


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
    client.post(
        "/auth/signup",
        json={"name": "Other", "email": "other@example.com", "password": "password123"},
    )
    other_token = client.post(
        "/auth/login", json={"email": "other@example.com", "password": "password123"}
    ).json()["access_token"]
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
