"""Redis client with graceful fallback for session management."""

import json
import logging
from datetime import datetime, timedelta
from typing import Any

import redis

from .config import settings

logger = logging.getLogger(__name__)


class RedisSessionManager:
    """Redis-based session manager with fallback to in-memory storage."""

    def __init__(self) -> None:
        self.redis_client: redis.Redis | None = None
        self._memory_store: dict[str, dict[str, Any]] = {}
        self._connect()

    def _connect(self) -> None:
        """Initialize Redis connection with error handling."""
        try:
            self.redis_client = redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
            )
            # Test connection
            self.redis_client.ping()
            logger.info(f"✓ Redis connected at {settings.redis_url}")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            logger.info("Falling back to in-memory session storage")
            self.redis_client = None

    def is_connected(self) -> bool:
        """Check if Redis connection is active."""
        if not self.redis_client:
            return False
        try:
            self.redis_client.ping()
            return True
        except Exception:
            return False

    def set_session(
        self, session_id: str, data: dict[str, Any], ttl: int | None = None
    ) -> bool:
        """Store session data with optional TTL."""
        if not ttl:
            ttl = settings.redis_session_ttl

        session_data = {
            "data": data,
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(seconds=ttl)).isoformat(),
        }

        if self.redis_client and self.is_connected():
            try:
                session_key = f"session:{session_id}"
                self.redis_client.setex(
                    session_key, ttl, json.dumps(session_data, default=str)
                )
                return True
            except Exception as e:
                logger.error(f"Redis session store failed: {e}")
                # Fallback to memory

        # In-memory fallback
        self._memory_store[session_id] = session_data
        logger.debug(f"Session {session_id} stored in memory")
        return True

    def get_session(self, session_id: str) -> dict[str, Any] | None:
        """Retrieve session data."""
        if self.redis_client and self.is_connected():
            try:
                session_key = f"session:{session_id}"
                session_json = self.redis_client.get(session_key)
                if session_json:
                    session_data = json.loads(session_json)
                    # Check expiration (Redis should handle this, but double-check)
                    expires_at = datetime.fromisoformat(session_data["expires_at"])
                    if datetime.utcnow() <= expires_at:
                        return session_data["data"]
                return None
            except Exception as e:
                logger.error(f"Redis session retrieval failed: {e}")

        # In-memory fallback
        if session_id in self._memory_store:
            session_data = self._memory_store[session_id]
            expires_at = datetime.fromisoformat(session_data["expires_at"])
            if datetime.utcnow() <= expires_at:
                return session_data["data"]
            else:
                # Expired - clean up
                del self._memory_store[session_id]

        return None

    def delete_session(self, session_id: str) -> bool:
        """Delete session data."""
        if self.redis_client and self.is_connected():
            try:
                session_key = f"session:{session_id}"
                self.redis_client.delete(session_key)
                return True
            except Exception as e:
                logger.error(f"Redis session deletion failed: {e}")

        # In-memory fallback
        if session_id in self._memory_store:
            del self._memory_store[session_id]
            return True

        return False

    def list_sessions(self) -> list[str]:
        """List all active session IDs (for debugging/monitoring)."""
        session_ids = []

        if self.redis_client and self.is_connected():
            try:
                session_keys = self.redis_client.keys("session:*")
                session_ids.extend(
                    [key.replace("session:", "") for key in session_keys]
                )
            except Exception as e:
                logger.error(f"Redis session listing failed: {e}")

        # Add in-memory sessions
        now = datetime.utcnow()
        for session_id, session_data in self._memory_store.items():
            expires_at = datetime.fromisoformat(session_data["expires_at"])
            if now <= expires_at:
                if session_id not in session_ids:
                    session_ids.append(session_id)

        return session_ids

    def cleanup_expired(self) -> int:
        """Clean up expired in-memory sessions (Redis handles its own TTL)."""
        if not self._memory_store:
            return 0

        now = datetime.utcnow()
        expired_keys = []

        for session_id, session_data in self._memory_store.items():
            expires_at = datetime.fromisoformat(session_data["expires_at"])
            if now > expires_at:
                expired_keys.append(session_id)

        for key in expired_keys:
            del self._memory_store[key]

        if expired_keys:
            logger.info(f"Cleaned up {len(expired_keys)} expired in-memory sessions")

        return len(expired_keys)


# Global session manager instance
session_manager = RedisSessionManager()
