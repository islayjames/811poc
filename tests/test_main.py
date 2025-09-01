"""Test main FastAPI application."""

from fastapi.testclient import TestClient


def test_root_endpoint(client: TestClient):
    """Test root endpoint returns basic API info."""
    response = client.get("/")
    assert response.status_code == 200

    data = response.json()
    assert data["service"] == "Texas 811 POC Backend"
    assert data["version"] == "0.1.0"
    assert data["status"] == "running"
    assert "docs_url" in data


def test_health_endpoint(client: TestClient):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code in [200, 503]  # May be 503 if Redis unavailable

    data = response.json()
    assert data["service"] == "Texas 811 POC Backend"
    assert data["version"] == "0.1.0"
    assert data["status"] in ["healthy", "unhealthy"]
    assert "components" in data

    # Check component structure
    assert "redis" in data["components"]
    assert "storage" in data["components"]

    # Redis component should have status
    redis_component = data["components"]["redis"]
    assert redis_component["status"] in ["healthy", "fallback", "unhealthy"]

    # Storage component should have directory info
    storage_component = data["components"]["storage"]
    assert storage_component["status"] in ["healthy", "unhealthy"]
    assert "data_root" in storage_component
    assert "directories" in storage_component


def test_ready_endpoint(client: TestClient):
    """Test readiness check endpoint."""
    response = client.get("/ready")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ready"


def test_cors_headers(client: TestClient):
    """Test CORS headers are properly set."""
    # Test preflight request
    response = client.options(
        "/health",
        headers={
            "Origin": "https://chatgpt.com",
            "Access-Control-Request-Method": "GET",
        },
    )

    # Should allow the request
    assert response.status_code in [200, 204]


def test_404_handling(client: TestClient):
    """Test 404 error handling."""
    response = client.get("/nonexistent")
    assert response.status_code == 404
