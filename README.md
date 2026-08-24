# Sohano.ai 🐱🐭

A full-stack AI chat assistant powered by **Google Gemini** — ask questions, upload files & images, switch between free Gemini models from a dropdown, and stream well-researched answers token-by-token. Chat history sidebar, dark mode, JWT auth, and a signature **cat-chases-mouse thinking animation** in the navbar (the cat catches the mouse the instant your answer finishes streaming).

> **Accuracy note:** answer quality comes from the underlying LLM provider (Google Gemini by default). The backend has a provider abstraction so you can swap providers via one env var.

## Tech Stack

| Layer     | Tech                                                        |
|-----------|-------------------------------------------------------------|
| Frontend  | React 18 + Vite + TypeScript + Tailwind CSS v4 + Zustand + lucide-react |
| Backend   | FastAPI (Python) + SQLAlchemy 2                              |
| Database  | PostgreSQL (SQLite fallback for zero-config local dev)       |
| AI        | Google Gemini API (streaming) · Anthropic Claude · OpenAI-compatible · mock |
| Auth      | JWT (email/password), bcrypt hashing                        |
| Streaming | Server-Sent Events (SSE)                                     |
| Storage   | Local `/uploads` (S3-ready abstraction point in `file_processor.py`) |

## Features

- 💬 **Chat UI** — bubble layout, Markdown rendering with syntax-highlighted code blocks, tables & lists
- ⚡ **Streaming responses** — token-by-token via SSE; copy / regenerate / thumbs up-down under each reply
- 🔀 **Model selector dropdown** — pick between free Gemini models above the message box; selection persists across reloads, and each model has its own free daily quota so you can simply switch when one runs out
- 📎 **File & image upload** — PDF, DOCX, XLSX, CSV, TXT extracted to text; images analyzed with a vision-capable LLM call and sent as base64 to the model (25 MB limit)
- 🗂️ **Chat history sidebar** — grouped Today / Yesterday / Previous 7 Days / Previous 30 days, search, rename, delete, collapsible (auto-hides on mobile)
- 🐱 **Cat vs mouse thinking animation** — `idle → thinking → caught` states driven by real stream events
- 👤 **Accounts** — signup/login (JWT), profile settings, password change, per-user isolated history
- 🌓 **Dark / light mode**, fully responsive
- 🛡️ Rate limiting per user per minute, graceful LLM-failure fallbacks, `.env` secrets never exposed to the frontend

## Project Structure

```
sohano/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, CORS, static uploads
│   │   ├── core/                   # config, security (JWT/bcrypt), deps (auth, rate limit)
│   │   ├── db/                     # SQLAlchemy base & session
│   │   ├── models/                 # User, Chat, Message, Attachment
│   │   ├── schemas/                # Pydantic request/response models
│   │   ├── routers/                # auth.py, chat.py, upload.py
│   │   └── services/
│   │       ├── llm_service.py      # provider abstraction (gemini/anthropic/openai/mock),
│   │       │                       # streaming + ALLOWED_MODELS whitelist
│   │       └── file_processor.py   # PDF/DOCX/XLSX/CSV/TXT extraction + image vision analysis
│   ├── tests/test_api.py           # pytest suite (auth, chats, SSE, uploads)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/                    # fetch client + SSE parser + types
│   │   ├── config/models.ts        # dropdown model list + localStorage persistence
│   │   ├── store/                  # zustand stores (auth, chat)
│   │   ├── components/             # Navbar, Sidebar, ChatWindow, MessageBubble,
│   │   │                           # Composer (+ModelPicker), ThinkingIndicator, ThemeToggle
│   │   └── pages/                  # Login, Signup, Chat, Settings
│   └── nginx.conf / Dockerfile
├── docker-compose.yml              # postgres + backend + frontend(nginx)
└── README.md
```

## Quick Start (local dev)

### 1. Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set LLM_PROVIDER=gemini and add your GEMINI_API_KEY (or leave empty for mock mode)
uvicorn app.main:app --reload --port 8000
```

With no API key configured the backend automatically falls back to a **mock provider** so you can test the whole app offline.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api -> :8000)
```

Sign up at `http://localhost:5173/signup`, send a message, and watch the cat chase the mouse while Sohano thinks. 🐱

### PostgreSQL

The default `DATABASE_URL` falls back to SQLite (`backend/sohano.db`). To use Postgres, set it in `backend/.env`:

```
DATABASE_URL=postgresql://sohano:sohano@localhost:5432/sohano
```

Tables are created automatically on startup.

## Switching models

Use the dropdown above the message box to choose any of the bundled free Gemini models (`frontend/src/config/models.ts`). The chosen id travels with every send/regenerate request and is validated against the `ALLOWED_MODELS` whitelist in `backend/app/services/llm_service.py` — anything unknown silently falls back to `LLM_MODEL`. Because Google's free tier gives each model its own small daily quota, switching models is the quickest way around a `RESOURCE_EXHAUSTED` limit. To offer different models, edit both `ALLOWED_MODELS` (backend) and `MODELS` (frontend).

## Environment Variables (backend/.env)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | sqlite fallback | Postgres connection string |
| `SECRET_KEY` | dev value | JWT signing key — change in production |
| `LLM_PROVIDER` | `anthropic` | `gemini` \| `anthropic` \| `openai` \| `mock` |
| `LLM_MODEL` | `claude-sonnet-4-6` | Default model id (e.g. `gemini-3.6-flash` for Gemini) |
| `GEMINI_API_KEY` | — | Required for the gemini provider |
| `ANTHROPIC_API_KEY` | — | Required for anthropic provider |
| `OPENAI_API_KEY` | — | Required for openai provider |
| `UPLOAD_DIR` | `uploads` | Where uploaded files are stored |
| `MAX_UPLOAD_MB` | `25` | Upload size limit |
| `RATE_LIMIT_PER_MINUTE` | `20` | Requests/min per user on message/upload endpoints |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS origin(s), comma-separated |

## Tests

```bash
cd backend && ./venv/bin/python -m pytest tests/ -q
cd frontend && npm run build        # type-checks + production build
```

## Docker Deployment

```bash
export LLM_PROVIDER=gemini
export GEMINI_API_KEY=...           # or ANTHROPIC_API_KEY / OPENAI_API_KEY
export SECRET_KEY=$(python3 -c "import secrets;print(secrets.token_hex(32))")
docker compose up --build
# App: http://localhost:8080  (nginx serves the SPA and proxies /api + /files)
```

## Adding a new LLM provider

1. Subclass `BaseLLMProvider` in `backend/app/services/llm_service.py`
2. Implement `stream_generate(messages, model=None)` as an async generator of text chunks
3. Register it in `get_llm_provider()` and set `LLM_PROVIDER=<name>`
