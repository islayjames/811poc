"""Test Redis session manager."""

from datetime import UTC, datetime, timedelta

from src.texas811_poc.redis_client import RedisSessionManager


def test_session_manager_initialization():
    """Test session manager initializes properly."""
    manager = RedisSessionManager()

    # Should always have a valid manager instance
    assert manager is not None
    assert hasattr(manager, "_memory_store")
    assert isinstance(manager._memory_store, dict)


def test_memory_fallback_session_operations(clean_session_manager):
    """Test session operations using in-memory fallback."""
    manager = clean_session_manager

    session_id = "test-session-123"
    session_data = {
        "user_id": "user123",
        "workflow_step": "validation",
        "ticket_draft": {"company": "Test Corp"},
    }

    # Test session creation
    result = manager.set_session(session_id, session_data, ttl=300)
    assert result

    # Test session retrieval
    retrieved_data = manager.get_session(session_id)
    assert retrieved_data == session_data

    # Test session listing
    session_ids = manager.list_sessions()
    assert session_id in session_ids

    # Test session deletion
    result = manager.delete_session(session_id)
    assert result

    # Verify deletion
    retrieved_data = manager.get_session(session_id)
    assert retrieved_data is None


def test_session_expiration(clean_session_manager):
    """Test session expiration handling."""
    manager = clean_session_manager

    session_id = "expiring-session"
    session_data = {"test": "data"}

    # Create session with very short TTL
    manager.set_session(session_id, session_data, ttl=1)

    # Should be retrievable immediately
    retrieved = manager.get_session(session_id)
    assert retrieved == session_data

    # Manually expire the session by modifying the stored data
    if session_id in manager._memory_store:
        manager._memory_store[session_id]["expires_at"] = (
            datetime.now(UTC) - timedelta(seconds=1)
        ).isoformat()

    # Should now be None (expired)
    retrieved = manager.get_session(session_id)
    assert retrieved is None


def test_cleanup_expired_sessions(clean_session_manager):
    """Test cleanup of expired sessions."""
    manager = clean_session_manager

    # Create some sessions
    manager.set_session("active-session", {"data": "active"}, ttl=300)
    manager.set_session("expired-session", {"data": "expired"}, ttl=1)

    # Manually expire one session
    if "expired-session" in manager._memory_store:
        manager._memory_store["expired-session"]["expires_at"] = (
            datetime.now(UTC) - timedelta(seconds=1)
        ).isoformat()

    # Run cleanup
    cleaned_count = manager.cleanup_expired()

    # Should have cleaned up 1 session
    assert cleaned_count == 1

    # Active session should still exist
    assert manager.get_session("active-session") is not None
    assert manager.get_session("expired-session") is None


def test_session_data_serialization():
    """Test that complex session data is properly handled."""
    manager = RedisSessionManager()

    complex_data = {
        "nested": {"deep": {"data": "value"}},
        "list": [1, 2, 3],
        "datetime": datetime.now(UTC).isoformat(),
        "boolean": True,
        "null_value": None,
    }

    session_id = "complex-session"
    result = manager.set_session(session_id, complex_data)
    assert result

    retrieved = manager.get_session(session_id)
    assert retrieved == complex_data
