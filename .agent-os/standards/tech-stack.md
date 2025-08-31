# Tech Stack

## Context

Global tech stack defaults for Agent OS projects.  
Overridable per-project via `.agent-os/product/tech-stack.md`.

---

## ⚙️ Backend

- **App Framework**: FastAPI
- **Language**: Python 3.11+
- **Web Server**: Uvicorn (standalone, ASGI-native)
- **Containerization**: Docker (Railway-compatible)
- **Database ORM**: SQLModel or SQLAlchemy 2.0+ (async)
- **Migrations**: Alembic
- **Task Queue**: Optional (Celery with Redis if needed)
- **API Docs**: Auto-generated (Swagger/OpenAPI via FastAPI)
- **Healthcheck Endpoint**: `/health`
- **Metrics (optional)**: Prometheus-compatible with Starlette middleware

---

## 🗃 Data Layer

- **Primary Database**: Supabase (PostgreSQL 15+ with JSONB)
- **Supabase Integration**: `supabase-py` or async SQL client
- **Vector DB**: Weaviate (self-hosted or Weaviate Cloud)
- **Vector Client SDK**: `weaviate-client` (Python SDK)
- **Object Storage**: Supabase Storage (S3-compatible)
- **Asset Access**: Signed URLs enforced via Supabase RLS policies

---

## 🌐 Frontend

- **Framework**: React (latest stable)
- **Build Tool**: Vite
- **Language**: TypeScript (strict mode enabled)
- **CSS Framework**: TailwindCSS 4.0+
- **UI Components**: Instrumental Components (latest)
- **Icons**: Lucide React components
- **Font Provider**: Google Fonts (self-hosted for performance)
- **Package Manager**: npm
- **Node Version**: 22 LTS
- **Testing (unit/integration)**: Vitest + React Testing Library + jsdom
- **Testing (e2e)**: Playwright (optional)
- **Linting**: ESLint + Prettier
- **Type Safety**: TypeScript + `tsconfig.strict`

---

## ☁️ Hosting & Environments

- **App Hosting**: Railway (Docker deployment)
- **Environments**:
  - `main`: Production
  - `staging`: Preview
- **Environment Variables**: Managed in Railway Secrets UI
- **Healthcheck**: FastAPI `/health` endpoint
- **Port Binding**: `$PORT` (Railway runtime injection)
- **Volume Storage**: Optional, for ephemeral persistence

---

## 🔁 CI/CD & Workflow

- **CI/CD Platform**: GitHub Actions
- **Build Trigger**: Push to `main` or `staging`
- **Tests**: Backend (Pytest), Frontend (Vitest) run before deploy
- **Secret Management**: GitHub → Railway sync or manual entry
- **Container Build**: `Dockerfile` with multi-stage (build + runtime)

---

## 🔐 Authentication

- **Auth Provider**: Supabase Auth (JWT + OAuth)
- **Session Handling**: Stateless JWT or client SDK
- **RBAC**: Supabase RLS + policy-based access control

---

## 🧪 Dev Tooling

| Purpose              | Tool               |
|----------------------|--------------------|
| Python Formatting    | Black              |
| Python Linting       | Ruff or Flake8     |
| Python Type Checking | MyPy               |
| Testing (Python)     | Pytest             |
| Frontend Testing     | Vitest + RTL       |
| E2E Testing          | Playwright (optional) |
| JS Linting           | ESLint + Prettier  |

---

## 🧠 AI & Semantic Capabilities

- **Vector Store**: Weaviate (OpenAI, Cohere, or HF-compatible)
- **Embeddings Source**: OpenAI / Azure OpenAI / HuggingFace
- **Hybrid Search**: Supabase (structured) + Weaviate (semantic)

---

## 🧭 Notes

- All choices are overridable per-project via `.agent-os/product/tech-stack.md`
- FastAPI + Railway enables async-native performance with modern deployment
- Supabase and Weaviate provide strong dual-mode data infrastructure: structured + semantic

