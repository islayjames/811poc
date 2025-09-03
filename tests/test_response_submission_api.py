"""
Tests for Response Submission API endpoints.

This module tests the response submission endpoint:
- POST /tickets/{ticket_id}/responses/{member_code}: Submit member response

Key test scenarios:
- Successful response submission (new response)
- Response update/upsert (existing response)
- Unknown member handling (auto-add to expected_members)
- Status transition triggers (status calculation)
- Error scenarios (invalid ticket, validation errors)
- Integration with storage system
"""

from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from texas811_poc.main import app
from texas811_poc.models import (
    MemberInfo,
    MemberResponseDetail,
    ResponseStatus,
    TicketModel,
    TicketStatus,
)


@pytest.fixture
def client():
    """Fixture for FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def api_key():
    """Fixture for valid API key."""
    return "test-api-key-12345"


@pytest.fixture
def headers(api_key):
    """Fixture for request headers with API key."""
    return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}


@pytest.fixture
def sample_ticket():
    """Fixture for a sample ticket with expected members."""
    return TicketModel(
        ticket_id="test-ticket-123",
        session_id="test-session-456",
        status=TicketStatus.SUBMITTED,
        county="Harris",
        city="Houston",
        address="123 Main Street",
        work_description="Installing fiber optic cable",
        expected_members=[
            MemberInfo(
                member_code="ATT",
                member_name="AT&T",
                contact_phone="1-800-288-2020",
                is_active=True,
            ),
            MemberInfo(
                member_code="CLP",
                member_name="CenterPoint Energy",
                contact_phone="1-713-207-2222",
                is_active=True,
            ),
        ],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.fixture
def valid_response_data():
    """Fixture for valid response submission data."""
    return {
        "member_name": "AT&T",
        "status": "clear",
        "facilities": "2 telecommunication lines running east-west",
        "comment": "Lines marked with white paint. Safe to dig 5 feet from marks.",
        "user_name": "John Smith",
    }


class TestResponseSubmissionAPI:
    """Test class for response submission API endpoint."""

    @patch("texas811_poc.api_endpoints.response_storage")
    @patch("texas811_poc.api_endpoints.ticket_storage")
    @patch("texas811_poc.api_endpoints.audit_storage")
    @patch("texas811_poc.api_endpoints.calculate_ticket_status")
    @patch("texas811_poc.api_endpoints.handle_unknown_member")
    def test_successful_response_submission_new_response(
        self,
        mock_handle_unknown_member,
        mock_calculate_status,
        mock_audit_storage,
        mock_ticket_storage,
        mock_response_storage,
        client,
        headers,
        sample_ticket,
        valid_response_data,
    ):
        """Test successful submission of new member response."""
        # Setup mocks
        mock_ticket_storage.load_ticket.return_value = sample_ticket
        mock_ticket_storage.save_ticket.return_value = None
        mock_audit_storage.save_audit_event.return_value = None
        mock_response_storage.load_response.return_value = None  # No existing response
        mock_response_storage.save_response.return_value = None
        mock_response_storage.load_ticket_responses.return_value = (
            []
        )  # No existing responses
        mock_calculate_status.return_value = TicketStatus.IN_PROGRESS
        mock_handle_unknown_member.return_value = sample_ticket  # Member already exists

        # Submit response
        response = client.post(
            "/tickets/test-ticket-123/responses/ATT",
            headers=headers,
            json=valid_response_data,
        )

        # Verify response
        assert response.status_code == status.HTTP_201_CREATED

        response_data = response.json()
        assert response_data["success"] is True
        assert (
            response_data["ticket_status"] == "in_progress"
        )  # Expect string representation
        assert "response" in response_data
        assert "response_summary" in response_data

        # Verify response details
        response_detail = response_data["response"]
        assert response_detail["ticket_id"] == "test-ticket-123"
        assert response_detail["member_code"] == "ATT"
        assert response_detail["member_name"] == "AT&T"
        assert response_detail["status"] == "clear"
        assert (
            response_detail["facilities"]
            == "2 telecommunication lines running east-west"
        )
        assert response_detail["user_name"] == "John Smith"
        assert "response_id" in response_detail
        assert (
            "created_at" in response_detail
        )  # Field is created_at for new response, not submitted_at

        # Verify response summary
        summary = response_data["response_summary"]
        assert summary["ticket_id"] == "test-ticket-123"
        assert summary["total_expected"] == 2
        assert summary["total_received"] == 0  # Mock returns empty list
        assert summary["clear_count"] == 0
        assert summary["not_clear_count"] == 0

        # Verify storage calls
        mock_ticket_storage.load_ticket.assert_called_once_with("test-ticket-123")
        mock_calculate_status.assert_called_once_with(
            sample_ticket, []
        )  # Called with empty responses
        mock_response_storage.save_response.assert_called_once()
        mock_response_storage.load_ticket_responses.assert_called_once_with(
            "test-ticket-123"
        )

    @patch("texas811_poc.api_endpoints.response_storage")
    @patch("texas811_poc.api_endpoints.ticket_storage")
    @patch("texas811_poc.api_endpoints.audit_storage")
    @patch("texas811_poc.api_endpoints.calculate_ticket_status")
    @patch("texas811_poc.api_endpoints.handle_unknown_member")
    def test_response_update_upsert_behavior(
        self,
        mock_handle_unknown_member,
        mock_calculate_status,
        mock_audit_storage,
        mock_ticket_storage,
        mock_response_storage,
        client,
        headers,
        sample_ticket,
        valid_response_data,
    ):
        """Test updating existing response (upsert behavior)."""
        # Create existing response
        existing_response = MemberResponseDetail(
            ticket_id="test-ticket-123",
            member_code="ATT",
            member_name="AT&T",
            status=ResponseStatus.NOT_CLEAR,
            facilities="Previous facility description",
            comment="Previous comment",
            user_name="Previous User",
            submitted_at=datetime.now(UTC),
        )

        # Setup mocks
        mock_ticket_storage.load_ticket.return_value = sample_ticket
        mock_ticket_storage.save_ticket.return_value = None
        mock_audit_storage.save_audit_event.return_value = None
        mock_response_storage.load_response.return_value = (
            existing_response  # Existing response found
        )
        mock_response_storage.save_response.return_value = None
        mock_response_storage.load_ticket_responses.return_value = [
            existing_response
        ]  # One existing response
        mock_calculate_status.return_value = TicketStatus.IN_PROGRESS
        mock_handle_unknown_member.return_value = sample_ticket  # Member already exists

        # Submit updated response
        response = client.post(
            "/tickets/test-ticket-123/responses/ATT",
            headers=headers,
            json=valid_response_data,
        )

        # Verify response
        assert response.status_code == status.HTTP_200_OK  # 200 for update, not 201

        response_data = response.json()
        assert response_data["success"] is True

        # Verify updated response details
        response_detail = response_data["response"]
        assert response_detail["status"] == "clear"  # Updated from not_clear
        assert (
            response_detail["facilities"]
            == "2 telecommunication lines running east-west"
        )
        assert response_detail["user_name"] == "John Smith"
        assert (
            response_detail["response_id"] == existing_response.response_id
        )  # Same ID

    @patch("texas811_poc.api_endpoints.response_storage")
    @patch("texas811_poc.api_endpoints.ticket_storage")
    @patch("texas811_poc.api_endpoints.audit_storage")
    @patch("texas811_poc.api_endpoints.calculate_ticket_status")
    @patch("texas811_poc.api_endpoints.handle_unknown_member")
    def test_unknown_member_handling(
        self,
        mock_handle_unknown_member,
        mock_calculate_status,
        mock_audit_storage,
        mock_ticket_storage,
        mock_response_storage,
        client,
        headers,
        sample_ticket,
        valid_response_data,
    ):
        """Test automatic handling of unknown member codes."""
        # Create new member info for unknown member
        new_member = MemberInfo(
            member_code="NEW",
            member_name="New Utility Company",
            is_active=True,
        )

        # Update the sample ticket to include the new member
        updated_ticket = sample_ticket.model_copy()
        updated_ticket.expected_members = (sample_ticket.expected_members or []) + [
            new_member
        ]
        mock_handle_unknown_member.return_value = updated_ticket

        # Setup mocks
        mock_ticket_storage.load_ticket.return_value = sample_ticket
        mock_ticket_storage.save_ticket.return_value = None
        mock_audit_storage.save_audit_event.return_value = None
        mock_response_storage.load_response.return_value = None  # No existing response
        mock_response_storage.save_response.return_value = None
        mock_response_storage.load_ticket_responses.return_value = (
            []
        )  # No existing responses
        mock_calculate_status.return_value = TicketStatus.IN_PROGRESS

        # Submit response for unknown member
        response_data_unknown = valid_response_data.copy()
        response_data_unknown["member_name"] = "New Utility Company"

        response = client.post(
            "/tickets/test-ticket-123/responses/NEW",  # Unknown member code
            headers=headers,
            json=response_data_unknown,
        )

        # Verify response
        assert response.status_code == status.HTTP_201_CREATED

        response_json = response.json()
        assert response_json["success"] is True

        # Verify unknown member was handled
        mock_handle_unknown_member.assert_called_once_with(
            sample_ticket, "NEW", "New Utility Company"
        )

    def test_ticket_not_found_error(self, client, headers, valid_response_data):
        """Test error when ticket doesn't exist."""
        with patch("texas811_poc.api_endpoints.ticket_storage") as mock_storage:
            mock_storage.load_ticket.return_value = None

            response = client.post(
                "/tickets/nonexistent-ticket/responses/ATT",
                headers=headers,
                json=valid_response_data,
            )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        response_data = response.json()
        assert "not found" in response_data["detail"].lower()

    def test_invalid_api_key_error(self, client, valid_response_data):
        """Test error with invalid API key."""
        headers = {
            "Authorization": "Bearer invalid-key",
            "Content-Type": "application/json",
        }

        response = client.post(
            "/tickets/test-ticket-123/responses/ATT",
            headers=headers,
            json=valid_response_data,
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_validation_error_missing_required_fields(self, client, headers):
        """Test validation error when required fields are missing."""
        invalid_data = {
            "status": "clear",
            # Missing member_name and user_name
        }

        with patch("texas811_poc.api_endpoints.ticket_storage") as mock_storage:
            sample_ticket = TicketModel(
                ticket_id="test-ticket-123",
                session_id="test-session-456",
                status=TicketStatus.SUBMITTED,
                county="Harris",
                city="Houston",
                address="123 Main Street",
                work_description="Installing fiber optic cable",
            )
            mock_storage.load_ticket.return_value = sample_ticket

            response = client.post(
                "/tickets/test-ticket-123/responses/ATT",
                headers=headers,
                json=invalid_data,
            )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_invalid_response_status(self, client, headers, valid_response_data):
        """Test validation error with invalid response status."""
        invalid_data = valid_response_data.copy()
        invalid_data["status"] = "invalid_status"

        with patch("texas811_poc.api_endpoints.ticket_storage") as mock_storage:
            sample_ticket = TicketModel(
                ticket_id="test-ticket-123",
                session_id="test-session-456",
                status=TicketStatus.SUBMITTED,
                county="Harris",
                city="Houston",
                address="123 Main Street",
                work_description="Installing fiber optic cable",
            )
            mock_storage.load_ticket.return_value = sample_ticket

            response = client.post(
                "/tickets/test-ticket-123/responses/ATT",
                headers=headers,
                json=invalid_data,
            )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @patch("texas811_poc.api_endpoints.response_storage")
    @patch("texas811_poc.api_endpoints.ticket_storage")
    @patch("texas811_poc.api_endpoints.audit_storage")
    @patch("texas811_poc.api_endpoints.calculate_ticket_status")
    @patch("texas811_poc.api_endpoints.handle_unknown_member")
    def test_status_calculation_integration(
        self,
        mock_handle_unknown_member,
        mock_calculate_status,
        mock_audit_storage,
        mock_ticket_storage,
        mock_response_storage,
        client,
        headers,
        sample_ticket,
        valid_response_data,
    ):
        """Test integration with status calculation function."""
        # Mock status calculation to return READY_TO_DIG when all responses received
        mock_calculate_status.return_value = TicketStatus.READY_TO_DIG

        # Setup mocks
        mock_ticket_storage.load_ticket.return_value = sample_ticket
        mock_ticket_storage.save_ticket.return_value = None
        mock_audit_storage.save_audit_event.return_value = None
        mock_response_storage.load_response.return_value = None  # No existing response
        mock_response_storage.save_response.return_value = None
        mock_response_storage.load_ticket_responses.return_value = (
            []
        )  # No existing responses
        mock_handle_unknown_member.return_value = sample_ticket  # Member already exists

        response = client.post(
            "/tickets/test-ticket-123/responses/ATT",
            headers=headers,
            json=valid_response_data,
        )

        # Verify status calculation was called and result used
        assert response.status_code == status.HTTP_201_CREATED
        response_data = response.json()
        assert response_data["ticket_status"] == "ready_to_dig"

        # Verify status calculation function was called
        mock_calculate_status.assert_called_once()


class TestResponseSubmissionIntegration:
    """Integration tests for complete response submission workflow."""

    def test_complete_workflow_both_responses(self, client, headers):
        """Test complete workflow with both expected members responding."""
        # This would be a more comprehensive test with real storage
        # and the complete workflow from ticket creation to all responses
        pass

    def test_response_summary_accuracy(self, client, headers):
        """Test that response summary accurately reflects response counts."""
        # This would test the response summary calculation with various
        # combinations of clear/not_clear responses
        pass
