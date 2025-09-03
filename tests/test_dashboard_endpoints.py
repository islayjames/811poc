"""
Comprehensive test suite for dashboard endpoints and ticket management.

This module tests all dashboard endpoints for manual ticket management:
- GET /tickets with filtering and pagination
- GET /tickets/{ticket_id} detailed view with audit history
- POST /tickets/{ticket_id}/mark-submitted for submission tracking
- POST /tickets/{ticket_id}/mark-responses-in for response tracking
- DELETE /tickets/{ticket_id} for ticket cancellation
- Countdown calculations and compliance deadlines

Focus on manual operations for compliance officers and field managers.
"""

from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from texas811_poc.main import app
from texas811_poc.models import (
    AuditAction,
    AuditEventModel,
    TicketModel,
    TicketStatus,
)
from texas811_poc.storage import create_storage_instances

# Test client setup
client = TestClient(app)

# Test API key
TEST_API_KEY = "test-api-key-12345"
AUTH_HEADERS = {"Authorization": f"Bearer {TEST_API_KEY}"}

# Test data directory (isolated for testing)
TEST_DATA_ROOT = Path("test_data/dashboard_test")


@pytest.fixture(autouse=True)
def setup_test_storage(monkeypatch):
    """Set up isolated test storage for each test."""
    # Clean up any existing test data
    if TEST_DATA_ROOT.exists():
        import shutil

        shutil.rmtree(TEST_DATA_ROOT)

    # Create fresh test storage
    TEST_DATA_ROOT.mkdir(parents=True, exist_ok=True)

    # Patch the dashboard endpoints to use test storage
    from texas811_poc.storage import create_storage_instances

    test_storage = create_storage_instances(TEST_DATA_ROOT)

    # Patch the global storage instances in dashboard_endpoints
    monkeypatch.setattr(
        "texas811_poc.dashboard_endpoints.ticket_storage", test_storage[0]
    )
    monkeypatch.setattr(
        "texas811_poc.dashboard_endpoints.audit_storage", test_storage[1]
    )
    monkeypatch.setattr(
        "texas811_poc.dashboard_endpoints.response_storage", test_storage[2]
    )
    monkeypatch.setattr(
        "texas811_poc.dashboard_endpoints.backup_manager", test_storage[3]
    )

    yield

    # Cleanup after test
    if TEST_DATA_ROOT.exists():
        import shutil

        shutil.rmtree(TEST_DATA_ROOT)


@pytest.fixture
def sample_tickets():
    """Create sample tickets for dashboard testing."""
    ticket_storage, audit_storage, response_storage, backup_manager = (
        create_storage_instances(TEST_DATA_ROOT)
    )

    # Create tickets with different statuses and dates
    tickets_data = [
        {
            "ticket_id": "dash-test-001",
            "session_id": "session-001",
            "status": TicketStatus.DRAFT,
            "county": "Harris",
            "city": "Houston",
            "address": "123 Main St",
            "work_description": "Install fiber cable",
            "created_at": datetime.now(UTC) - timedelta(days=3),
            "updated_at": datetime.now(UTC) - timedelta(days=2),
        },
        {
            "ticket_id": "dash-test-002",
            "session_id": "session-002",
            "status": TicketStatus.VALIDATED,
            "county": "Dallas",
            "city": "Dallas",
            "address": "456 Oak Ave",
            "work_description": "Water line repair",
            "caller_name": "John Smith",
            "caller_company": "Smith Plumbing",
            "created_at": datetime.now(UTC) - timedelta(days=2),
            "updated_at": datetime.now(UTC) - timedelta(days=1),
            "lawful_start_date": date.today() + timedelta(days=2),
            "ticket_expires_date": date.today() + timedelta(days=16),
        },
        {
            "ticket_id": "dash-test-003",
            "session_id": "session-003",
            "status": TicketStatus.READY,
            "county": "Travis",
            "city": "Austin",
            "address": "789 Pine Rd",
            "work_description": "Gas line installation",
            "caller_name": "Jane Doe",
            "caller_company": "Doe Construction",
            "created_at": datetime.now(UTC) - timedelta(days=5),
            "updated_at": datetime.now(UTC) - timedelta(hours=12),
            "lawful_start_date": date.today() + timedelta(days=3),
            "ticket_expires_date": date.today() + timedelta(days=17),
            "submission_packet": {"test": "data"},
        },
        {
            "ticket_id": "dash-test-004",
            "session_id": "session-004",
            "status": TicketStatus.SUBMITTED,
            "county": "Harris",
            "city": "Houston",
            "address": "321 Elm St",
            "work_description": "Electrical conduit",
            "submitted_at": datetime.now(UTC) - timedelta(hours=6),
            "created_at": datetime.now(UTC) - timedelta(days=1),
            "updated_at": datetime.now(UTC) - timedelta(hours=6),
            "lawful_start_date": date.today() + timedelta(days=1),
            "ticket_expires_date": date.today() + timedelta(days=15),
        },
    ]

    tickets = []
    for ticket_data in tickets_data:
        ticket = TicketModel(**ticket_data)
        ticket_storage.save_ticket(ticket)
        tickets.append(ticket)

        # Create audit history for some tickets
        if ticket.ticket_id in ["dash-test-002", "dash-test-003", "dash-test-004"]:
            audit_event = AuditEventModel(
                ticket_id=ticket.ticket_id,
                action=AuditAction.TICKET_CREATED,
                user_id=ticket.session_id,
                details={"created_via": "test_fixture"},
            )
            audit_storage.save_audit_event(audit_event)

            if ticket.status == TicketStatus.SUBMITTED:
                submit_audit = AuditEventModel(
                    ticket_id=ticket.ticket_id,
                    action=AuditAction.TICKET_SUBMITTED,
                    user_id="dashboard_user",
                    details={"submitted_via": "manual_dashboard"},
                    timestamp=ticket.submitted_at,
                )
                audit_storage.save_audit_event(submit_audit)

    return tickets


class TestDashboardListEndpoints:
    """Test cases for ticket listing and filtering endpoints."""

    def test_get_tickets_basic_list(self, sample_tickets):
        """Test basic ticket listing without filters."""
        response = client.get("/dashboard/tickets", headers=AUTH_HEADERS)

        assert response.status_code == 200
        data = response.json()

        assert "tickets" in data
        assert "total_count" in data
        assert "page" in data
        assert "page_size" in data
        assert len(data["tickets"]) == 4
        assert data["total_count"] == 4

        # Verify tickets are sorted by updated_at desc (most recent first)
        tickets = data["tickets"]
        for i in range(len(tickets) - 1):
            assert tickets[i]["updated_at"] >= tickets[i + 1]["updated_at"]

    def test_get_tickets_with_status_filter(self, sample_tickets):
        """Test filtering tickets by status."""
        # Filter for READY status
        response = client.get("/dashboard/tickets?status=ready", headers=AUTH_HEADERS)

        assert response.status_code == 200
        data = response.json()

        assert len(data["tickets"]) == 1
        assert data["tickets"][0]["status"] == "ready"
        assert data["tickets"][0]["ticket_id"] == "dash-test-003"

    def test_get_tickets_with_county_filter(self, sample_tickets):
        """Test filtering tickets by county."""
        # Filter for Harris County
        response = client.get("/dashboard/tickets?county=Harris", headers=AUTH_HEADERS)

        assert response.status_code == 200
        data = response.json()

        assert len(data["tickets"]) == 2
        for ticket in data["tickets"]:
            assert ticket["county"] == "Harris"

    def test_get_tickets_with_date_range_filter(self, sample_tickets):
        """Test filtering tickets by creation date range."""
        # Filter for tickets created in last 6 days (should include dash-test-003 created 5 days ago)
        six_days_ago = (datetime.now(UTC) - timedelta(days=6)).isoformat()

        response = client.get(
            f"/dashboard/tickets?created_since={six_days_ago}", headers=AUTH_HEADERS
        )

        assert response.status_code == 200
        data = response.json()

        # Should return all 4 tickets as they're all created within the last 6 days
        assert len(data["tickets"]) == 4

    def test_get_tickets_with_pagination(self, sample_tickets):
        """Test ticket pagination."""
        # Get first page with limit 2
        response = client.get(
            "/dashboard/tickets?limit=2&offset=0", headers=AUTH_HEADERS
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["tickets"]) == 2
        assert data["total_count"] == 4
        assert data["page_size"] == 2

        # Get second page
        response = client.get(
            "/dashboard/tickets?limit=2&offset=2", headers=AUTH_HEADERS
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["tickets"]) == 2
        assert data["total_count"] == 4

    def test_get_tickets_multiple_filters(self, sample_tickets):
        """Test combining multiple filters."""
        # Filter by county and status
        response = client.get(
            "/dashboard/tickets?county=Harris&status=submitted", headers=AUTH_HEADERS
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["tickets"]) == 1
        assert data["tickets"][0]["county"] == "Harris"
        assert data["tickets"][0]["status"] == "submitted"
        assert data["tickets"][0]["ticket_id"] == "dash-test-004"

    def test_get_tickets_empty_results(self, sample_tickets):
        """Test filtering that returns no results."""
        # Filter for non-existent county
        response = client.get(
            "/dashboard/tickets?county=NonExistent", headers=AUTH_HEADERS
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["tickets"]) == 0
        assert data["total_count"] == 0

    def test_get_tickets_invalid_status_filter(self, sample_tickets):
        """Test invalid status filter."""
        response = client.get(
            "/dashboard/tickets?status=invalid_status", headers=AUTH_HEADERS
        )

        # Should return empty results, not error
        assert response.status_code == 200
        data = response.json()
        assert len(data["tickets"]) == 0


class TestTicketDetailEndpoint:
    """Test cases for detailed ticket view endpoint."""

    def test_get_ticket_detail_basic(self, sample_tickets):
        """Test getting basic ticket details."""
        response = client.get("/dashboard/tickets/dash-test-002", headers=AUTH_HEADERS)

        assert response.status_code == 200
        data = response.json()

        assert data["ticket_id"] == "dash-test-002"
        assert data["status"] == "validated"
        assert data["county"] == "Dallas"
        assert data["caller_name"] == "John Smith"
        assert "audit_history" in data
        assert "countdown_info" in data

    def test_get_ticket_detail_with_audit_history(self, sample_tickets):
        """Test ticket detail includes complete audit history."""
        response = client.get("/dashboard/tickets/dash-test-004", headers=AUTH_HEADERS)

        assert response.status_code == 200
        data = response.json()

        assert data["ticket_id"] == "dash-test-004"
        assert "audit_history" in data

        # Should have creation and submission audit events
        audit_history = data["audit_history"]
        assert len(audit_history) >= 2

        actions = [event["action"] for event in audit_history]
        assert "ticket_created" in actions
        assert "ticket_submitted" in actions

    def test_get_ticket_detail_countdown_calculations(self, sample_tickets):
        """Test countdown calculations in ticket detail."""
        response = client.get("/dashboard/tickets/dash-test-002", headers=AUTH_HEADERS)

        assert response.status_code == 200
        data = response.json()

        countdown_info = data["countdown_info"]
        assert "days_until_start" in countdown_info
        assert "days_until_expiry" in countdown_info
        assert "status_description" in countdown_info

        # Verify countdown calculations
        lawful_start = date.fromisoformat(data["lawful_start_date"])
        days_until_start = (lawful_start - date.today()).days
        assert countdown_info["days_until_start"] == days_until_start

    def test_get_ticket_detail_not_found(self, sample_tickets):
        """Test getting non-existent ticket."""
        response = client.get(
            "/dashboard/tickets/non-existent-id", headers=AUTH_HEADERS
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_ticket_detail_without_auth(self, sample_tickets):
        """Test getting ticket detail without authentication."""
        response = client.get("/dashboard/tickets/dash-test-001")

        assert response.status_code in [401, 403]


class TestManualStateTransitions:
    """Test cases for manual ticket state transition endpoints."""

    def test_mark_ticket_submitted(self, sample_tickets):
        """Test manually marking ticket as submitted."""
        # Mark READY ticket as submitted
        response = client.post(
            "/dashboard/tickets/dash-test-003/mark-submitted",
            headers=AUTH_HEADERS,
            json={"submission_reference": "TX811-2024-001234"},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["ticket_id"] == "dash-test-003"
        assert data["old_status"] == "ready"
        assert data["new_status"] == "submitted"
        assert data["submitted_at"] is not None
        assert data["submission_reference"] == "TX811-2024-001234"

        # Verify audit event was created
        assert "audit_event_created" in data
        assert data["audit_event_created"] is True

    def test_mark_submitted_invalid_status(self, sample_tickets):
        """Test marking non-ready ticket as submitted."""
        # Try to mark DRAFT ticket as submitted
        response = client.post(
            "/dashboard/tickets/dash-test-001/mark-submitted",
            headers=AUTH_HEADERS,
            json={"submission_reference": "TX811-2024-001235"},
        )

        assert response.status_code == 400
        assert "cannot be marked as submitted" in response.json()["detail"].lower()

    def test_mark_responses_in(self, sample_tickets):
        """Test manually marking positive responses received."""
        # First, mark a ticket as submitted
        client.post(
            "/dashboard/tickets/dash-test-003/mark-submitted",
            headers=AUTH_HEADERS,
            json={"submission_reference": "TX811-2024-001236"},
        )

        # Now mark responses as in
        response = client.post(
            "/dashboard/tickets/dash-test-003/mark-responses-in",
            headers=AUTH_HEADERS,
            json={
                "response_count": 5,
                "all_clear": True,
                "notes": "All utilities responded with clear to dig",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["old_status"] == "submitted"
        assert data["new_status"] == "responses_in"
        assert data["response_count"] == 5
        assert data["all_clear"] is True

    def test_mark_responses_in_invalid_status(self, sample_tickets):
        """Test marking responses for non-submitted ticket."""
        response = client.post(
            "/dashboard/tickets/dash-test-002/mark-responses-in",
            headers=AUTH_HEADERS,
            json={"response_count": 3, "all_clear": True},
        )

        assert response.status_code == 400
        assert "must be submitted" in response.json()["detail"].lower()

    def test_ticket_state_transition_not_found(self, sample_tickets):
        """Test state transition on non-existent ticket."""
        response = client.post(
            "/dashboard/tickets/non-existent/mark-submitted",
            headers=AUTH_HEADERS,
            json={"submission_reference": "TX811-2024-001237"},
        )

        assert response.status_code == 404


class TestTicketCancellation:
    """Test cases for ticket cancellation and deletion endpoints."""

    def test_cancel_draft_ticket(self, sample_tickets):
        """Test cancelling a draft ticket."""
        response = client.request(
            "DELETE",
            "/dashboard/tickets/dash-test-001",
            headers=AUTH_HEADERS,
            json={"reason": "Customer cancelled project"},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["ticket_id"] == "dash-test-001"
        assert data["action"] == "cancelled"
        assert data["reason"] == "Customer cancelled project"

        # Verify ticket status was changed to cancelled
        detail_response = client.get(
            "/dashboard/tickets/dash-test-001", headers=AUTH_HEADERS
        )
        assert detail_response.status_code == 200
        assert detail_response.json()["status"] == "cancelled"

    def test_delete_cancelled_ticket(self, sample_tickets):
        """Test deleting a cancelled ticket."""
        # First cancel the ticket
        client.request(
            "DELETE",
            "/dashboard/tickets/dash-test-001",
            headers=AUTH_HEADERS,
            json={"reason": "Test cancellation"},
        )

        # Now delete it permanently
        response = client.request(
            "DELETE",
            "/dashboard/tickets/dash-test-001?permanent=true",
            headers=AUTH_HEADERS,
            json={"confirm_deletion": True},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["action"] == "deleted"

        # Verify ticket is gone
        detail_response = client.get(
            "/dashboard/tickets/dash-test-001", headers=AUTH_HEADERS
        )
        assert detail_response.status_code == 404

    def test_cannot_delete_active_ticket(self, sample_tickets):
        """Test that active tickets cannot be deleted directly."""
        response = client.request(
            "DELETE",
            "/dashboard/tickets/dash-test-003?permanent=true",
            headers=AUTH_HEADERS,
            json={"confirm_deletion": True},
        )

        assert response.status_code == 400
        assert "must be cancelled first" in response.json()["detail"].lower()

    def test_cancel_submitted_ticket_requires_reason(self, sample_tickets):
        """Test that submitted tickets require detailed cancellation reason."""
        response = client.request(
            "DELETE",
            "/dashboard/tickets/dash-test-004",
            headers=AUTH_HEADERS,
            json={"reason": ""},
        )

        assert response.status_code == 422  # Pydantic validation error
        error_detail = str(response.json()["detail"])
        assert "reason" in error_detail.lower()


class TestCountdownCalculations:
    """Test cases for countdown and compliance date calculations."""

    def test_countdown_days_until_start(self, sample_tickets):
        """Test calculation of days until lawful start."""
        response = client.get("/dashboard/tickets/dash-test-002", headers=AUTH_HEADERS)

        assert response.status_code == 200
        data = response.json()

        countdown_info = data["countdown_info"]
        lawful_start = date.fromisoformat(data["lawful_start_date"])
        expected_days = max(0, (lawful_start - date.today()).days)

        assert countdown_info["days_until_start"] == expected_days
        assert countdown_info["can_start_today"] == (expected_days == 0)

    def test_countdown_days_until_expiry(self, sample_tickets):
        """Test calculation of days until ticket expiry."""
        response = client.get("/dashboard/tickets/dash-test-002", headers=AUTH_HEADERS)

        assert response.status_code == 200
        data = response.json()

        countdown_info = data["countdown_info"]
        expiry_date = date.fromisoformat(data["ticket_expires_date"])
        expected_days = max(0, (expiry_date - date.today()).days)

        assert countdown_info["days_until_expiry"] == expected_days
        assert countdown_info["is_expired"] == (expected_days == 0)

    def test_countdown_status_descriptions(self, sample_tickets):
        """Test status-specific countdown descriptions."""
        # Test VALIDATED ticket
        response = client.get("/dashboard/tickets/dash-test-002", headers=AUTH_HEADERS)
        assert response.status_code == 200
        validated_countdown = response.json()["countdown_info"]
        assert (
            "ready for submission" in validated_countdown["status_description"].lower()
        )

        # Test READY ticket
        response = client.get("/dashboard/tickets/dash-test-003", headers=AUTH_HEADERS)
        assert response.status_code == 200
        ready_countdown = response.json()["countdown_info"]
        assert "awaiting submission" in ready_countdown["status_description"].lower()

        # Test SUBMITTED ticket
        response = client.get("/dashboard/tickets/dash-test-004", headers=AUTH_HEADERS)
        assert response.status_code == 200
        submitted_countdown = response.json()["countdown_info"]
        assert "submitted" in submitted_countdown["status_description"].lower()

    def test_urgent_ticket_countdown(self, sample_tickets):
        """Test countdown for urgent tickets (start date soon)."""
        # Create a ticket with lawful start tomorrow
        tomorrow = date.today() + timedelta(days=1)

        from texas811_poc.storage import create_storage_instances

        ticket_storage, _, _ = create_storage_instances(TEST_DATA_ROOT)

        urgent_ticket = TicketModel(
            ticket_id="urgent-test-001",
            session_id="urgent-session",
            county="Travis",
            city="Austin",
            address="999 Urgent St",
            work_description="Emergency repair",
            status=TicketStatus.READY,
            lawful_start_date=tomorrow,
            ticket_expires_date=tomorrow + timedelta(days=14),
        )
        ticket_storage.save_ticket(urgent_ticket)

        response = client.get(
            "/dashboard/tickets/urgent-test-001", headers=AUTH_HEADERS
        )
        assert response.status_code == 200

        countdown_info = response.json()["countdown_info"]
        assert countdown_info["days_until_start"] == 1
        assert countdown_info["is_urgent"] is True
        assert "urgent" in countdown_info["status_description"].lower()


class TestDashboardErrorHandling:
    """Test cases for error handling and edge cases."""

    def test_unauthorized_access(self, sample_tickets):
        """Test all endpoints require authentication."""
        # Test all dashboard endpoints without auth
        endpoints = [
            ("GET", "/dashboard/tickets"),
            ("GET", "/dashboard/tickets/dash-test-001"),
            ("POST", "/dashboard/tickets/dash-test-001/mark-submitted"),
            ("POST", "/dashboard/tickets/dash-test-001/mark-responses-in"),
            ("DELETE", "/dashboard/tickets/dash-test-001"),
        ]

        for method, endpoint in endpoints:
            if method == "GET":
                response = client.get(endpoint)
            elif method == "POST":
                response = client.post(endpoint, json={})
            elif method == "DELETE":
                response = client.request("DELETE", endpoint, json={})

            assert response.status_code in [401, 403]

    def test_invalid_api_key(self, sample_tickets):
        """Test endpoints with invalid API key."""
        bad_headers = {"Authorization": "Bearer invalid-key"}

        response = client.get("/dashboard/tickets", headers=bad_headers)
        assert response.status_code in [401, 403]

    def test_malformed_requests(self, sample_tickets):
        """Test handling of malformed request data."""
        # Test invalid JSON for state transitions
        response = client.post(
            "/dashboard/tickets/dash-test-003/mark-submitted",
            headers=AUTH_HEADERS,
            json={"invalid": "data", "missing": "submission_reference"},
        )

        assert response.status_code == 422  # Validation error

    def test_large_pagination_request(self, sample_tickets):
        """Test handling of oversized pagination requests."""
        response = client.get("/dashboard/tickets?limit=10000", headers=AUTH_HEADERS)

        # FastAPI should return validation error for limit > 100
        assert response.status_code == 422

    def test_invalid_date_filters(self, sample_tickets):
        """Test handling of invalid date format filters."""
        response = client.get(
            "/dashboard/tickets?created_since=invalid-date-format", headers=AUTH_HEADERS
        )

        assert response.status_code == 400
        assert "invalid date format" in response.json()["detail"].lower()


class TestDashboardIntegration:
    """Test cases for dashboard integration scenarios."""

    def test_full_ticket_lifecycle_via_dashboard(self, sample_tickets):
        """Test complete ticket lifecycle management through dashboard."""
        # Start with a READY ticket
        ticket_id = "dash-test-003"

        # 1. Get initial ticket details
        response = client.get(f"/dashboard/tickets/{ticket_id}", headers=AUTH_HEADERS)
        assert response.status_code == 200
        assert response.json()["status"] == "ready"

        # 2. Mark as submitted
        submit_response = client.post(
            f"/dashboard/tickets/{ticket_id}/mark-submitted",
            headers=AUTH_HEADERS,
            json={"submission_reference": "TX811-LIFECYCLE-001"},
        )
        assert submit_response.status_code == 200
        assert submit_response.json()["new_status"] == "submitted"

        # 3. Mark responses in
        responses_response = client.post(
            f"/dashboard/tickets/{ticket_id}/mark-responses-in",
            headers=AUTH_HEADERS,
            json={"response_count": 3, "all_clear": True, "notes": "All clear"},
        )
        assert responses_response.status_code == 200
        assert responses_response.json()["new_status"] == "responses_in"

        # 4. Verify final state and audit trail
        final_response = client.get(
            f"/dashboard/tickets/{ticket_id}", headers=AUTH_HEADERS
        )
        assert final_response.status_code == 200
        final_data = final_response.json()

        assert final_data["status"] == "responses_in"
        audit_history = final_data["audit_history"]

        # Should have audit events for all transitions
        actions = [event["action"] for event in audit_history]
        assert "ticket_submitted" in actions
        assert "responses_received" in actions

    def test_dashboard_search_and_filter_workflow(self, sample_tickets):
        """Test realistic dashboard search and filtering workflow."""
        # 1. Get all tickets
        all_response = client.get("/dashboard/tickets", headers=AUTH_HEADERS)
        assert all_response.status_code == 200
        assert len(all_response.json()["tickets"]) == 4

        # 2. Filter by county
        county_response = client.get(
            "/dashboard/tickets?county=Harris", headers=AUTH_HEADERS
        )
        assert county_response.status_code == 200
        assert len(county_response.json()["tickets"]) == 2

        # 3. Further filter by status
        filtered_response = client.get(
            "/dashboard/tickets?county=Harris&status=submitted", headers=AUTH_HEADERS
        )
        assert filtered_response.status_code == 200
        assert len(filtered_response.json()["tickets"]) == 1

        # 4. Get detail for filtered ticket
        ticket = filtered_response.json()["tickets"][0]
        detail_response = client.get(
            f"/dashboard/tickets/{ticket['ticket_id']}", headers=AUTH_HEADERS
        )
        assert detail_response.status_code == 200
        assert detail_response.json()["county"] == "Harris"
        assert detail_response.json()["status"] == "submitted"

    def test_bulk_operations_via_dashboard(self, sample_tickets):
        """Test dashboard can handle multiple tickets efficiently."""
        # Get all tickets and verify performance
        import time

        start_time = time.time()

        response = client.get("/dashboard/tickets", headers=AUTH_HEADERS)

        end_time = time.time()
        processing_time = end_time - start_time

        assert response.status_code == 200
        assert len(response.json()["tickets"]) == 4
        # Should be fast (under 1 second for test dataset)
        assert processing_time < 1.0

        # Test individual ticket details are also fast
        for ticket in response.json()["tickets"]:
            detail_start = time.time()
            detail_response = client.get(
                f"/dashboard/tickets/{ticket['ticket_id']}", headers=AUTH_HEADERS
            )
            detail_end = time.time()

            assert detail_response.status_code == 200
            assert (detail_end - detail_start) < 0.5  # Under 500ms each


class TestTicketResponsesEndpoint:
    """Test suite for the GET /dashboard/tickets/{ticket_id}/responses endpoint."""

    @pytest.fixture
    def sample_ticket_with_responses(self):
        """Create a sample ticket with response data."""
        from datetime import UTC, datetime

        from texas811_poc.models import MemberInfo, MemberResponseDetail, ResponseStatus
        from texas811_poc.storage import create_storage_instances

        # Create test ticket
        ticket = TicketModel(
            ticket_id="TEST_RESP_001",
            session_id="session_resp_001",
            status=TicketStatus.SUBMITTED,
            county="Harris",
            city="Houston",
            address="123 Test Response St",
            work_description="Test excavation with responses",
            expected_members=[
                MemberInfo(member_code="COMST", member_name="Comcast"),
                MemberInfo(member_code="CPTEN01", member_name="CenterPoint Energy"),
                MemberInfo(member_code="NAME", member_name="Natural Gas"),
            ],
        )

        # Set up storage
        ticket_storage, audit_storage, response_storage, backup_manager = (
            create_storage_instances(TEST_DATA_ROOT)
        )

        # Save ticket
        ticket_storage.save_ticket(ticket)

        # Create sample responses
        responses = [
            MemberResponseDetail(
                ticket_id="TEST_RESP_001",
                member_code="COMST",
                member_name="Comcast",
                status=ResponseStatus.CLEAR,
                user_name="test_user",
                facilities=None,
                comment="All clear to dig",
                created_at=datetime.now(UTC),
            ),
            MemberResponseDetail(
                ticket_id="TEST_RESP_001",
                member_code="CPTEN01",
                member_name="CenterPoint Energy",
                status=ResponseStatus.NOT_CLEAR,
                user_name="test_user",
                facilities="Gas line present",
                comment="Underground gas line - marked on site",
                created_at=datetime.now(UTC),
            ),
        ]

        # Save responses
        for response in responses:
            response_storage.save_response(response)

        return ticket, responses

    def test_get_responses_success(self, sample_ticket_with_responses):
        """Test successful retrieval of ticket responses."""
        ticket, expected_responses = sample_ticket_with_responses

        response = client.get(
            f"/dashboard/tickets/{ticket.ticket_id}/responses", headers=AUTH_HEADERS
        )

        assert response.status_code == 200
        data = response.json()

        # Check response structure
        assert "ticket_id" in data
        assert "responses" in data
        assert "expected_members" in data
        assert "summary" in data

        assert data["ticket_id"] == "TEST_RESP_001"
        assert len(data["responses"]) == 2
        assert len(data["expected_members"]) == 3

        # Check response details
        responses = data["responses"]
        comst_response = next(
            (r for r in responses if r["member_code"] == "COMST"), None
        )
        assert comst_response is not None
        assert comst_response["status"] == "clear"
        assert comst_response["comment"] == "All clear to dig"

        cpten_response = next(
            (r for r in responses if r["member_code"] == "CPTEN01"), None
        )
        assert cpten_response is not None
        assert cpten_response["status"] == "not_clear"
        assert cpten_response["facilities"] == "Gas line present"

        # Check expected members
        expected_members = data["expected_members"]
        member_codes = [m["member_code"] for m in expected_members]
        assert "COMST" in member_codes
        assert "CPTEN01" in member_codes
        assert "NAME" in member_codes

        # Check summary statistics
        summary = data["summary"]
        assert summary["total_expected"] == 3
        assert summary["total_responses"] == 2
        assert summary["pending_count"] == 1
        assert summary["clear_count"] == 1
        assert summary["not_clear_count"] == 1

    def test_get_responses_ticket_not_found(self):
        """Test responses endpoint with non-existent ticket."""
        response = client.get(
            "/dashboard/tickets/NONEXISTENT/responses", headers=AUTH_HEADERS
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_responses_no_responses_yet(self):
        """Test responses endpoint for ticket with no responses yet."""
        from texas811_poc.models import MemberInfo

        # Create ticket without responses
        ticket = TicketModel(
            ticket_id="TEST_NO_RESP",
            session_id="session_no_resp",
            status=TicketStatus.SUBMITTED,
            county="Dallas",
            city="Dallas",
            address="456 No Response Ave",
            work_description="Test excavation without responses",
            expected_members=[
                MemberInfo(member_code="TEST1", member_name="Test Utility 1"),
                MemberInfo(member_code="TEST2", member_name="Test Utility 2"),
            ],
        )

        from texas811_poc.storage import create_storage_instances

        ticket_storage, _, _, _ = create_storage_instances(TEST_DATA_ROOT)
        ticket_storage.save_ticket(ticket)

        response = client.get(
            f"/dashboard/tickets/{ticket.ticket_id}/responses", headers=AUTH_HEADERS
        )

        assert response.status_code == 200
        data = response.json()

        assert data["ticket_id"] == "TEST_NO_RESP"
        assert data["responses"] == []
        assert len(data["expected_members"]) == 2
        assert data["summary"]["total_expected"] == 2
        assert data["summary"]["total_responses"] == 0
        assert data["summary"]["pending_count"] == 2
        assert data["summary"]["clear_count"] == 0
        assert data["summary"]["not_clear_count"] == 0

    def test_get_responses_no_expected_members(self):
        """Test responses endpoint for ticket with no expected members."""
        # Create ticket without expected members
        ticket = TicketModel(
            ticket_id="TEST_NO_EXPECTED",
            session_id="session_no_expected",
            status=TicketStatus.DRAFT,
            county="Travis",
            city="Austin",
            address="789 No Expected Members St",
            work_description="Test excavation without expected members",
            expected_members=[],
        )

        from texas811_poc.storage import create_storage_instances

        ticket_storage, _, _, _ = create_storage_instances(TEST_DATA_ROOT)
        ticket_storage.save_ticket(ticket)

        response = client.get(
            f"/dashboard/tickets/{ticket.ticket_id}/responses", headers=AUTH_HEADERS
        )

        assert response.status_code == 200
        data = response.json()

        assert data["ticket_id"] == "TEST_NO_EXPECTED"
        assert data["responses"] == []
        assert data["expected_members"] == []
        assert data["summary"]["total_expected"] == 0
        assert data["summary"]["total_responses"] == 0
        assert data["summary"]["pending_count"] == 0

    def test_get_responses_unauthorized(self):
        """Test responses endpoint without authorization."""
        response = client.get("/dashboard/tickets/TEST001/responses")

        assert response.status_code == 403
        assert "not authenticated" in response.json()["detail"].lower()

    def test_get_responses_invalid_api_key(self):
        """Test responses endpoint with invalid API key."""
        response = client.get(
            "/dashboard/tickets/TEST001/responses",
            headers={"Authorization": "Bearer invalid-key"},
        )

        assert response.status_code == 401
        assert "invalid api key" in response.json()["detail"].lower()
