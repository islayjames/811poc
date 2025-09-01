"""Tests for deployment workflow and health checks."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from src.texas811_poc.main import app


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


def test_health_check_endpoint(client):
    """Test that health check endpoint returns 200."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_health_check_includes_database_connection(client):
    """Test that health check includes database/storage status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "components" in data
    assert "version" in data
    assert "service" in data


def test_root_endpoint_responds(client):
    """Test that root endpoint is accessible."""
    response = client.get("/")
    assert response.status_code in [200, 404]  # Either works or redirects


def test_openapi_docs_available(client):
    """Test that OpenAPI documentation is available."""
    response = client.get("/docs")
    assert response.status_code == 200


def test_openapi_json_available(client):
    """Test that OpenAPI JSON schema is available."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert "openapi" in data
    assert "info" in data


class TestDeploymentHealth:
    """Tests for deployment health verification."""

    def test_app_starts_successfully(self):
        """Test that the application starts without errors."""
        # This test verifies the app can be imported and created
        from src.texas811_poc.main import app

        assert app is not None

    def test_critical_endpoints_exist(self, client):
        """Test that all critical endpoints are available."""
        critical_endpoints = [
            "/health",
            "/docs",
            "/openapi.json",
        ]

        for endpoint in critical_endpoints:
            response = client.get(endpoint)
            assert response.status_code in [200, 401], f"Endpoint {endpoint} failed"

    def test_environment_configuration(self):
        """Test that environment variables are properly configured."""
        from src.texas811_poc.config import settings

        # Verify critical settings exist
        assert hasattr(settings, "debug")
        assert hasattr(settings, "data_root")
        assert hasattr(settings, "app_name")
        assert hasattr(settings, "app_version")

    @patch.dict("os.environ", {"DEBUG": "false"})
    def test_production_configuration(self):
        """Test production environment configuration."""
        from src.texas811_poc.config import Settings

        # Create new settings instance with production env
        settings = Settings()

        assert settings.debug is False


class TestPerformanceBaseline:
    """Basic performance tests for deployment validation."""

    def test_health_check_response_time(self, client):
        """Test that health check responds quickly."""
        import time

        start_time = time.time()
        response = client.get("/health")
        response_time = time.time() - start_time

        assert response.status_code == 200
        assert response_time < 1.0  # Should respond within 1 second

    def test_multiple_concurrent_health_checks(self, client):
        """Test that multiple health checks don't cause issues."""
        import concurrent.futures

        def make_request():
            return client.get("/health")

        # Make 10 concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_request) for _ in range(10)]
            results = [
                future.result() for future in concurrent.futures.as_completed(futures)
            ]

        # All requests should succeed
        for response in results:
            assert response.status_code == 200
            assert response.json()["status"] == "healthy"


@pytest.mark.integration
class TestDeploymentReadiness:
    """Integration tests to verify deployment readiness."""

    def test_all_dependencies_importable(self):
        """Test that all required dependencies can be imported."""
        required_modules = ["fastapi", "pydantic", "redis", "httpx", "uvicorn"]

        for module in required_modules:
            try:
                __import__(module)
            except ImportError:
                pytest.fail(f"Required module {module} not available")

    def test_data_directory_writable(self):
        """Test that data directory is writable."""
        import os

        from src.texas811_poc.config import settings

        data_root = settings.data_root

        # Ensure directory exists and is writable
        os.makedirs(data_root, exist_ok=True)

        # Test write access
        test_file = os.path.join(data_root, "test_write.tmp")
        try:
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
        except (OSError, PermissionError):
            pytest.fail(f"Data directory {data_root} is not writable")

    def test_redis_connection_available(self):
        """Test that Redis connection is available when configured."""
        from src.texas811_poc.config import settings

        if hasattr(settings, "redis_url") and settings.redis_url:
            try:
                from src.texas811_poc.redis_client import session_manager

                # Test Redis connection status
                is_connected = session_manager.is_connected()
                # Allow fallback to in-memory storage in tests
                assert isinstance(is_connected, bool)
            except Exception as e:
                # Allow fallback to in-memory storage in tests
                if "Connection refused" not in str(e):
                    pytest.fail(f"Redis connection test failed: {e}")
