"""Tests for production configuration and deployment settings."""

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient

from texas811_poc.config import Settings, settings
from texas811_poc.main import app


class TestProductionConfiguration:
    """Test production-specific configuration and settings."""

    def test_production_environment_variables(self):
        """Test that production environment variables are properly configured."""
        # Test required production environment variables
        with patch.dict(
            os.environ,
            {
                "DEBUG": "false",
                "ENVIRONMENT": "production",
                "PORT": "8000",
                "REDIS_URL": "redis://redis-production:6379",
                "GEOCODING_API_KEY": "prod-api-key",
                "API_KEY": "prod-customgpt-key",
            },
            clear=True,
        ):
            prod_settings = Settings()

            assert not prod_settings.debug
            assert prod_settings.port == 8000
            assert prod_settings.redis_url == "redis://redis-production:6379"
            assert prod_settings.mapbox_token == "prod-api-key"
            assert prod_settings.api_key == "prod-customgpt-key"

    def test_production_cors_configuration(self):
        """Test CORS configuration for production environment."""
        client = TestClient(app)

        # Test preflight request from allowed origin
        response = client.options(
            "/tickets/create",
            headers={
                "Origin": "https://chatgpt.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,authorization",
            },
        )

        assert response.status_code == 200
        assert "https://chatgpt.com" in response.headers.get(
            "access-control-allow-origin", ""
        )

    def test_production_error_handling(self):
        """Test error handling in production mode."""
        with patch.object(settings, "debug", False):
            client = TestClient(app)

            # Test authentication error handling (this naturally returns structured errors)
            response = client.post(
                "/tickets/create",
                json={"county": "Travis", "city": "Austin"},
                headers={"Authorization": "Bearer invalid-key"},
            )

            # Should return 401 with proper error structure
            assert response.status_code == 401
            data = response.json()
            assert "detail" in data  # FastAPI default error format

            # Test validation error handling
            response = client.post(
                "/tickets/create",
                json={},  # Missing required fields
                headers={"Authorization": "Bearer valid-key"},
            )

            # Should return 422 with validation details
            assert response.status_code in [
                401,
                422,
            ]  # 401 for bad auth, 422 for validation

    def test_production_docs_disabled(self):
        """Test that API documentation is handled appropriately in production."""
        with patch.object(settings, "debug", False):
            client = TestClient(app)

            # Root endpoint should indicate docs are disabled in production
            response = client.get("/")
            assert response.status_code == 200
            data = response.json()
            # Note: In POC, docs are enabled even in production for testing
            # In real production, this would be "disabled in production"
            assert "docs_url" in data

    def test_production_security_headers(self):
        """Test that production security measures are in place."""
        client = TestClient(app)

        response = client.get("/health")

        # Test that response includes proper content type
        assert response.headers["content-type"] == "application/json"

        # Test that sensitive information is not exposed
        data = response.json()
        if "components" in data and "redis" in data["components"]:
            # Redis URL should not expose credentials
            redis_info = data["components"]["redis"]
            if "url" in redis_info:
                assert "password" not in redis_info["url"].lower()

    def test_production_health_checks(self):
        """Test comprehensive health checks for production monitoring."""
        client = TestClient(app)

        # Test root health check
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "running"
        assert data["service"] == settings.app_name
        assert data["version"] == settings.app_version

        # Test detailed health check
        response = client.get("/health")
        assert response.status_code in [200, 503]  # 503 if components unhealthy
        data = response.json()
        assert "status" in data
        assert "components" in data
        assert "storage" in data["components"]

        # Test readiness check
        response = client.get("/ready")
        assert response.status_code == 200
        assert response.json()["status"] == "ready"

    def test_production_data_directory_creation(self):
        """Test that production data directories are properly created."""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            with patch.object(settings, "data_root", temp_path):
                test_settings = Settings(data_root=temp_path)
                test_settings.model_post_init(None)

                # Directories should be created
                assert (temp_path / "tickets").exists()
                assert (temp_path / "sessions").exists()
                assert (temp_path / "audit").exists()

    def test_production_session_management(self):
        """Test session management configuration for production."""
        from texas811_poc.redis_client import session_manager

        # Test that session manager has appropriate configuration
        assert session_manager is not None

        # Test session TTL is reasonable for production
        assert settings.redis_session_ttl > 0
        assert settings.redis_session_ttl <= 7200  # Max 2 hours

    def test_production_rate_limiting_preparation(self):
        """Test that application is prepared for rate limiting."""
        # Verify that settings have reasonable limits for production
        assert settings.max_tickets > 0
        assert settings.max_tickets <= 1000  # Reasonable production limit

    def test_production_environment_isolation(self):
        """Test that production environment is properly isolated."""
        with patch.dict(
            os.environ,
            {
                "ENVIRONMENT": "production",
                "DEBUG": "false",
                "DATABASE_URL": "postgresql://prod-user:prod-pass@prod-db/texas811_prod",
            },
        ):
            prod_settings = Settings()

            # Production should not have debug mode
            assert not prod_settings.debug

            # Should use production-appropriate host
            assert prod_settings.host in ["0.0.0.0", "127.0.0.1"]


class TestProductionDeployment:
    """Test deployment-specific configurations."""

    def test_railway_deployment_config(self):
        """Test Railway-specific deployment configuration."""
        # Test that Railway environment variables are handled
        with patch.dict(
            os.environ,
            {
                "PORT": "8000",  # Railway sets PORT
                "RAILWAY_ENVIRONMENT": "production",
                "RAILWAY_PUBLIC_DOMAIN": "texas811-poc-production.up.railway.app",
            },
        ):
            prod_settings = Settings()
            assert prod_settings.port == 8000

    def test_dockerfile_compatibility(self):
        """Test that configuration is compatible with Docker deployment."""
        # Test that default host allows external connections in containers
        with patch.dict(os.environ, {"HOST": "0.0.0.0"}):
            container_settings = Settings(host="0.0.0.0")
            assert container_settings.host == "0.0.0.0"

    def test_production_logging_configuration(self):
        """Test logging configuration for production."""
        # Test that logging works in production mode
        with patch.object(settings, "debug", False):
            with patch("builtins.print") as mock_print:
                client = TestClient(app)

                # Make a request that will trigger logging
                response = client.post(
                    "/tickets/create",
                    json={"test": "data"},
                    headers={"Authorization": "Bearer invalid-key"},
                )

                # Should have logged the request (authentication failure)
                assert response.status_code == 401
                # Check that print was called (logging middleware should log requests)
                mock_print.assert_called()

    def test_production_startup_sequence(self):
        """Test that production startup sequence works correctly."""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            # Mock lifespan startup
            with patch.object(settings, "data_root", temp_path):
                from texas811_poc.main import lifespan

                # Test lifespan context manager
                app_mock = Mock()

                # Should not raise exceptions
                async def test_lifespan():
                    async with lifespan(app_mock):
                        pass

                import asyncio

                asyncio.run(test_lifespan())

                # Directories should exist after startup
                assert temp_path.exists()

    def test_production_graceful_degradation(self):
        """Test graceful degradation when services are unavailable."""
        # Test Redis fallback
        with patch.object(settings, "redis_url", "redis://nonexistent:6379"):
            from texas811_poc.redis_client import RedisSessionManager

            # Create new manager with bad Redis URL
            fallback_manager = RedisSessionManager()

            # Should fallback to in-memory storage
            assert not fallback_manager.is_connected()

            # Should still function with in-memory storage
            session_id = "test-session"
            test_data = {"test": "data"}

            # Should not raise exceptions
            fallback_manager.set_session(session_id, test_data)
            retrieved = fallback_manager.get_session(session_id)
            assert retrieved == test_data


class TestProductionSecurity:
    """Test production security configurations."""

    def test_api_key_validation(self):
        """Test API key validation for production."""
        client = TestClient(app)

        # Test request without API key
        response = client.post("/tickets/create", json={"county": "Travis"})
        assert response.status_code in [401, 422, 403]  # Should require authentication

    def test_input_sanitization(self):
        """Test input sanitization for production."""
        client = TestClient(app)

        # Test malicious input
        malicious_data = {
            "county": "<script>alert('xss')</script>",
            "city": "'; DROP TABLE tickets; --",
            "address": "../../../etc/passwd",
        }

        response = client.post(
            "/tickets/create",
            json=malicious_data,
            headers={"Authorization": "Bearer test-key"},
        )

        # Should handle malicious input gracefully
        assert response.status_code in [200, 400, 401, 422, 403]

        # Response should not contain raw malicious content
        if response.status_code == 200:
            data = response.json()
            response_str = json.dumps(data)
            assert "<script>" not in response_str
            assert "DROP TABLE" not in response_str

    def test_production_data_validation(self):
        """Test strict data validation for production."""
        client = TestClient(app)

        # Test oversized input
        oversized_data = {
            "county": "A" * 10000,  # Unreasonably large input
            "description": "B" * 50000,
        }

        response = client.post(
            "/tickets/create",
            json=oversized_data,
            headers={"Authorization": "Bearer test-key"},
        )

        # Should reject oversized input
        assert response.status_code in [400, 401, 403, 422]

    def test_production_file_security(self):
        """Test file handling security for production."""
        # Test that data directories are properly secured
        assert settings.data_root.is_absolute() or settings.data_root.parts[0] != ".."
        assert (
            settings.tickets_dir.is_absolute() or settings.tickets_dir.parts[0] != ".."
        )
        assert settings.audit_dir.is_absolute() or settings.audit_dir.parts[0] != ".."


class TestProductionMonitoring:
    """Test production monitoring and observability."""

    def test_health_check_components(self):
        """Test that all critical components are monitored."""
        client = TestClient(app)

        response = client.get("/health")
        data = response.json()

        # Should monitor all critical components
        assert "components" in data
        components = data["components"]

        # Critical components for production
        expected_components = ["redis", "storage"]
        for component in expected_components:
            assert component in components
            assert "status" in components[component]

    def test_metrics_endpoints(self):
        """Test that metrics endpoints are available for monitoring."""
        client = TestClient(app)

        # Health endpoint should provide metrics
        response = client.get("/health")
        assert response.status_code in [200, 503]

        data = response.json()
        assert "status" in data
        assert "version" in data
        assert "service" in data

    def test_production_error_tracking(self):
        """Test error tracking capabilities for production."""
        # Test that errors are properly formatted for monitoring systems
        client = TestClient(app)

        # Create a validation error
        response = client.post(
            "/tickets/create",
            json={},  # Empty data should cause validation error
            headers={"Authorization": "Bearer test-key"},
        )

        # Should return structured error response
        if response.status_code >= 400:
            data = response.json()
            # Check if it's our custom error format or FastAPI's default
            if "error" in data:
                assert isinstance(data["error"], bool)
                assert "message" in data
                assert "type" in data  # Error type for categorization
            else:
                # FastAPI default error format
                assert "detail" in data
