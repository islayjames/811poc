"""Texas 811 POC Backend - FastAPI application."""

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .redis_client import session_manager


@asynccontextmanager
async def lifespan(app: FastAPI) -> None:
    """Application lifespan management."""

    # Initialize data directories
    settings.data_root.mkdir(parents=True, exist_ok=True)
    settings.tickets_dir.mkdir(parents=True, exist_ok=True)
    settings.sessions_dir.mkdir(parents=True, exist_ok=True)
    settings.audit_dir.mkdir(parents=True, exist_ok=True)

    print(f"✓ Data directories initialized at {settings.data_root}")

    # Session manager initializes Redis connection automatically
    print(
        f"✓ Session manager initialized (Redis: {'enabled' if session_manager.is_connected() else 'fallback mode'})"
    )

    yield

    # Cleanup expired in-memory sessions
    session_manager.cleanup_expired()
    print("✓ Session cleanup completed")


# FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Texas 811 POC Backend API for automated ticket submission workflow. "
        "Handles PDF extraction processing, field validation, geocoding, "
        "compliance date calculation, and submission packet generation."
    ),
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# CORS middleware for CustomGPT integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://chatgpt.com",
        "https://chat.openai.com",
        "http://localhost:*",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Any, exc: Exception) -> JSONResponse:
    """Global exception handler with proper error formatting."""
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": True, "message": exc.detail, "type": "http_error"},
        )

    # Log unexpected errors in production
    if not settings.debug:
        print(f"Unexpected error: {exc}")

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": True,
            "message": "Internal server error" if not settings.debug else str(exc),
            "type": "internal_error",
        },
    )


# Health check endpoints
@app.get("/", tags=["Health"])
async def root() -> dict[str, Any]:
    """Root endpoint with basic API information."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs_url": "/docs" if settings.debug else "disabled in production",
    }


@app.get("/health", tags=["Health"])
async def health_check() -> JSONResponse:
    """Detailed health check for monitoring."""
    health_status = {
        "service": settings.app_name,
        "status": "healthy",
        "version": settings.app_version,
        "components": {},
    }

    # Check Redis/Session manager
    redis_healthy = session_manager.is_connected()
    if redis_healthy:
        health_status["components"]["redis"] = {
            "status": "healthy",
            "url": settings.redis_url,
        }
    else:
        health_status["components"]["redis"] = {
            "status": "fallback",
            "message": "Using in-memory session storage",
            "url": settings.redis_url,
        }

    # Check data directories
    data_dirs_healthy = all(
        [
            settings.data_root.exists(),
            settings.tickets_dir.exists(),
            settings.sessions_dir.exists(),
            settings.audit_dir.exists(),
        ]
    )

    health_status["components"]["storage"] = {
        "status": "healthy" if data_dirs_healthy else "unhealthy",
        "data_root": str(settings.data_root),
        "directories": {
            "tickets": str(settings.tickets_dir),
            "sessions": str(settings.sessions_dir),
            "audit": str(settings.audit_dir),
        },
    }

    # Overall health
    overall_healthy = data_dirs_healthy  # Redis is optional for POC
    health_status["status"] = "healthy" if overall_healthy else "unhealthy"

    status_code = (
        status.HTTP_200_OK if overall_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
    )

    return JSONResponse(content=health_status, status_code=status_code)


@app.get("/ready", tags=["Health"])
async def readiness_check() -> dict[str, str]:
    """Simple readiness check for load balancers."""
    return {"status": "ready"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "texas811_poc.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
