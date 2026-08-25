# Sohano.ai 🐱🐭

A full-stack AI chat assistant powered by **Google Gemini** — ask questions, upload files & images, switch between free Gemini models from a dropdown, and stream well-researched answers token-by-token. Attachments are stored permanently in **Supabase Storage**, chat history lives in **PostgreSQL**, and a signature **cat-chases-mouse thinking animation** runs in the navbar (the cat catches the mouse the instant your answer finishes streaming).

> **Accuracy note:** answer quality comes from the underlying LLM provider (Google Gemini by default). The backend has a provider abstraction so you can swap providers via one env var.

## Tech Stack

| Layer     | Tech                                                        |
|-----------|-------------------------------------------------------------|
| Frontend  | React 18 + Vite + TypeScript + Tailwind CSS v4 + Zustand + lucide-react |
| Backend   | FastAPI (Python) + SQLAlchemy 2                              |
| Database  | PostgreSQL (SQLite fallback for local dev)                   |
| AI        | Google Gemini API (streaming) · Anthropic Claude · OpenAI-compatible · mock |
| Auth      | JWT (email/password), bcrypt hashing                        |
| Streaming | Server-Sent Events (SSE)                                     |
| Storage   | **Supabase Storage** (public bucket) for uploaded attachments |

## Features

- 💬 **Chat UI** — bubble layout, Markdown rendering with syntax-highlighted code blocks, tables & lists
- ⚡ **Streaming responses** — token-by-token via SSE; copy / regenerate / thumbs up-down under each reply
- 🔀 **Model selector dropdown** — pick between free Gemini models above the message box; selection persists across reloads, and each model has its own free daily quota so you can simply switch when one runs out
- 📎 **File & image upload** — PDF, DOCX, XLSX, CSV, TXT extracted to text; images analyzed with a vision-capable LLM call and sent as base64 to the model (25 MB limit)
- 🗄️ **Permanent attachment storage** — every upload goes straight to a Supabase Storage bucket and its public URL is recorded in Postgres, so attachments survive restarts and redeploys
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
│   │       ├── supabase_storage.py # Supabase Storage client + upload_file()
│   │       └── file_processor.py   # PDF/DOCX/XLSX/CSV/TXT extraction + image vision analysis
│   ├── tests/test_api.py           # pytest suite (auth, chats, SSE, uploads)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/                    # fetch client (honours VITE_API_BASE_URL) + SSE parser
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

### 1. Prerequisites

- A **Supabase** project with a Storage bucket named after `SUPABASE_BUCKET` (default `sohano-attachments`). The bucket must be **public**, because attachment URLs are generated as public object URLs.
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey).

> ⚠️ **Supabase credentials are required for startup.** The Supabase client is created when the upload router loads, so the backend will not boot without `SUPABASE_URL` and `SUPABASE_KEY` set — even in mock LLM mode.

### 2. Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then set GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api -> :8000)
```

Sign up at `http://localhost:5173/signup`, send a message, and watch the cat chase the mouse while Sohano thinks. 🐱

### PostgreSQL

The default `DATABASE_URL` falls back to SQLite (`backend/sohano.db`). To use Postgres (recommended, matches production), set it in `backend/.env`:

```
DATABASE_URL=postgresql://sohano:sohano@localhost:5432/sohano
```

Tables are created automatically on startup. A hosted Supabase Postgres connection string works here too.

## Switching models

Use the dropdown above the message box to choose any of the bundled free Gemini models (`frontend/src/config/models.ts`). The chosen id travels with every send/regenerate request and is validated against the `ALLOWED_MODELS` whitelist in `backend/app/services/llm_service.py` — anything unknown silently falls back to `LLM_MODEL`. Because Google's free tier gives each model its own small daily quota, switching models is the quickest way around a `RESOURCE_EXHAUSTED` limit. To offer different models, edit both `ALLOWED_MODELS` (backend) and `MODELS` (frontend).

## File storage (Supabase)

1. Files are uploaded from the composer → `POST /api/upload`.
2. The backend stores each file in the configured Supabase bucket under a UUID-prefixed name (`supabase_storage.upload_file`).
3. The returned public URL (`…/storage/v1/object/public/<bucket>/<file>`) plus any extracted text is saved as an `Attachment` row in Postgres.
4. Messages reference attachments by id; the UI renders images inline (with a lightbox) and documents as cards.

The `/files` static mount in `main.py` still exists purely as a dev convenience for older locally-stored files — all new uploads bypass it entirely.

## Environment Variables (backend/.env)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | sqlite fallback | Postgres connection string (Supabase Postgres works too) |
| `SECRET_KEY` | dev value | JWT signing key — change in production |
| `LLM_PROVIDER` | `anthropic` | `gemini` \| `anthropic` \| `openai` \| `mock` |
| `LLM_MODEL` | `claude-sonnet-4-6` | Default model id (e.g. `gemini-3.6-flash` for Gemini) |
| `GEMINI_API_KEY` | — | Required for the gemini provider |
| `ANTHROPIC_API_KEY` | — | Required for anthropic provider |
| `OPENAI_API_KEY` | — | Required for openai provider |
| `SUPABASE_URL` | — | **Required.** Supabase project URL |
| `SUPABASE_KEY` | — | **Required.** Supabase API key (service or anon, must allow Storage writes) |
| `SUPABASE_BUCKET` | `sohano-attachments` | Public Storage bucket for attachments |
| `MAX_UPLOAD_MB` | `25` | Upload size limit |
| `RATE_LIMIT_PER_MINUTE` | `20` | Requests/min per user on message/upload endpoints |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS origin(s), comma-separated |

### Frontend variable

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` (proxied) | Absolute API base for deployments where the API lives on another domain (e.g. Render) |

## Tests

```bash
cd backend && ./venv/bin/python -m pytest tests/ -q
cd frontend && npm run build        # type-checks + production build
```

## Deployment

### Render-style (API on its own domain)

1. Deploy `backend/` as a Python web service (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`) and set the env vars above.
2. Build `frontend/` with `VITE_API_BASE_URL=https://<your-api-domain>/api` so the SPA talks to the right backend.
3. Add your deployed frontend origin to `FRONTEND_ORIGIN`.

### Docker Compose

```bash
export SECRET_KEY=$(python3 -c "import secrets;print(secrets.token_hex(32))")
# also export GEMINI_API_KEY / SUPABASE_URL / SUPABASE_KEY if you extend
# the compose environment block accordingly
docker compose up --build
# App: http://localhost:8080  (nginx serves the SPA and proxies /api + /files)
```

> Note: the current `docker-compose.yml` does not yet forward `GEMINI_API_KEY` or `SUPABASE_*` variables to the backend container — add them to the `backend.environment` block for containerized use.

## Adding a new LLM provider

1. Subclass `BaseLLMProvider` in `backend/app/services/llm_service.py`
2. Implement `stream_generate(messages, model=None)` as an async generator of text chunks
3. Register it in `get_llm_provider()` and set `LLM_PROVIDER=<name>`
