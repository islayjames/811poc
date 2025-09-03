"""
Test suite for status calculation logic in expanded response tracking.

This module tests the calculate_ticket_status function that determines
ticket status based on response tracking state.
"""

from texas811_poc.models import (
    MemberInfo,
    MemberResponseDetail,
    ResponseStatus,
    TicketModel,
    TicketStatus,
)
from texas811_poc.status_calculator import (
    calculate_ticket_status,
    get_status_transition_summary,
    update_ticket_status_with_responses,
)


class TestCalculateTicketStatus:
    """Test cases for calculate_ticket_status function."""

    def test_no_expected_members_no_responses(self):
        """Test legacy behavior when no expected members are defined."""
        ticket = TicketModel(
            session_id="test_session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
            status=TicketStatus.SUBMITTED,
            expected_members=[],
        )
        responses = []

        result = calculate_ticket_status(ticket, responses)
        assert result == TicketStatus.SUBMITTED

    def test_no_expected_members_with_responses(self):
        """Test legacy behavior with responses but no expected members."""
        ticket = TicketModel(
            session_id="test_session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
            status=TicketStatus.SUBMITTED,
            expected_members=[],
        )
        responses = [
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="ATMOS",
                member_name="Atmos Energy",
                status=ResponseStatus.CLEAR,
                user_name="test_user",
            )
        ]

        result = calculate_ticket_status(ticket, responses)
        assert result == TicketStatus.RESPONSES_IN

    def test_with_expected_members_no_responses(self):
        """Test with expected members but no responses yet."""
        expected_members = [
            MemberInfo(member_code="ATMOS", member_name="Atmos Energy"),
            MemberInfo(member_code="ONCOR", member_name="Oncor Electric"),
        ]
        ticket = TicketModel(
            session_id="test_session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
            status=TicketStatus.SUBMITTED,
            expected_members=expected_members,
        )
        responses = []

        result = calculate_ticket_status(ticket, responses)
        assert result == TicketStatus.SUBMITTED

    def test_with_expected_members_partial_responses(self):
        """Test with expected members and partial responses."""
        expected_members = [
            MemberInfo(member_code="ATMOS", member_name="Atmos Energy"),
            MemberInfo(member_code="ONCOR", member_name="Oncor Electric"),
            MemberInfo(member_code="WATER", member_name="City Water"),
        ]
        ticket = TicketModel(
            session_id="test_session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
            status=TicketStatus.SUBMITTED,
            expected_members=expected_members,
        )
        responses = [
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="ATMOS",
                member_name="Atmos Energy",
                status=ResponseStatus.CLEAR,
                user_name="test_user",
            )
        ]

        result = calculate_ticket_status(ticket, responses)
        assert result == TicketStatus.IN_PROGRESS

    def test_with_expected_members_all_responses(self):
        """Test with expected members and all responses received."""
        expected_members = [
            MemberInfo(member_code="ATMOS", member_name="Atmos Energy"),
            MemberInfo(member_code="ONCOR", member_name="Oncor Electric"),
        ]
        ticket = TicketModel(
            session_id="test_session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
            status=TicketStatus.SUBMITTED,
            expected_members=expected_members,
        )
        responses = [
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="ATMOS",
                member_name="Atmos Energy",
                status=ResponseStatus.CLEAR,
                user_name="test_user",
            ),
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="ONCOR",
                member_name="Oncor Electric",
                status=ResponseStatus.NOT_CLEAR,
                user_name="test_user",
            ),
        ]

        result = calculate_ticket_status(ticket, responses)
        assert result == TicketStatus.RESPONSES_IN

    def test_status_transition_submitted_to_in_progress(self):
        """Test status transition from submitted to in_progress."""
        expected_members = [
            MemberInfo(member_code="ATMOS", member_name="Atmos Energy"),
            MemberInfo(member_code="ONCOR", member_name="Oncor Electric"),
        ]
        ticket = TicketModel(
            session_id="test_session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
            status=TicketStatus.SUBMITTED,
            expected_members=expected_members,
        )

        # No responses - should remain submitted
        result = calculate_ticket_status(ticket, [])
        assert result == TicketStatus.SUBMITTED

        # First response - should become in_progress
        responses = [
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="ATMOS",
                member_name="Atmos Energy",
                status=ResponseStatus.CLEAR,
                user_name="test_user",
            )
        ]
        result = calculate_ticket_status(ticket, responses)
        assert result == TicketStatus.IN_PROGRESS

    def test_status_transition_in_progress_to_responses_in(self):
        """Test status transition from in_progress to responses_in."""
        expected_members = [
            MemberInfo(member_code="ATMOS", member_name="Atmos Energy"),
            MemberInfo(member_code="ONCOR", member_name="Oncor Electric"),
        ]
        ticket = TicketModel(
            session_id="test_session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
            status=TicketStatus.IN_PROGRESS,
            expected_members=expected_members,
        )

        # All responses received - should become responses_in
        responses = [
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="ATMOS",
                member_name="Atmos Energy",
                status=ResponseStatus.CLEAR,
                user_name="test_user",
            ),
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="ONCOR",
                member_name="Oncor Electric",
                status=ResponseStatus.NOT_CLEAR,
                user_name="test_user",
            ),
        ]

        result = calculate_ticket_status(ticket, responses)
        assert result == TicketStatus.RESPONSES_IN

    def test_edge_case_more_responses_than_expected(self):
        """Test edge case where more responses received than expected."""
        expected_members = [MemberInfo(member_code="ATMOS", member_name="Atmos Energy")]
        ticket = TicketModel(
            session_id="test_session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
            status=TicketStatus.SUBMITTED,
            expected_members=expected_members,
        )
        responses = [
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="ATMOS",
                member_name="Atmos Energy",
                status=ResponseStatus.CLEAR,
                user_name="test_user",
            ),
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="ONCOR",
                member_name="Oncor Electric",
                status=ResponseStatus.CLEAR,
                user_name="test_user",
            ),
        ]

        # More responses than expected should still be responses_in
        result = calculate_ticket_status(ticket, responses)
        assert result == TicketStatus.RESPONSES_IN

    def test_single_expected_member_single_response(self):
        """Test with single expected member receiving single response."""
        expected_members = [MemberInfo(member_code="ATMOS", member_name="Atmos Energy")]
        ticket = TicketModel(
            session_id="test_session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
            status=TicketStatus.SUBMITTED,
            expected_members=expected_members,
        )
        responses = [
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="ATMOS",
                member_name="Atmos Energy",
                status=ResponseStatus.CLEAR,
                user_name="test_user",
            )
        ]

        result = calculate_ticket_status(ticket, responses)
        assert result == TicketStatus.RESPONSES_IN


class TestUpdateTicketStatusWithResponses:
    """Test cases for update_ticket_status_with_responses function."""

    def test_update_ticket_status_no_change(self):
        """Test updating ticket when status doesn't change."""
        expected_members = [
            MemberInfo(member_code="ATMOS", member_name="Atmos Energy"),
            MemberInfo(member_code="ONCOR", member_name="Oncor Electric"),
        ]
        ticket = TicketModel(
            session_id="test_session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
            status=TicketStatus.SUBMITTED,
            expected_members=expected_members,
        )
        responses = []  # No responses yet

        updated_ticket, status_changed = update_ticket_status_with_responses(
            ticket, responses
        )

        assert status_changed is False
        assert updated_ticket.status == TicketStatus.SUBMITTED
        assert updated_ticket.ticket_id == ticket.ticket_id  # Same ticket

    def test_update_ticket_status_to_in_progress(self):
        """Test updating ticket status to in_progress."""
        expected_members = [
            MemberInfo(member_code="ATMOS", member_name="Atmos Energy"),
            MemberInfo(member_code="ONCOR", member_name="Oncor Electric"),
        ]
        ticket = TicketModel(
            session_id="test_session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
            status=TicketStatus.SUBMITTED,
            expected_members=expected_members,
        )
        responses = [
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="ATMOS",
                member_name="Atmos Energy",
                status=ResponseStatus.CLEAR,
                user_name="test_user",
            )
        ]

        updated_ticket, status_changed = update_ticket_status_with_responses(
            ticket, responses
        )

        assert status_changed is True
        assert updated_ticket.status == TicketStatus.IN_PROGRESS
        assert updated_ticket.ticket_id == ticket.ticket_id

    def test_update_ticket_status_to_responses_in(self):
        """Test updating ticket status to responses_in."""
        expected_members = [
            MemberInfo(member_code="ATMOS", member_name="Atmos Energy"),
            MemberInfo(member_code="ONCOR", member_name="Oncor Electric"),
        ]
        ticket = TicketModel(
            session_id="test_session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
            status=TicketStatus.IN_PROGRESS,
            expected_members=expected_members,
        )
        responses = [
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="ATMOS",
                member_name="Atmos Energy",
                status=ResponseStatus.CLEAR,
                user_name="test_user",
            ),
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="ONCOR",
                member_name="Oncor Electric",
                status=ResponseStatus.NOT_CLEAR,
                user_name="test_user",
            ),
        ]

        updated_ticket, status_changed = update_ticket_status_with_responses(
            ticket, responses
        )

        assert status_changed is True
        assert updated_ticket.status == TicketStatus.RESPONSES_IN
        assert updated_ticket.ticket_id == ticket.ticket_id


class TestGetStatusTransitionSummary:
    """Test cases for get_status_transition_summary function."""

    def test_no_status_change(self):
        """Test summary when status doesn't change."""
        summary = get_status_transition_summary(
            TicketStatus.SUBMITTED, TicketStatus.SUBMITTED, 0, 2
        )
        assert summary == "Status unchanged: submitted"

    def test_submitted_to_in_progress(self):
        """Test summary for submitted to in_progress transition."""
        summary = get_status_transition_summary(
            TicketStatus.SUBMITTED, TicketStatus.IN_PROGRESS, 1, 3
        )
        assert summary == "First response received (1/3)"

    def test_in_progress_to_responses_in(self):
        """Test summary for in_progress to responses_in transition."""
        summary = get_status_transition_summary(
            TicketStatus.IN_PROGRESS, TicketStatus.RESPONSES_IN, 3, 3
        )
        assert summary == "All responses received (3/3)"

    def test_submitted_to_responses_in_legacy(self):
        """Test summary for submitted to responses_in (legacy behavior)."""
        summary = get_status_transition_summary(
            TicketStatus.SUBMITTED,
            TicketStatus.RESPONSES_IN,
            1,
            0,  # No expected members
        )
        assert summary == "Responses received"

    def test_submitted_to_responses_in_with_expected(self):
        """Test summary for submitted to responses_in with expected members."""
        summary = get_status_transition_summary(
            TicketStatus.SUBMITTED, TicketStatus.RESPONSES_IN, 2, 2
        )
        assert summary == "Responses received (2/2)"

    def test_other_status_transitions(self):
        """Test summary for other status transitions."""
        summary = get_status_transition_summary(
            TicketStatus.DRAFT, TicketStatus.SUBMITTED, 0, 0
        )
        assert summary == "Status changed from draft to submitted"


class TestStatusCalculationIntegration:
    """Integration tests for status calculation with ticket persistence."""

    def test_integration_with_ticket_model_updates(self):
        """Test integration of status calculation with ticket model updates."""
        expected_members = [
            MemberInfo(member_code="ATMOS", member_name="Atmos Energy"),
            MemberInfo(member_code="ONCOR", member_name="Oncor Electric"),
        ]

        # Create initial ticket
        ticket = TicketModel(
            session_id="test_session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
            status=TicketStatus.SUBMITTED,
            expected_members=expected_members,
        )

        # Calculate status with no responses
        responses = []
        new_status = calculate_ticket_status(ticket, responses)
        assert new_status == TicketStatus.SUBMITTED

        # Add first response
        responses = [
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="ATMOS",
                member_name="Atmos Energy",
                status=ResponseStatus.CLEAR,
                user_name="test_user",
            )
        ]
        new_status = calculate_ticket_status(ticket, responses)
        assert new_status == TicketStatus.IN_PROGRESS

        # Add second response
        responses.append(
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="ONCOR",
                member_name="Oncor Electric",
                status=ResponseStatus.NOT_CLEAR,
                user_name="test_user",
            )
        )
        new_status = calculate_ticket_status(ticket, responses)
        assert new_status == TicketStatus.RESPONSES_IN

    def test_backward_compatibility_existing_tickets(self):
        """Test that existing tickets without expected_members still work."""
        # Simulate an existing ticket without expected_members
        ticket = TicketModel(
            session_id="existing_session",
            county="Dallas",
            city="Dallas",
            address="456 Elm St",
            work_description="Existing work",
            status=TicketStatus.SUBMITTED,
            # expected_members defaults to empty list
        )

        responses = []
        result = calculate_ticket_status(ticket, responses)
        assert result == TicketStatus.SUBMITTED

        # Add a response - should use legacy behavior
        responses = [
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="UNKNOWN",
                member_name="Unknown Utility",
                status=ResponseStatus.CLEAR,
                user_name="legacy_user",
            )
        ]
        result = calculate_ticket_status(ticket, responses)
        assert result == TicketStatus.RESPONSES_IN
