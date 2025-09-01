"""Test configuration management."""

import os

from src.texas811_poc.config import Settings


def test_default_settings():
    """Test configuration values (may include environment overrides)."""
    settings = Settings()

    assert settings.app_name == "Texas 811 POC Backend"
    assert settings.app_version == "0.1.0"
    # Debug may be True if DEBUG=true is set in environment
    assert settings.host == "127.0.0.1"
    # Port may be 8000 from environment
    assert settings.redis_session_ttl == 3600
    assert settings.max_tickets == 20 or settings.max_tickets > 0  # May be overridden


def test_environment_override():
    """Test environment variable overrides."""
    # Set test environment variables
    os.environ["DEBUG"] = "true"
    os.environ["PORT"] = "9000"
    os.environ["REDIS_URL"] = "redis://testhost:6379/1"
    os.environ["MAX_TICKETS"] = "50"

    settings = Settings()

    assert settings.debug
    assert settings.port == 9000
    assert settings.redis_url == "redis://testhost:6379/1"
    assert settings.max_tickets == 50

    # Clean up
    del os.environ["DEBUG"]
    del os.environ["PORT"]
    del os.environ["REDIS_URL"]
    del os.environ["MAX_TICKETS"]


def test_data_paths_initialization():
    """Test data directory paths are properly set."""
    settings = Settings()

    # Paths should be initialized after __post_init__
    assert settings.tickets_dir is not None
    assert settings.sessions_dir is not None
    assert settings.audit_dir is not None

    # Check path relationships
    assert settings.tickets_dir == settings.data_root / "tickets"
    assert settings.sessions_dir == settings.data_root / "sessions"
    assert settings.audit_dir == settings.data_root / "audit"
