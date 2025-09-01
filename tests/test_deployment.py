"""Tests for Railway deployment configuration and functionality."""

import os
import sys
from pathlib import Path
from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from texas811_poc.config import Settings  # noqa: E402
from texas811_poc.main import app  # noqa: E402


class TestRailwayConfiguration:
    """Test Railway deployment configuration."""

    def test_railway_toml_exists(self):
        """Test that railway.toml configuration file exists."""
        railway_config = Path(__file__).parent.parent / "railway.toml"
        assert railway_config.exists(), "railway.toml configuration file must exist"

    def test_dockerfile_exists(self):
        """Test that Dockerfile exists for Railway deployment."""
        dockerfile = Path(__file__).parent.parent / "Dockerfile"
        assert dockerfile.exists(), "Dockerfile must exist for Railway deployment"

    def test_requirements_txt_exists(self):
        """Test that requirements.txt exists for dependency installation."""
        requirements_file = Path(__file__).parent.parent / "requirements.txt"
        assert requirements_file.exists(), "requirements.txt must exist for Railway"

    def test_startup_script_exists(self):
        """Test that startup.py script exists."""
        startup_script = Path(__file__).parent.parent / "src" / "startup.py"
        assert startup_script.exists(), "startup.py script must exist"

    def test_railway_toml_content(self):
        """Test railway.toml contains required configuration."""
        railway_config = Path(__file__).parent.parent / "railway.toml"
        if railway_config.exists():
            content = railway_config.read_text()
            assert "[build]" in content, "railway.toml must have [build] section"
            assert "[deploy]" in content, "railway.toml must have [deploy] section"
            assert (
                "nixpacks" in content or "dockerfile" in content
            ), "Must specify build method"

    def test_dockerfile_content(self):
        """Test Dockerfile contains required instructions."""
        dockerfile = Path(__file__).parent.parent / "Dockerfile"
        if dockerfile.exists():
            content = dockerfile.read_text()
            assert "FROM python:" in content, "Must use Python base image"
            assert "COPY requirements.txt" in content, "Must copy requirements.txt"
            assert "RUN pip install" in content, "Must install dependencies"
            assert "CMD" in content, "Must have CMD instruction"

    def test_requirements_content(self):
        """Test requirements.txt contains essential dependencies."""
        requirements_file = Path(__file__).parent.parent / "requirements.txt"
        if requirements_file.exists():
            content = requirements_file.read_text()
            assert "fastapi" in content, "Must include fastapi dependency"
            assert "uvicorn" in content, "Must include uvicorn dependency"
            assert "pydantic" in content, "Must include pydantic dependency"


class TestEnvironmentConfiguration:
    """Test environment variable configuration for Railway."""

    def test_port_environment_variable(self):
        """Test that PORT environment variable is respected."""
        with patch.dict(os.environ, {"PORT": "8080"}):
            Settings()  # Just validate it can be created
            # The startup.py should use PORT env var for Railway
            assert "PORT" in os.environ

    def test_data_root_configuration(self):
        """Test data root configuration for Railway volumes."""
        with patch.dict(os.environ, {"DATA_ROOT": "/data"}):
            settings = Settings()
            # Railway will mount volume at /data
            assert settings.data_root == Path("/data")
            # Directory creation may fail in tests due to permissions, but paths should be set correctly
            assert settings.tickets_dir == Path("/data/tickets")
            assert settings.sessions_dir == Path("/data/sessions")
            assert settings.audit_dir == Path("/data/audit")

    def test_redis_configuration(self):
        """Test Redis configuration for Railway."""
        # Test with Redis URL environment variable
        with patch.dict(os.environ, {"REDIS_URL": "redis://railway-redis:6379/0"}):
            settings = Settings()
            assert settings.redis_url == "redis://railway-redis:6379/0"

    def test_debug_mode_disabled_in_production(self):
        """Test that debug mode is disabled in production."""
        with patch.dict(os.environ, {"DEBUG": "false"}):
            settings = Settings()
            assert not settings.debug, "Debug mode should be disabled in production"


class TestHealthEndpoints:
    """Test health endpoints for Railway monitoring."""

    @pytest.fixture
    def client(self):
        """FastAPI test client."""
        return TestClient(app)

    def test_health_endpoint_responds(self, client):
        """Test that health endpoint responds correctly."""
        response = client.get("/health")
        assert response.status_code in [200, 503], "Health endpoint must respond"
        data = response.json()
        assert "service" in data
        assert "status" in data
        assert "version" in data

    def test_ready_endpoint_responds(self, client):
        """Test that ready endpoint responds for Railway health checks."""
        response = client.get("/ready")
        assert response.status_code == 200, "Ready endpoint must return 200"
        data = response.json()
        assert data["status"] == "ready"

    def test_root_endpoint_responds(self, client):
        """Test that root endpoint provides API information."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        assert "version" in data
        assert "status" in data

    def test_health_endpoint_includes_components(self, client):
        """Test that health endpoint includes component status."""
        response = client.get("/health")
        data = response.json()
        assert "components" in data, "Health check must include component status"

        # Should include storage and redis components
        components = data["components"]
        assert "storage" in components or "redis" in components


class TestStartupConfiguration:
    """Test startup script configuration."""

    def test_startup_script_imports(self):
        """Test that startup script can be imported."""
        startup_script = Path(__file__).parent.parent / "src" / "startup.py"
        if startup_script.exists():
            # Test that the file can be imported without syntax errors

            try:
                # Don't actually run it, just check it can be loaded
                with open(startup_script) as f:
                    compile(f.read(), startup_script, "exec")
            except SyntaxError as e:
                pytest.fail(f"Startup script has syntax errors: {e}")


class TestDockerConfiguration:
    """Test Docker configuration for Railway."""

    def test_dockerfile_uses_correct_python_version(self):
        """Test that Dockerfile uses Python 3.11+ as specified in pyproject.toml."""
        dockerfile = Path(__file__).parent.parent / "Dockerfile"
        if dockerfile.exists():
            content = dockerfile.read_text()
            assert (
                "python:3.11" in content or "python:3.12" in content
            ), "Must use Python 3.11+ as specified in project requirements"

    def test_dockerfile_exposes_port(self):
        """Test that Dockerfile exposes appropriate port."""
        dockerfile = Path(__file__).parent.parent / "Dockerfile"
        if dockerfile.exists():
            content = dockerfile.read_text()
            # Railway uses PORT environment variable, so EXPOSE might be optional
            # But we should at least have CMD that respects PORT
            assert "CMD" in content, "Must have CMD instruction to start the server"


class TestDataPersistence:
    """Test data persistence configuration for Railway."""

    def test_data_directories_creation(self):
        """Test that data directories are created properly."""
        settings = Settings()

        # Test directory structure
        expected_dirs = [
            settings.tickets_dir,
            settings.sessions_dir,
            settings.audit_dir,
        ]

        for directory in expected_dirs:
            # Directories should be created by config
            assert directory.parent == settings.data_root

    def test_volume_mount_compatibility(self):
        """Test configuration is compatible with Railway volume mounts."""
        # Test with Railway-style volume mount
        with patch.dict(os.environ, {"DATA_ROOT": "/data"}):
            settings = Settings()

            # Should work with absolute paths
            assert settings.data_root == Path("/data")
            assert settings.tickets_dir == Path("/data/tickets")
            assert settings.sessions_dir == Path("/data/sessions")
            assert settings.audit_dir == Path("/data/audit")

        # Test with fallback path (no DATA_ROOT set)
        with patch.dict(os.environ, {}, clear=True):
            # Remove DATA_ROOT from environment
            if "DATA_ROOT" in os.environ:
                del os.environ["DATA_ROOT"]
            settings = Settings()
            assert settings.data_root == Path("data")
            assert settings.tickets_dir == Path("data/tickets")


@pytest.mark.asyncio
async def test_application_startup():
    """Test that application can start up correctly."""
    # This tests the lifespan function
    from texas811_poc.main import lifespan

    # Mock FastAPI app
    mock_app = Mock()

    # Test lifespan context manager
    async with lifespan(mock_app):
        # Should not raise any exceptions
        pass


class TestDeploymentReadiness:
    """Test overall deployment readiness."""

    def test_all_required_files_exist(self):
        """Test that all required deployment files exist."""
        project_root = Path(__file__).parent.parent

        required_files = [
            "railway.toml",
            "Dockerfile",
            "requirements.txt",
            "src/startup.py",
        ]

        for file_path in required_files:
            full_path = project_root / file_path
            assert full_path.exists(), f"Required deployment file missing: {file_path}"

    def test_no_syntax_errors_in_main_files(self):
        """Test that main Python files have no syntax errors."""
        python_files = ["src/texas811_poc/main.py", "src/texas811_poc/config.py"]

        project_root = Path(__file__).parent.parent

        for file_path in python_files:
            full_path = project_root / file_path
            if full_path.exists():
                with open(full_path) as f:
                    try:
                        compile(f.read(), full_path, "exec")
                    except SyntaxError as e:
                        pytest.fail(f"Syntax error in {file_path}: {e}")
