"""
Test state machine for ticket lifecycle management.

This module tests the ticket state management system including:
- State transitions and validation
- Field locking mechanism for confirmed tickets
- State transition audit logging
- Session-based state tracking
"""

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from src.texas811_poc.models import AuditAction, TicketModel, TicketStatus
from src.texas811_poc.state_machine import (
    LOCKED_FIELDS_BY_STATE,
    VALID_STATE_TRANSITIONS,
    FieldLockError,
    StateTransitionError,
    TicketStateMachine,
)


class TestTicketStateMachine:
    """Test ticket state machine functionality."""

    def test_state_machine_initialization(self, clean_session_manager, temp_data_dir):
        """Test state machine initializes with proper dependencies."""
        state_machine = TicketStateMachine(
            session_manager=clean_session_manager, audit_storage_path=temp_data_dir
        )

        assert state_machine.session_manager == clean_session_manager
        assert state_machine.audit_storage_path == temp_data_dir
        assert hasattr(state_machine, "audit_storage")

    def test_valid_state_transitions(self, clean_session_manager, temp_data_dir):
        """Test all valid state transitions are allowed."""
        state_machine = TicketStateMachine(
            session_manager=clean_session_manager, audit_storage_path=temp_data_dir
        )

        # Test valid transitions
        assert state_machine.can_transition(TicketStatus.DRAFT, TicketStatus.VALIDATED)
        assert state_machine.can_transition(TicketStatus.VALIDATED, TicketStatus.READY)
        assert state_machine.can_transition(TicketStatus.READY, TicketStatus.SUBMITTED)
        assert state_machine.can_transition(
            TicketStatus.SUBMITTED, TicketStatus.RESPONSES_IN
        )
        assert state_machine.can_transition(
            TicketStatus.RESPONSES_IN, TicketStatus.READY_TO_DIG
        )

        # Test cancellation from any state
        for status in TicketStatus:
            if status != TicketStatus.CANCELLED:
                assert state_machine.can_transition(status, TicketStatus.CANCELLED)

    def test_invalid_state_transitions(self, clean_session_manager, temp_data_dir):
        """Test invalid state transitions are blocked."""
        state_machine = TicketStateMachine(
            session_manager=clean_session_manager, audit_storage_path=temp_data_dir
        )

        # Test invalid backwards transitions (but allow validated->draft as it's valid in our config)
        assert not state_machine.can_transition(
            TicketStatus.SUBMITTED, TicketStatus.DRAFT
        )
        assert not state_machine.can_transition(TicketStatus.READY, TicketStatus.DRAFT)

        # Test skipping states
        assert not state_machine.can_transition(
            TicketStatus.DRAFT, TicketStatus.SUBMITTED
        )
        assert not state_machine.can_transition(
            TicketStatus.DRAFT, TicketStatus.READY_TO_DIG
        )

    def test_transition_ticket_success(
        self, clean_session_manager, temp_data_dir, sample_ticket_data
    ):
        """Test successful ticket state transition with audit logging."""
        state_machine = TicketStateMachine(
            session_manager=clean_session_manager, audit_storage_path=temp_data_dir
        )

        # Create a draft ticket (avoid conflicts with sample data)
        ticket = TicketModel(
            session_id="test-session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
        )

        assert ticket.status == TicketStatus.DRAFT

        # Transition to validated
        updated_ticket = state_machine.transition_ticket(
            ticket=ticket,
            new_status=TicketStatus.VALIDATED,
            user_id="test-user",
            details={"validation_passed": True},
        )

        assert updated_ticket.status == TicketStatus.VALIDATED
        assert updated_ticket.updated_at >= ticket.updated_at

        # Verify audit event was created
        audit_events = state_machine.audit_storage.get_audit_events(
            ticket_id=ticket.ticket_id, action=AuditAction.STATUS_CHANGED
        )
        assert len(audit_events) == 1
        assert audit_events[0].details["old_status"] == "draft"
        assert audit_events[0].details["new_status"] == "validated"

    def test_transition_ticket_invalid_state(
        self, clean_session_manager, temp_data_dir, sample_ticket_data
    ):
        """Test invalid state transition raises error."""
        state_machine = TicketStateMachine(
            session_manager=clean_session_manager, audit_storage_path=temp_data_dir
        )

        ticket = TicketModel(
            session_id="test-session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
        )

        # Try invalid transition (draft to submitted)
        with pytest.raises(StateTransitionError) as exc_info:
            state_machine.transition_ticket(
                ticket=ticket, new_status=TicketStatus.SUBMITTED, user_id="test-user"
            )

        assert "Invalid state transition" in str(exc_info.value)
        assert "DRAFT" in str(exc_info.value)
        assert "SUBMITTED" in str(exc_info.value)

    def test_field_locking_mechanism(
        self, clean_session_manager, temp_data_dir, sample_ticket_data
    ):
        """Test field locking for confirmed tickets."""
        state_machine = TicketStateMachine(
            session_manager=clean_session_manager, audit_storage_path=temp_data_dir
        )

        ticket = TicketModel(
            session_id="test-session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
        )

        # Draft tickets should allow all field updates
        locked_fields = state_machine.get_locked_fields(ticket.status)
        assert len(locked_fields) == 0

        # Transition to validated - should lock some fields
        ticket = state_machine.transition_ticket(
            ticket=ticket, new_status=TicketStatus.VALIDATED, user_id="test-user"
        )

        locked_fields = state_machine.get_locked_fields(ticket.status)
        assert "county" in locked_fields
        assert "city" in locked_fields
        assert "address" in locked_fields

        # Transition to submitted - should lock more fields
        ticket = state_machine.transition_ticket(
            ticket=ticket, new_status=TicketStatus.READY, user_id="test-user"
        )

        ticket = state_machine.transition_ticket(
            ticket=ticket, new_status=TicketStatus.SUBMITTED, user_id="test-user"
        )

        locked_fields = state_machine.get_locked_fields(ticket.status)
        assert "work_description" in locked_fields
        assert "gps_lat" in locked_fields
        assert "gps_lng" in locked_fields

    def test_validate_field_update_allowed(
        self, clean_session_manager, temp_data_dir, sample_ticket_data
    ):
        """Test field update validation against locked fields."""
        state_machine = TicketStateMachine(
            session_manager=clean_session_manager, audit_storage_path=temp_data_dir
        )

        ticket = TicketModel(
            session_id="test-session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
        )

        # Draft ticket - all updates allowed
        update_data = {"county": "Dallas", "work_description": "Updated work"}
        state_machine.validate_field_updates(
            ticket.status, update_data
        )  # Should not raise

        # Transition to validated
        ticket = state_machine.transition_ticket(
            ticket=ticket, new_status=TicketStatus.VALIDATED, user_id="test-user"
        )

        # Try to update locked field
        update_data = {"county": "Dallas"}  # County is locked in validated state
        with pytest.raises(FieldLockError) as exc_info:
            state_machine.validate_field_updates(ticket.status, update_data)

        assert "county" in str(exc_info.value)
        assert "locked" in str(exc_info.value).lower()

        # Allowed field update should work
        update_data = {"remarks": "Added some notes"}
        state_machine.validate_field_updates(
            ticket.status, update_data
        )  # Should not raise

    def test_session_state_tracking(self, clean_session_manager, temp_data_dir):
        """Test session-based ticket state tracking."""
        state_machine = TicketStateMachine(
            session_manager=clean_session_manager, audit_storage_path=temp_data_dir
        )

        session_id = "test-session-123"
        ticket_id = "ticket-456"

        # Store ticket state in session
        state_data = {
            "ticket_id": ticket_id,
            "current_status": "draft",
            "last_updated": datetime.now().isoformat(),
            "workflow_step": "initial_validation",
        }

        state_machine.set_session_state(session_id, ticket_id, state_data)

        # Retrieve session state
        retrieved_state = state_machine.get_session_state(session_id, ticket_id)
        assert retrieved_state["ticket_id"] == ticket_id
        assert retrieved_state["current_status"] == "draft"
        assert retrieved_state["workflow_step"] == "initial_validation"

        # Update session state
        updated_state = {
            "current_status": "validated",
            "workflow_step": "confirmation",
            "validation_gaps": [],
        }

        state_machine.update_session_state(session_id, ticket_id, updated_state)

        # Verify updates
        final_state = state_machine.get_session_state(session_id, ticket_id)
        assert final_state["current_status"] == "validated"
        assert final_state["workflow_step"] == "confirmation"
        assert final_state["validation_gaps"] == []

    def test_session_state_cleanup(self, clean_session_manager, temp_data_dir):
        """Test session state cleanup functionality."""
        state_machine = TicketStateMachine(
            session_manager=clean_session_manager, audit_storage_path=temp_data_dir
        )

        session_id = "test-session-cleanup"
        ticket_id = "ticket-cleanup"

        # Set session state
        state_machine.set_session_state(session_id, ticket_id, {"status": "draft"})
        assert state_machine.get_session_state(session_id, ticket_id) is not None

        # Clear session state
        state_machine.clear_session_state(session_id, ticket_id)
        assert state_machine.get_session_state(session_id, ticket_id) is None

        # Clear entire session
        state_machine.set_session_state(session_id, "ticket1", {"status": "draft"})
        state_machine.set_session_state(session_id, "ticket2", {"status": "validated"})

        state_machine.clear_session(session_id)
        assert state_machine.get_session_state(session_id, "ticket1") is None
        assert state_machine.get_session_state(session_id, "ticket2") is None

    def test_get_ticket_state_history(
        self, clean_session_manager, temp_data_dir, sample_ticket_data
    ):
        """Test retrieving complete state transition history for a ticket."""
        state_machine = TicketStateMachine(
            session_manager=clean_session_manager, audit_storage_path=temp_data_dir
        )

        ticket = TicketModel(
            session_id="test-session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
        )

        # Perform several state transitions
        ticket = state_machine.transition_ticket(
            ticket=ticket,
            new_status=TicketStatus.VALIDATED,
            user_id="user1",
            details={"validation_completed": True},
        )

        ticket = state_machine.transition_ticket(
            ticket=ticket,
            new_status=TicketStatus.READY,
            user_id="user1",
            details={"ready_for_submission": True},
        )

        ticket = state_machine.transition_ticket(
            ticket=ticket,
            new_status=TicketStatus.SUBMITTED,
            user_id="user2",
            details={"submitted_to_texas811": True},
        )

        # Get state history
        history = state_machine.get_ticket_state_history(ticket.ticket_id)

        assert len(history) == 3  # Three status changes

        # Verify chronological order (newest first)
        assert history[0].details["new_status"] == "submitted"
        assert history[1].details["new_status"] == "ready"
        assert history[2].details["new_status"] == "validated"

        # Verify all have correct action type
        for event in history:
            assert event.action == AuditAction.STATUS_CHANGED
            assert event.ticket_id == ticket.ticket_id

    def test_emergency_state_transitions(
        self, clean_session_manager, temp_data_dir, sample_ticket_data
    ):
        """Test emergency bypass transitions for special cases."""
        state_machine = TicketStateMachine(
            session_manager=clean_session_manager, audit_storage_path=temp_data_dir
        )

        ticket = TicketModel(
            session_id="test-session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Emergency utility repair",
        )

        # Emergency bypass should allow direct transition to cancelled from any state
        # First transition to submitted
        ticket = state_machine.transition_ticket(
            ticket=ticket, new_status=TicketStatus.VALIDATED, user_id="user1"
        )

        ticket = state_machine.transition_ticket(
            ticket=ticket, new_status=TicketStatus.READY, user_id="user1"
        )

        ticket = state_machine.transition_ticket(
            ticket=ticket, new_status=TicketStatus.SUBMITTED, user_id="user1"
        )

        # Emergency cancellation
        cancelled_ticket = state_machine.transition_ticket(
            ticket=ticket,
            new_status=TicketStatus.CANCELLED,
            user_id="admin",
            details={"reason": "Emergency cancellation", "emergency": True},
        )

        assert cancelled_ticket.status == TicketStatus.CANCELLED

        # Verify audit trail includes emergency flag
        history = state_machine.get_ticket_state_history(ticket.ticket_id)
        cancellation_event = history[0]  # Most recent
        assert cancellation_event.details["emergency"] is True
        assert "Emergency" in cancellation_event.details["reason"]


class TestFieldLockingConfiguration:
    """Test field locking configuration and rules."""

    def test_locked_fields_configuration(self):
        """Test that locked fields are properly configured for each state."""
        # Draft should have no locked fields
        assert TicketStatus.DRAFT not in LOCKED_FIELDS_BY_STATE

        # Validated should lock location fields
        validated_locked = LOCKED_FIELDS_BY_STATE[TicketStatus.VALIDATED]
        assert "county" in validated_locked
        assert "city" in validated_locked
        assert "address" in validated_locked

        # Submitted should lock core work fields
        submitted_locked = LOCKED_FIELDS_BY_STATE[TicketStatus.SUBMITTED]
        assert "work_description" in submitted_locked
        assert "gps_lat" in submitted_locked
        assert "gps_lng" in submitted_locked

    def test_valid_state_transitions_configuration(self):
        """Test that state transition configuration is complete."""
        # Every status should have defined valid transitions
        for status in TicketStatus:
            if status != TicketStatus.EXPIRED:  # Expired is terminal
                assert status in VALID_STATE_TRANSITIONS

        # All statuses should allow transition to CANCELLED
        for status in TicketStatus:
            if status != TicketStatus.CANCELLED:
                assert TicketStatus.CANCELLED in VALID_STATE_TRANSITIONS[status]


class TestStateTransitionErrors:
    """Test state transition error handling."""

    def test_state_transition_error_details(self):
        """Test StateTransitionError provides helpful details."""
        error = StateTransitionError(
            current_state=TicketStatus.DRAFT,
            attempted_state=TicketStatus.SUBMITTED,
            message="Cannot skip validation step",
        )

        assert error.current_state == TicketStatus.DRAFT
        assert error.attempted_state == TicketStatus.SUBMITTED
        assert "Cannot skip validation step" in str(error)

    def test_field_lock_error_details(self):
        """Test FieldLockError provides helpful field information."""
        locked_fields = ["county", "city", "address"]
        attempted_updates = {"county": "Dallas", "remarks": "Updated notes"}

        error = FieldLockError(
            locked_fields=locked_fields,
            attempted_updates=attempted_updates,
            ticket_status=TicketStatus.VALIDATED,
        )

        assert error.locked_fields == locked_fields
        assert error.attempted_updates == attempted_updates
        assert error.ticket_status == TicketStatus.VALIDATED
        assert "county" in str(error)
        assert "VALIDATED" in str(error)


class TestIntegrationWithExistingComponents:
    """Test state machine integration with existing components."""

    def test_integration_with_compliance_calculator(
        self, clean_session_manager, temp_data_dir, sample_ticket_data
    ):
        """Test state machine integration with compliance date calculations."""
        state_machine = TicketStateMachine(
            session_manager=clean_session_manager, audit_storage_path=temp_data_dir
        )

        # Mock compliance calculator
        with patch("src.texas811_poc.state_machine.ComplianceCalculator") as mock_calc:
            mock_calc_instance = MagicMock()
            mock_calc_instance.calculate_lawful_start_date.return_value = (
                datetime.now().date()
            )
            mock_calc_instance.calculate_ticket_expiration.return_value = (
                datetime.now() + timedelta(days=14)
            ).date()
            mock_calc.return_value = mock_calc_instance

            ticket = TicketModel(
                session_id="test-session",
                county="Travis",
                city="Austin",
                address="123 Main St",
                work_description="Test work",
            )

            # Transition to submitted should trigger compliance calculations
            submitted_ticket = state_machine.transition_ticket(
                ticket=ticket, new_status=TicketStatus.VALIDATED, user_id="user1"
            )

            submitted_ticket = state_machine.transition_ticket(
                ticket=submitted_ticket, new_status=TicketStatus.READY, user_id="user1"
            )

            submitted_ticket = state_machine.transition_ticket(
                ticket=submitted_ticket,
                new_status=TicketStatus.SUBMITTED,
                user_id="user1",
            )

            # Verify compliance dates were calculated
            assert submitted_ticket.lawful_start_date is not None
            assert submitted_ticket.ticket_expires_date is not None

    def test_integration_with_audit_storage(
        self, clean_session_manager, temp_data_dir, sample_ticket_data
    ):
        """Test that state machine properly integrates with audit storage."""
        state_machine = TicketStateMachine(
            session_manager=clean_session_manager, audit_storage_path=temp_data_dir
        )

        ticket = TicketModel(
            session_id="test-session",
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Test work",
        )

        # Perform transition
        state_machine.transition_ticket(
            ticket=ticket,
            new_status=TicketStatus.VALIDATED,
            user_id="test-user",
            ip_address="192.168.1.1",
            user_agent="TestAgent/1.0",
        )

        # Verify audit event was stored
        events = state_machine.audit_storage.get_audit_events(
            ticket_id=ticket.ticket_id
        )

        assert len(events) == 1
        event = events[0]
        assert event.action == AuditAction.STATUS_CHANGED
        assert event.user_id == "test-user"
        assert event.ip_address == "192.168.1.1"
        assert event.user_agent == "TestAgent/1.0"
