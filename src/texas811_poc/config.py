"""Configuration management for Texas 811 POC."""

from pathlib import Path
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # App configuration
    app_name: str = "Texas 811 POC Backend"
    app_version: str = "0.1.0"
    debug: bool = Field(default=False)

    # Server configuration
    host: str = Field(default="127.0.0.1")
    port: int = Field(default=8000)

    # Redis configuration
    redis_url: str = Field(default="redis://localhost:6379/0")
    redis_session_ttl: int = Field(default=3600)  # 1 hour

    # Data storage paths
    data_root: Path = Field(default=Path("data"))
    tickets_dir: Path = Path("data/tickets")
    sessions_dir: Path = Path("data/sessions")
    audit_dir: Path = Path("data/audit")

    # External API configuration
    mapbox_token: str | None = Field(default=None, alias="GEOCODING_API_KEY")

    # API security
    api_key: str | None = Field(default=None, alias="API_KEY")

    # POC limits
    max_tickets: int = Field(default=20)

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",  # Ignore extra environment variables
        "env_prefix": "",  # No prefix for environment variables
    }

    def model_post_init(self, __context: dict[str, Any] | None) -> None:
        """Initialize computed paths after model creation (Pydantic v2)."""
        # Update paths based on data_root
        self.tickets_dir = self.data_root / "tickets"
        self.sessions_dir = self.data_root / "sessions"
        self.audit_dir = self.data_root / "audit"

        # Ensure directories exist
        for directory in [self.tickets_dir, self.sessions_dir, self.audit_dir]:
            directory.mkdir(parents=True, exist_ok=True)


# Global settings instance
settings = Settings()
