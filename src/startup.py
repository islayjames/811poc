#!/usr/bin/env python3
"""Startup script for Texas 811 POC Backend on Railway.

This script handles container initialization, environment setup,
and starts the FastAPI server with proper Railway configuration.
"""

import os
import sys
from pathlib import Path

import uvicorn


def setup_environment():
    """Configure environment variables for Railway deployment."""

    # Railway provides PORT environment variable
    port = int(os.getenv("PORT", "8000"))

    # Set host to 0.0.0.0 for Railway (container networking)
    host = os.getenv("HOST", "0.0.0.0")

    # Configure data root for Railway volume mount
    data_root = os.getenv("DATA_ROOT", "/data")
    if not os.path.exists(data_root):
        # Fallback to app directory if volume not mounted
        data_root = "/app/data"
        try:
            os.makedirs(data_root, exist_ok=True)
        except PermissionError:
            # Fallback to local data directory for development
            data_root = "data"
            os.makedirs(data_root, exist_ok=True)

    # Ensure data root environment variable is set for the app
    os.environ["DATA_ROOT"] = data_root

    # Production settings
    os.environ["DEBUG"] = os.getenv("DEBUG", "false")

    # Redis configuration (optional for POC)
    if not os.getenv("REDIS_URL"):
        # Default to local Redis if available, fallback to in-memory
        os.environ["REDIS_URL"] = "redis://localhost:6379/0"

    return host, port


def setup_data_directories(data_root: str):
    """Create required data directories."""
    directories = [
        f"{data_root}/tickets",
        f"{data_root}/sessions",
        f"{data_root}/audit",
    ]

    for directory in directories:
        try:
            os.makedirs(directory, exist_ok=True)
            print(f"✓ Created directory: {directory}")
        except PermissionError:
            print(f"⚠ Permission denied creating: {directory} (may be created by app)")


def validate_deployment():
    """Validate deployment requirements."""

    # Python version is validated by pyproject.toml requirements

    # Check required modules
    try:
        import fastapi
        import pydantic
        import uvicorn

        print(f"✓ FastAPI {fastapi.__version__}")
        print(f"✓ Uvicorn {uvicorn.__version__}")
        print(f"✓ Pydantic {pydantic.__version__}")
    except ImportError as e:
        print(f"ERROR: Missing required dependency: {e}")
        sys.exit(1)

    # Check application can be imported
    try:
        # Add src to path if needed
        src_path = Path(__file__).parent
        if str(src_path) not in sys.path:
            sys.path.insert(0, str(src_path))

        from texas811_poc.main import app

        print("✓ Application imported successfully")
        return app
    except ImportError as e:
        print(f"ERROR: Cannot import application: {e}")
        sys.exit(1)


def main():
    """Main startup function."""
    print("🚀 Starting Texas 811 POC Backend on Railway")

    # Setup environment
    host, port = setup_environment()
    data_root = os.getenv("DATA_ROOT", "/data")

    print(f"✓ Host: {host}")
    print(f"✓ Port: {port}")
    print(f"✓ Data root: {data_root}")
    print(f"✓ Debug mode: {os.getenv('DEBUG', 'false')}")

    # Setup directories
    setup_data_directories(data_root)

    # Validate deployment
    validate_deployment()

    print("✓ Starting uvicorn server...")

    # Start the server
    uvicorn.run(
        "texas811_poc.main:app",
        host=host,
        port=port,
        # Don't use reload in production
        reload=False,
        # Railway requires these settings
        access_log=True,
        server_header=False,
        # Graceful shutdown
        timeout_keep_alive=5,
    )


if __name__ == "__main__":
    main()
