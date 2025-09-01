"""Production logging and monitoring configuration."""

import logging
import sys
import time
from typing import Any

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from .config import settings


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all requests in production format."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        """Log request/response details for monitoring."""
        start_time = time.time()

        # Generate request ID for tracing
        request_id = f"req_{int(start_time)}_{id(request) % 10000:04d}"

        # Log request start
        if not settings.debug:
            client_ip = request.client.host if request.client else "unknown"
            print(
                f"REQUEST START: {request.method} {request.url.path} | IP: {client_ip} | ID: {request_id}"
            )

        # Process request
        response = await call_next(request)

        # Calculate processing time
        process_time = time.time() - start_time

        # Log request completion
        if not settings.debug:
            print(
                f"REQUEST END: {response.status_code} | {process_time:.3f}s | ID: {request_id}"
            )

            # Log slow requests
            if process_time > 2.0:  # Requests taking more than 2 seconds
                print(
                    f"SLOW REQUEST: {request.method} {request.url.path} took {process_time:.3f}s | ID: {request_id}"
                )

        # Add request ID to response headers for debugging
        response.headers["X-Request-ID"] = request_id

        return response


class ProductionLogger:
    """Production logging configuration."""

    @staticmethod
    def setup_logging() -> None:
        """Configure logging for production environment."""
        if settings.debug:
            # Development logging
            logging.basicConfig(
                level=logging.DEBUG,
                format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                handlers=[logging.StreamHandler(sys.stdout)],
            )
        else:
            # Production logging
            logging.basicConfig(
                level=logging.INFO,
                format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
                handlers=[logging.StreamHandler(sys.stdout)],
            )

        # Set specific logger levels
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
        logging.getLogger("fastapi").setLevel(logging.INFO)

        # Create application logger
        logger = logging.getLogger("texas811_poc")
        logger.info("Logging configuration initialized")

    @staticmethod
    def log_application_start() -> None:
        """Log application startup information."""
        logger = logging.getLogger("texas811_poc")
        logger.info(f"Starting {settings.app_name} v{settings.app_version}")
        logger.info(f"Environment: {'development' if settings.debug else 'production'}")
        logger.info(f"Data root: {settings.data_root}")
        logger.info(f"Redis URL: {settings.redis_url}")

    @staticmethod
    def log_health_status(
        component: str, status: str, details: dict[str, Any] = None
    ) -> None:
        """Log component health status changes."""
        logger = logging.getLogger("texas811_poc.health")

        message = f"Component {component}: {status}"
        if details:
            message += f" | {details}"

        if status == "healthy":
            logger.info(message)
        elif status == "unhealthy":
            logger.error(message)
        else:
            logger.warning(message)

    @staticmethod
    def log_api_metrics(
        endpoint: str, method: str, status_code: int, duration: float
    ) -> None:
        """Log API performance metrics."""
        if not settings.debug:
            logger = logging.getLogger("texas811_poc.metrics")
            logger.info(f"API {method} {endpoint} | {status_code} | {duration:.3f}s")

    @staticmethod
    def log_security_event(event_type: str, details: dict[str, Any]) -> None:
        """Log security-related events."""
        logger = logging.getLogger("texas811_poc.security")
        logger.warning(f"Security event: {event_type} | {details}")

    @staticmethod
    def log_business_event(
        event: str,
        session_id: str = None,
        ticket_id: str = None,
        details: dict[str, Any] = None,
    ) -> None:
        """Log business logic events for audit trail."""
        logger = logging.getLogger("texas811_poc.business")

        message_parts = [f"Business event: {event}"]

        if session_id:
            message_parts.append(f"Session: {session_id}")

        if ticket_id:
            message_parts.append(f"Ticket: {ticket_id}")

        if details:
            message_parts.append(f"Details: {details}")

        logger.info(" | ".join(message_parts))


class HealthMetrics:
    """Simple metrics collection for production monitoring."""

    def __init__(self):
        self.request_count = 0
        self.error_count = 0
        self.last_error_time = None
        self.last_health_check = None
        self.slow_requests = 0

    def increment_requests(self) -> None:
        """Increment total request counter."""
        self.request_count += 1

    def increment_errors(self) -> None:
        """Increment error counter and record timestamp."""
        self.error_count += 1
        self.last_error_time = time.time()

    def increment_slow_requests(self) -> None:
        """Increment slow request counter."""
        self.slow_requests += 1

    def update_health_check(self) -> None:
        """Update last health check timestamp."""
        self.last_health_check = time.time()

    def get_metrics(self) -> dict[str, Any]:
        """Get current metrics snapshot."""
        return {
            "total_requests": self.request_count,
            "total_errors": self.error_count,
            "error_rate": (
                (self.error_count / self.request_count) if self.request_count > 0 else 0
            ),
            "slow_requests": self.slow_requests,
            "last_error_time": self.last_error_time,
            "last_health_check": self.last_health_check,
            "uptime_seconds": time.time() - (self.last_health_check or time.time()),
        }


# Global metrics instance
health_metrics = HealthMetrics()


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware to collect basic application metrics."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        """Collect metrics for each request."""
        start_time = time.time()

        # Increment request counter
        health_metrics.increment_requests()

        try:
            response = await call_next(request)

            # Calculate processing time
            process_time = time.time() - start_time

            # Track slow requests
            if process_time > 2.0:
                health_metrics.increment_slow_requests()

            # Track errors
            if response.status_code >= 400:
                health_metrics.increment_errors()

            # Log metrics for specific endpoints
            if request.url.path.startswith("/api/"):
                ProductionLogger.log_api_metrics(
                    endpoint=request.url.path,
                    method=request.method,
                    status_code=response.status_code,
                    duration=process_time,
                )

            return response

        except Exception as exc:
            # Track unhandled errors
            health_metrics.increment_errors()
            raise exc


def setup_production_monitoring() -> None:
    """Initialize production monitoring and logging."""
    ProductionLogger.setup_logging()
    ProductionLogger.log_application_start()

    logger = logging.getLogger("texas811_poc")
    logger.info("Production monitoring initialized")
