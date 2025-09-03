"""Texas 811 POC Backend - FastAPI application."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

from .api_endpoints import parcel_router
from .api_endpoints import router as api_router
from .config import settings
from .dashboard_endpoints import router as dashboard_router
from .logging_config import (
    MetricsMiddleware,
    RequestLoggingMiddleware,
    health_metrics,
    setup_production_monitoring,
)
from .redis_client import session_manager


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan management."""

    # Setup production monitoring and logging
    setup_production_monitoring()

    # Initialize data directories
    settings.data_root.mkdir(parents=True, exist_ok=True)
    settings.tickets_dir.mkdir(parents=True, exist_ok=True)
    settings.sessions_dir.mkdir(parents=True, exist_ok=True)
    settings.audit_dir.mkdir(parents=True, exist_ok=True)

    print(f"✓ Data directories initialized at {settings.data_root}")

    # Session manager initializes Redis connection automatically
    redis_status = "enabled" if session_manager.is_connected() else "fallback mode"
    print(f"✓ Session manager initialized (Redis: {redis_status})")

    # Initialize metrics
    health_metrics.update_health_check()
    print("✓ Production monitoring initialized")

    yield

    # Cleanup expired in-memory sessions
    session_manager.cleanup_expired()
    print("✓ Session cleanup completed")

    # Log final metrics
    final_metrics = health_metrics.get_metrics()
    print(
        f"✓ Final metrics: {final_metrics['total_requests']} requests, {final_metrics['total_errors']} errors"
    )


# FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Texas 811 POC Backend API for automated ticket submission workflow.\n\n"
        "## Overview\n"
        "This API handles the complete workflow for Texas 811 utility locate requests:\n"
        "- **Validation**: Iterative field validation with detailed gap feedback\n"
        "- **Enrichment**: Automatic geocoding and compliance date calculations\n"
        "- **Submission**: Generation of Texas 811-compliant submission packets\n"
        "- **Tracking**: Ticket lifecycle management and status monitoring\n\n"
        "## Integration\n"
        "Designed for integration with CustomGPT for PDF extraction and conversational UI.\n"
        "Sessions maintain state across multiple API calls for progressive data completion.\n\n"
        "## Key Features\n"
        "- Stateful validation with detailed gap analysis\n"
        "- Address geocoding with confidence scoring\n"
        "- Texas business day calculations with holiday awareness\n"
        "- Simple geofence generation for work areas\n"
        "- Audit trail for compliance tracking"
    ),
    lifespan=lifespan,
    docs_url="/docs",  # Enable docs in production for POC testing
    redoc_url="/redoc",  # Enable redoc in production for POC testing
    servers=[
        {
            "url": "https://texas811-poc-production.up.railway.app",
            "description": "Production server",
        },
        {
            "url": "http://localhost:8000",
            "description": "Development server",
        },
    ],
    openapi_version="3.1.0",  # Use OpenAPI 3.1.0 for OpenAI tools compatibility
    openapi_tags=[
        {
            "name": "Health",
            "description": "Health check and readiness endpoints for monitoring",
        },
        {
            "name": "Tickets",
            "description": "Core ticket management endpoints for CustomGPT integration",
        },
        {
            "name": "Parcels",
            "description": "Parcel enrichment endpoints for GIS data analysis and comparison",
        },
        {
            "name": "Dashboard & Manual Operations",
            "description": "Dashboard endpoints for ticket viewing and manual operations",
        },
    ],
)

# CORS middleware for CustomGPT integration
# Production-ready CORS configuration
cors_origins = [
    "https://chatgpt.com",
    "https://chat.openai.com",
]

# Add development origins only in debug mode
if settings.debug:
    cors_origins.extend(
        [
            "http://localhost:*",
            "http://localhost:3000",
            "http://127.0.0.1:*",
            "http://127.0.0.1:3000",
        ]
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "User-Agent",
        "DNT",
        "Cache-Control",
        "X-Requested-With",
    ],
    expose_headers=["Content-Length", "X-Total-Count", "X-Request-ID"],
    max_age=86400,  # 24 hours for preflight cache
)

# Add production monitoring middleware
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(MetricsMiddleware)

# Include API routes
app.include_router(api_router)
app.include_router(parcel_router)
app.include_router(dashboard_router)


def convert_anyof_to_nullable(schema_dict: dict) -> dict:
    """Convert OpenAPI 3.1 anyOf with null to OpenAPI 3.0 nullable format."""
    if isinstance(schema_dict, dict):
        # Handle anyOf with null pattern
        if "anyOf" in schema_dict:
            any_of = schema_dict["anyOf"]
            if len(any_of) == 2:
                # Check if one item is null type
                null_item = None
                type_item = None
                for item in any_of:
                    if item.get("type") == "null":
                        null_item = item
                    else:
                        type_item = item

                if null_item and type_item:
                    # Convert to nullable format
                    new_schema = type_item.copy()
                    new_schema["nullable"] = True
                    # Copy over title and description from parent
                    if "title" in schema_dict:
                        new_schema["title"] = schema_dict["title"]
                    if "description" in schema_dict:
                        new_schema["description"] = schema_dict["description"]
                    return convert_anyof_to_nullable(new_schema)

        # Recursively process all dict values
        result = {}
        for key, value in schema_dict.items():
            result[key] = convert_anyof_to_nullable(value)
        return result
    elif isinstance(schema_dict, list):
        # Recursively process all list items
        return [convert_anyof_to_nullable(item) for item in schema_dict]
    else:
        return schema_dict


def custom_openapi():
    """Generate OpenAPI 3.1.0 compatible schema for OpenAI tools."""
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        servers=app.servers,
    )

    # Force OpenAPI version to 3.1.0 for OpenAI tools
    openapi_schema["openapi"] = "3.1.0"

    # Keep anyOf patterns for OpenAPI 3.1.0 compatibility
    # Do not convert to nullable format - OpenAI tools prefer anyOf
    # openapi_schema = convert_anyof_to_nullable(openapi_schema)

    # Add security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "HTTPBearer": {"type": "http", "scheme": "bearer"}
    }

    # Add top-level tags array for proper OpenAPI structure
    openapi_schema["tags"] = [
        {
            "name": "Health",
            "description": "Health check and readiness endpoints for monitoring",
        },
        {
            "name": "Tickets",
            "description": "Core ticket management endpoints for CustomGPT integration",
        },
        {
            "name": "Parcels",
            "description": "Parcel enrichment endpoints for GIS data analysis and comparison",
        },
        {
            "name": "Dashboard & Manual Operations",
            "description": "Dashboard endpoints for ticket viewing and manual operations",
        },
    ]

    # Add x-openai-isConsequential: false to all endpoints for OpenAI tools
    for path_data in openapi_schema.get("paths", {}).values():
        for method_data in path_data.values():
            if isinstance(method_data, dict) and "operationId" in method_data:
                method_data["x-openai-isConsequential"] = False

    app.openapi_schema = openapi_schema
    return app.openapi_schema


# Override the OpenAPI generation
app.openapi = custom_openapi


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Global exception handler with proper error formatting and logging."""
    import time
    import traceback

    # Generate error ID for tracking
    error_id = f"err_{int(time.time())}_{hash(str(exc)) % 10000:04d}"

    if isinstance(exc, HTTPException):
        # Handle known HTTP exceptions
        error_response = {
            "error": True,
            "message": exc.detail,
            "type": "http_error",
            "error_id": error_id,
        }

        # Log HTTP errors in production for monitoring
        if not settings.debug:
            print(
                f"HTTP Error {exc.status_code}: {exc.detail} | ID: {error_id} | Path: {request.url.path}"
            )

        return JSONResponse(
            status_code=exc.status_code,
            content=error_response,
        )

    # Handle validation errors from Pydantic
    from pydantic import ValidationError

    if isinstance(exc, ValidationError):
        error_response = {
            "error": True,
            "message": "Validation error",
            "type": "validation_error",
            "error_id": error_id,
            "details": exc.errors() if settings.debug else "Invalid input data",
        }

        if not settings.debug:
            print(
                f"Validation Error: {len(exc.errors())} field errors | ID: {error_id} | Path: {request.url.path}"
            )

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_response,
        )

    # Handle Redis connection errors gracefully
    from redis.exceptions import RedisError

    if isinstance(exc, RedisError):
        error_response = {
            "error": True,
            "message": "Session service temporarily unavailable",
            "type": "service_error",
            "error_id": error_id,
        }

        print(
            f"Redis Error: {type(exc).__name__} | ID: {error_id} | Falling back to in-memory sessions"
        )

        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=error_response,
        )

    # Handle unexpected errors
    error_response = {
        "error": True,
        "message": "Internal server error" if not settings.debug else str(exc),
        "type": "internal_error",
        "error_id": error_id,
    }

    # Enhanced logging for production debugging
    if not settings.debug:
        print(
            f"CRITICAL ERROR: {type(exc).__name__}: {str(exc)[:200]} | ID: {error_id}"
        )
        print(f"Path: {request.url.path} | Method: {request.method}")
        print(f"Headers: {dict(request.headers)}")
        if hasattr(request, "body"):
            try:
                # Try to log request body for debugging (truncated)
                body = await request.body()
                if body:
                    print(
                        f"Body (first 200 chars): {body.decode('utf-8', errors='ignore')[:200]}"
                    )
            except Exception:
                print("Could not read request body")
    else:
        # In debug mode, include full traceback
        error_response["traceback"] = traceback.format_exc()
        print(f"Debug Error: {exc}")
        traceback.print_exc()

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_response,
    )


# Health check endpoints
@app.get("/", tags=["Health"])
async def root() -> dict[str, Any]:
    """Root endpoint with basic API information."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "deployment": "2025-09-01-v2",  # Test deployment marker
        "docs_url": "/docs" if settings.debug else "disabled in production",
    }


@app.get("/health", tags=["Health"])
async def health_check() -> JSONResponse:
    """Detailed health check for monitoring."""
    # Update health check timestamp
    health_metrics.update_health_check()

    health_status: dict[str, Any] = {
        "service": settings.app_name,
        "status": "healthy",
        "version": settings.app_version,
        "components": {},
        "metrics": health_metrics.get_metrics(),
    }

    # Check Redis/Session manager
    redis_healthy = session_manager.is_connected()
    components = health_status["components"]
    if redis_healthy:
        components["redis"] = {
            "status": "healthy",
            "url": settings.redis_url,
        }
    else:
        components["redis"] = {
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

    components["storage"] = {
        "status": "healthy" if data_dirs_healthy else "unhealthy",
        "data_root": str(settings.data_root),
        "directories": {
            "tickets": str(settings.tickets_dir),
            "sessions": str(settings.sessions_dir),
            "audit": str(settings.audit_dir),
        },
    }

    # Check error rate for overall health
    metrics = health_status["metrics"]
    error_rate = metrics["error_rate"]

    # Consider unhealthy if error rate is above 10% and we have sufficient requests
    if error_rate > 0.1 and metrics["total_requests"] > 10:
        components["error_rate"] = {
            "status": "unhealthy",
            "error_rate": error_rate,
            "total_errors": metrics["total_errors"],
        }
        overall_healthy = False
    else:
        components["error_rate"] = {
            "status": "healthy",
            "error_rate": error_rate,
        }
        overall_healthy = data_dirs_healthy

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
