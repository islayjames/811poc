"""Pytest configuration and shared fixtures."""

import os
import tempfile
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.texas811_poc.config import settings
from src.texas811_poc.main import app
from src.texas811_poc.redis_client import session_manager


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Set up test environment variables."""
    os.environ["DEBUG"] = "true"
    os.environ["REDIS_URL"] = "redis://localhost:6379/1"  # Use test database


@pytest.fixture
def temp_data_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for test data."""
    with tempfile.TemporaryDirectory() as temp_dir:
        data_path = Path(temp_dir)

        # Override settings for testing
        original_data_root = settings.data_root
        original_tickets_dir = settings.tickets_dir
        original_sessions_dir = settings.sessions_dir
        original_audit_dir = settings.audit_dir

        # Set test paths
        settings.data_root = data_path
        settings.tickets_dir = data_path / "tickets"
        settings.sessions_dir = data_path / "sessions"
        settings.audit_dir = data_path / "audit"

        # Create directories
        settings.tickets_dir.mkdir(parents=True, exist_ok=True)
        settings.sessions_dir.mkdir(parents=True, exist_ok=True)
        settings.audit_dir.mkdir(parents=True, exist_ok=True)

        yield data_path

        # Restore original paths
        settings.data_root = original_data_root
        settings.tickets_dir = original_tickets_dir
        settings.sessions_dir = original_sessions_dir
        settings.audit_dir = original_audit_dir


@pytest.fixture
def client(temp_data_dir: Path) -> TestClient:
    """Create FastAPI test client with temporary data directory."""
    return TestClient(app)


@pytest.fixture
def clean_session_manager():
    """Clean session manager state between tests."""
    # Clear in-memory sessions
    session_manager._memory_store.clear()

    # If Redis is available, flush test database
    if session_manager.is_connected():
        try:
            # Only flush if we're using the test database (db 1)
            if "redis://localhost:6379/1" in settings.redis_url:
                session_manager.redis_client.flushdb()
        except Exception:
            pass  # Ignore Redis errors in testing

    yield session_manager

    # Clean up after test
    session_manager._memory_store.clear()


@pytest.fixture
def sample_ticket_data() -> dict:
    """Sample ticket data for testing."""
    return {
        "work_order_id": "WO-2024-001",
        "requester": {
            "company": "ABC Construction",
            "contact_name": "John Smith",
            "phone": "(555) 123-4567",
            "email": "john@abcconst.com",
        },
        "location": {
            "address": "123 Main St, Austin, TX 78701",
            "county": "Travis",
            "city": "Austin",
            "cross_street": "Near 2nd Street",
        },
        "work_description": "Install fiber optic cable",
        "work_type": "excavation",
        "requested_start_date": "2024-02-01",
        "ticket_type": "normal",
    }


@pytest.fixture
def sample_extraction_result() -> dict:
    """Sample PDF extraction result from CustomGPT."""
    return {
        "extraction_confidence": 0.85,
        "fields_detected": [
            "company",
            "contact_name",
            "phone",
            "address",
            "work_description",
        ],
        "gaps_identified": ["county", "cross_street", "work_start_date"],
        "raw_data": {
            "company": "XYZ Construction",
            "contact_name": "Jane Doe",
            "phone": "555-987-6543",
            "address": "456 Oak Ave, Dallas, TX 75201",
            "work_description": "Install underground utilities",
        },
    }
