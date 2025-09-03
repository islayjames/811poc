"""
Simple integration tests for Response Retrieval API endpoint.

Tests the GET /tickets/{ticket_id}/responses endpoint using real storage.
This approach avoids complex mocking and tests the actual integration.
"""

import pytest
from fastapi.testclient import TestClient
from texas811_poc.main import app


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def auth_headers():
    """Authentication headers for API requests."""
    return {"Authorization": "Bearer test-api-key-12345"}


class TestResponseRetrievalAPISimple:
    """Simple integration tests for GET /tickets/{ticket_id}/responses endpoint."""

    def test_successful_response_retrieval_integration(self, client, auth_headers):
        """Test successful retrieval of responses using actual storage."""
        # Create a real ticket first
        ticket_data = {
            "session_id": "test-response-retrieval-123",
            "county": "Harris",
            "city": "Houston",
            "address": "123 Response Test St",
            "work_description": "Response retrieval test installation",
        }

        # Create ticket
        create_response = client.post(
            "/tickets/create", headers=auth_headers, json=ticket_data
        )
        assert create_response.status_code == 201
        ticket_id = create_response.json()["ticket_id"]

        # Submit some responses to the ticket
        response1_data = {
            "member_name": "AT&T",
            "status": "clear",
            "facilities": "2 telecommunication lines running east-west",
            "comment": "Lines marked with white paint.",
            "user_name": "John Smith",
        }

        response2_data = {
            "member_name": "Oncor Electric",
            "status": "not_clear",
            "facilities": "1 electric line crossing work area",
            "comment": "Line conflicts with excavation.",
            "user_name": "Jane Doe",
        }

        # Submit responses
        resp1 = client.post(
            f"/tickets/{ticket_id}/responses/ATT",
            headers=auth_headers,
            json=response1_data,
        )
        assert resp1.status_code in [200, 201]

        resp2 = client.post(
            f"/tickets/{ticket_id}/responses/ONCOR",
            headers=auth_headers,
            json=response2_data,
        )
        assert resp2.status_code in [200, 201]

        # Now test retrieval
        retrieval_response = client.get(
            f"/tickets/{ticket_id}/responses", headers=auth_headers
        )

        # Verify response
        assert retrieval_response.status_code == 200
        data = retrieval_response.json()

        assert data["ticket_id"] == ticket_id
        assert len(data["responses"]) == 2

        # Verify responses content
        response_codes = {r["member_code"] for r in data["responses"]}
        assert response_codes == {"ATT", "ONCOR"}

        # Verify summary statistics
        summary = data["summary"]
        assert summary["total_received"] == 2
        assert summary["clear_count"] == 1
        assert summary["not_clear_count"] == 1

    def test_response_retrieval_no_responses(self, client, auth_headers):
        """Test response retrieval for ticket with no responses yet."""
        # Create a real ticket without responses
        ticket_data = {
            "session_id": "test-no-responses-456",
            "county": "Dallas",
            "city": "Dallas",
            "address": "456 No Response St",
            "work_description": "Test ticket with no responses",
        }

        # Create ticket
        create_response = client.post(
            "/tickets/create", headers=auth_headers, json=ticket_data
        )
        assert create_response.status_code == 201
        ticket_id = create_response.json()["ticket_id"]

        # Retrieve responses (should be empty)
        retrieval_response = client.get(
            f"/tickets/{ticket_id}/responses", headers=auth_headers
        )

        # Verify response
        assert retrieval_response.status_code == 200
        data = retrieval_response.json()

        assert data["ticket_id"] == ticket_id
        assert len(data["responses"]) == 0

        # Verify summary for no responses
        summary = data["summary"]
        assert summary["total_received"] == 0
        assert summary["clear_count"] == 0
        assert summary["not_clear_count"] == 0

    def test_response_retrieval_ticket_not_found(self, client, auth_headers):
        """Test response retrieval for non-existent ticket."""
        # Try to retrieve responses for non-existent ticket
        response = client.get(
            "/tickets/nonexistent-ticket-id/responses", headers=auth_headers
        )

        # Verify 404 error
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()

    def test_response_sorting_by_date(self, client, auth_headers):
        """Test that responses are sorted chronologically by response_date."""
        # Create ticket
        ticket_data = {
            "session_id": "test-sorting-789",
            "county": "Travis",
            "city": "Austin",
            "address": "789 Sorting Test St",
            "work_description": "Test response sorting",
        }

        create_response = client.post(
            "/tickets/create", headers=auth_headers, json=ticket_data
        )
        assert create_response.status_code == 201
        ticket_id = create_response.json()["ticket_id"]

        # Submit responses with deliberate time gaps (they'll be submitted in order anyway)
        members = ["MEMBER_C", "MEMBER_A", "MEMBER_B"]
        for i, member_code in enumerate(members):
            response_data = {
                "member_name": f"Member {member_code[-1]}",
                "status": "clear",
                "facilities": f"Test facilities {i}",
                "user_name": f"User {i}",
            }

            resp = client.post(
                f"/tickets/{ticket_id}/responses/{member_code}",
                headers=auth_headers,
                json=response_data,
            )
            assert resp.status_code in [200, 201]

        # Retrieve responses
        retrieval_response = client.get(
            f"/tickets/{ticket_id}/responses", headers=auth_headers
        )
        assert retrieval_response.status_code == 200

        data = retrieval_response.json()

        # Verify responses are returned (order will be by submission time)
        assert len(data["responses"]) == 3
        response_codes = [r["member_code"] for r in data["responses"]]

        # They should be in submission order
        assert response_codes == ["MEMBER_C", "MEMBER_A", "MEMBER_B"]

    def test_authentication_required(self, client):
        """Test that authentication is required for response retrieval."""
        response = client.get("/tickets/test/responses")
        assert response.status_code in [
            401,
            403,
        ]  # Either is acceptable for missing auth

    def test_invalid_api_key(self, client):
        """Test rejection of invalid API key."""
        headers = {"Authorization": "Bearer invalid-key"}
        response = client.get("/tickets/test/responses", headers=headers)
        assert response.status_code in [401, 403]

    def test_integration_workflow(self, client, auth_headers):
        """Test complete integration workflow: create ticket, submit responses, retrieve."""
        # 1. Create ticket
        ticket_data = {
            "session_id": "test-integration-workflow",
            "county": "Tarrant",
            "city": "Fort Worth",
            "address": "Integration Test Ave",
            "work_description": "Full integration workflow test",
        }

        create_response = client.post(
            "/tickets/create", headers=auth_headers, json=ticket_data
        )
        assert create_response.status_code == 201
        ticket_id = create_response.json()["ticket_id"]

        # 2. Initially no responses
        initial_response = client.get(
            f"/tickets/{ticket_id}/responses", headers=auth_headers
        )
        assert initial_response.status_code == 200
        assert len(initial_response.json()["responses"]) == 0

        # 3. Submit first response
        response_data = {
            "member_name": "Test Member",
            "status": "clear",
            "facilities": "No conflicts found",
            "user_name": "Integration Test User",
        }

        submit_response = client.post(
            f"/tickets/{ticket_id}/responses/TEST_MEMBER",
            headers=auth_headers,
            json=response_data,
        )
        assert submit_response.status_code in [200, 201]

        # 4. Verify response appears in retrieval
        final_response = client.get(
            f"/tickets/{ticket_id}/responses", headers=auth_headers
        )
        assert final_response.status_code == 200

        data = final_response.json()
        assert len(data["responses"]) == 1
        assert data["responses"][0]["member_code"] == "TEST_MEMBER"
        assert data["responses"][0]["status"] == "clear"

        # 5. Verify summary
        summary = data["summary"]
        assert summary["total_received"] == 1
        assert summary["clear_count"] == 1
        assert summary["not_clear_count"] == 0
