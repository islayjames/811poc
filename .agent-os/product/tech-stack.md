# Technical Stack

> Last Updated: 2025-08-31
> Version: 1.0.0

## Core Technologies

**Application Framework:** Python 3.11+ with FastAPI
**Database System:** PostgreSQL (via Supabase)
**JavaScript Framework:** React 18 with TypeScript
**CSS Framework:** TailwindCSS 3.4

## Package Managers (CRITICAL - DO NOT CHANGE)

**Python Package Manager:** uv
**JavaScript Package Manager:** npm

⚠️ **IMPORTANT**: Always use the package managers specified above. 
- Python: Use `uv` (NOT pip if uv is specified)
- JavaScript: Use `npm` (NOT yarn if npm is specified)

## Development Environment

**Project Structure:** monorepo
**Frontend Port:** 3000
**Backend Port:** 8000

### Startup Commands

**Frontend:** `npm run dev`
**Backend:** `uvicorn app.main:app --reload --port 8000`

**Quick Start:** Run `./start.sh` to start both services

### Environment Files

- **Frontend:** `.env.local` (contains PORT=3000)
- **Backend:** `.env` (contains API_PORT=8000)

## Testing Strategy

**Frontend Testing:** Vitest with React Testing Library
**Backend Testing:** pytest with pytest-asyncio
**E2E Testing:** playwright

## Additional Configuration

**UI Component Library:** shadcn/ui
**Font Provider:** Google Fonts
**Icon Library:** Lucide React

## API Architecture

**REST API Framework:** FastAPI with Pydantic validation
**API Documentation:** Auto-generated OpenAPI/Swagger
**Authentication:** API key authentication (for CustomGPT)
**CORS Configuration:** Allow CustomGPT origin
**Rate Limiting:** 100 requests/minute per API key

## External Services

**Geocoding Service:** Google Maps Geocoding API (or Mapbox)
**Holiday Calendar:** Static Texas holiday list (embedded)
**PDF Storage:** Supabase Storage (for audit trail)
**Session Cache:** Redis (for stateful validation sessions)

## Deployment

**Application Hosting:** Railway (Docker containers)
**Database Hosting:** Supabase (managed PostgreSQL)
**Asset Hosting:** Railway static serving
**Deployment Solution:** GitHub Actions CI/CD

## Repository

**Code Repository:** https://github.com/[org]/texas811-backend

## Development Tools

**API Testing:** Postman/Insomnia collections
**Database Migrations:** Alembic
**Code Formatting:** Black (Python), Prettier (JS/TS)
**Linting:** Ruff (Python), ESLint (JS/TS)
**Type Checking:** mypy (Python), TypeScript

## Security Configuration

**API Security:** Rate limiting, API key validation, input sanitization
**Data Encryption:** TLS in transit, encrypted at rest (Supabase)
**Secrets Management:** Environment variables, never in code
**Audit Logging:** All API calls logged with timestamp and key

---

**⚠️ AGENT OS REMINDER**: Before making ANY changes to package management, startup commands, or environment configuration, ALWAYS check this file first to maintain consistency.