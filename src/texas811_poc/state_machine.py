"""
Ticket state machine for lifecycle management and field locking.

This module provides comprehensive state management for Texas811 tickets including:
- State transition validation and enforcement
- Field locking mechanism for confirmed tickets
- Session-based state tracking with Redis
- Audit trail logging for all state changes
- Integration with compliance calculations

The state machine ensures data integrity by preventing invalid state transitions
and protecting critical fields from modification once tickets are confirmed.
"""

import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .compliance import ComplianceCalculator
from .models import AuditAction, AuditEventModel, TicketModel, TicketStatus
from .redis_client import RedisSessionManager
from .storage import AuditStorage

logger = logging.getLogger(__name__)


class StateTransitionError(Exception):
    """Exception raised when an invalid state transition is attempted."""

    def __init__(
        self,
        current_state: TicketStatus,
        attempted_state: TicketStatus,
        message: str = None,
    ):
        self.current_state = current_state
        self.attempted_state = attempted_state
        self.message = (
            message
            or f"Invalid state transition from {current_state} to {attempted_state}"
        )
        super().__init__(self.message)


class FieldLockError(Exception):
    """Exception raised when attempting to update locked fields."""

    def __init__(
        self,
        locked_fields: list[str],
        attempted_updates: dict[str, Any],
        ticket_status: TicketStatus,
    ):
        self.locked_fields = locked_fields
        self.attempted_updates = attempted_updates
        self.ticket_status = ticket_status

        blocked_fields = [
            field for field in attempted_updates.keys() if field in locked_fields
        ]
        self.message = (
            f"Cannot update locked fields {blocked_fields} in status {ticket_status}. "
            f"Fields locked in this state: {locked_fields}"
        )
        super().__init__(self.message)


# State transition configuration
VALID_STATE_TRANSITIONS = {
    TicketStatus.DRAFT: [TicketStatus.VALIDATED, TicketStatus.CANCELLED],
    TicketStatus.VALIDATED: [
        TicketStatus.READY,
        TicketStatus.DRAFT,
        TicketStatus.CANCELLED,
    ],
    TicketStatus.READY: [
        TicketStatus.SUBMITTED,
        TicketStatus.VALIDATED,
        TicketStatus.CANCELLED,
    ],
    TicketStatus.SUBMITTED: [
        TicketStatus.RESPONSES_IN,
        TicketStatus.EXPIRED,
        TicketStatus.CANCELLED,
    ],
    TicketStatus.RESPONSES_IN: [TicketStatus.READY_TO_DIG, TicketStatus.CANCELLED],
    TicketStatus.READY_TO_DIG: [TicketStatus.COMPLETED, TicketStatus.CANCELLED],
    TicketStatus.COMPLETED: [TicketStatus.CANCELLED],  # Can still cancel if needed
    TicketStatus.CANCELLED: [],  # Terminal state
    TicketStatus.EXPIRED: [TicketStatus.CANCELLED],  # Can only cancel expired tickets
}

# Field locking configuration by state
LOCKED_FIELDS_BY_STATE = {
    # Draft: No fields locked - allow all updates
    # Validated: Lock location fields to prevent major changes after validation
    TicketStatus.VALIDATED: [
        "county",
        "city",
        "address",
        "cross_street",
        "gps_lat",
        "gps_lng",
    ],
    # Ready: Lock location + work description (ready for submission)
    TicketStatus.READY: [
        "county",
        "city",
        "address",
        "cross_street",
        "gps_lat",
        "gps_lng",
        "work_description",
        "work_type",
    ],
    # Submitted: Lock all core fields (submitted to Texas811)
    TicketStatus.SUBMITTED: [
        "county",
        "city",
        "address",
        "cross_street",
        "gps_lat",
        "gps_lng",
        "work_description",
        "work_type",
        "caller_name",
        "caller_company",
        "caller_phone",
        "caller_email",
        "excavator_company",
        "excavator_address",
        "excavator_phone",
        "work_start_date",
        "work_duration_days",
    ],
    # Responses In: Same as submitted + some additional protections
    TicketStatus.RESPONSES_IN: [
        "county",
        "city",
        "address",
        "cross_street",
        "gps_lat",
        "gps_lng",
        "work_description",
        "work_type",
        "caller_name",
        "caller_company",
        "caller_phone",
        "caller_email",
        "excavator_company",
        "excavator_address",
        "excavator_phone",
        "work_start_date",
        "work_duration_days",
        "submitted_at",
    ],
    # Ready to Dig: Lock everything except completion fields
    TicketStatus.READY_TO_DIG: [
        "county",
        "city",
        "address",
        "cross_street",
        "gps_lat",
        "gps_lng",
        "work_description",
        "work_type",
        "caller_name",
        "caller_company",
        "caller_phone",
        "caller_email",
        "excavator_company",
        "excavator_address",
        "excavator_phone",
        "work_start_date",
        "work_duration_days",
        "submitted_at",
    ],
    # Completed/Cancelled/Expired: Lock all fields except status updates
    TicketStatus.COMPLETED: ["*"],  # Lock all fields
    TicketStatus.CANCELLED: ["*"],  # Lock all fields
    TicketStatus.EXPIRED: ["*"],  # Lock all fields
}


class TicketStateMachine:
    """
    State machine for managing ticket lifecycle and field locking.

    Provides centralized state management with:
    - State transition validation
    - Field locking enforcement
    - Session state tracking
    - Audit trail logging
    - Integration with compliance calculations
    """

    def __init__(self, session_manager: RedisSessionManager, audit_storage_path: Path):
        """
        Initialize state machine with required dependencies.

        Args:
            session_manager: Redis session manager for session state
            audit_storage_path: Path for audit event storage
        """
        self.session_manager = session_manager
        self.audit_storage_path = Path(audit_storage_path)
        self.audit_storage = AuditStorage(self.audit_storage_path)
        self.compliance_calculator = ComplianceCalculator()

    def can_transition(
        self, current_status: TicketStatus, new_status: TicketStatus
    ) -> bool:
        """
        Check if transition from current status to new status is valid.

        Args:
            current_status: Current ticket status
            new_status: Desired new status

        Returns:
            True if transition is valid, False otherwise
        """
        if current_status not in VALID_STATE_TRANSITIONS:
            return False

        return new_status in VALID_STATE_TRANSITIONS[current_status]

    def transition_ticket(
        self,
        ticket: TicketModel,
        new_status: TicketStatus,
        user_id: str,
        details: dict[str, Any] = None,
        ip_address: str = None,
        user_agent: str = None,
    ) -> TicketModel:
        """
        Transition ticket to new status with validation and audit logging.

        Args:
            ticket: Current ticket model
            new_status: Desired new status
            user_id: User performing the transition
            details: Optional additional details for audit trail
            ip_address: Optional IP address for audit
            user_agent: Optional user agent for audit

        Returns:
            Updated ticket model with new status

        Raises:
            StateTransitionError: If transition is invalid
        """
        # Validate transition
        if not self.can_transition(ticket.status, new_status):
            raise StateTransitionError(
                current_state=ticket.status,
                attempted_state=new_status,
                message=f"Invalid state transition from {ticket.status} to {new_status}",
            )

        old_status = ticket.status

        # Update ticket status and timestamp
        ticket.status = new_status
        ticket.updated_at = datetime.now(UTC)

        # Calculate compliance fields if transitioning to submitted
        if new_status == TicketStatus.SUBMITTED:
            ticket.submitted_at = datetime.now(UTC)
            ticket.lawful_start_date = (
                self.compliance_calculator.calculate_lawful_start_date()
            )
            ticket.ticket_expires_date = (
                self.compliance_calculator.calculate_ticket_expiration(
                    ticket.submitted_at
                )
            )

        # Create audit event
        audit_details = {
            "old_status": old_status.value,
            "new_status": new_status.value,
            **(details or {}),
        }

        audit_event = AuditEventModel(
            ticket_id=ticket.ticket_id,
            action=AuditAction.STATUS_CHANGED,
            user_id=user_id,
            details=audit_details,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        # Save audit event
        self.audit_storage.save_audit_event(audit_event)

        logger.info(
            f"Ticket {ticket.ticket_id} transitioned from {old_status} to {new_status} by user {user_id}"
        )

        return ticket

    def get_locked_fields(self, status: TicketStatus) -> list[str]:
        """
        Get list of locked fields for given ticket status.

        Args:
            status: Ticket status to check

        Returns:
            List of field names that are locked in this status
        """
        return LOCKED_FIELDS_BY_STATE.get(status, [])

    def validate_field_updates(
        self, status: TicketStatus, update_data: dict[str, Any]
    ) -> None:
        """
        Validate that field updates are allowed for current ticket status.

        Args:
            status: Current ticket status
            update_data: Dictionary of fields being updated

        Raises:
            FieldLockError: If any field updates are blocked by locking rules
        """
        locked_fields = self.get_locked_fields(status)

        # If all fields are locked (indicated by "*")
        if "*" in locked_fields:
            if update_data and any(field != "status" for field in update_data.keys()):
                raise FieldLockError(
                    locked_fields=["all fields"],
                    attempted_updates=update_data,
                    ticket_status=status,
                )

        # Check for specific locked fields
        blocked_fields = [
            field for field in update_data.keys() if field in locked_fields
        ]

        if blocked_fields:
            raise FieldLockError(
                locked_fields=locked_fields,
                attempted_updates=update_data,
                ticket_status=status,
            )

    def set_session_state(
        self,
        session_id: str,
        ticket_id: str,
        state_data: dict[str, Any],
        ttl: int = None,
    ) -> bool:
        """
        Store ticket state data in session.

        Args:
            session_id: Session identifier
            ticket_id: Ticket identifier
            state_data: State data to store
            ttl: Optional TTL override

        Returns:
            True if successful
        """
        session_key = f"ticket_state:{ticket_id}"

        # Get existing session data or create new
        existing_session = self.session_manager.get_session(session_id) or {}
        existing_session[session_key] = {
            **state_data,
            "last_updated": datetime.now(UTC).isoformat(),
        }

        return self.session_manager.set_session(session_id, existing_session, ttl)

    def get_session_state(
        self, session_id: str, ticket_id: str
    ) -> dict[str, Any] | None:
        """
        Retrieve ticket state data from session.

        Args:
            session_id: Session identifier
            ticket_id: Ticket identifier

        Returns:
            State data or None if not found
        """
        session_data = self.session_manager.get_session(session_id)
        if not session_data:
            return None

        session_key = f"ticket_state:{ticket_id}"
        return session_data.get(session_key)

    def update_session_state(
        self, session_id: str, ticket_id: str, updates: dict[str, Any]
    ) -> bool:
        """
        Update specific fields in session state.

        Args:
            session_id: Session identifier
            ticket_id: Ticket identifier
            updates: Fields to update

        Returns:
            True if successful
        """
        existing_state = self.get_session_state(session_id, ticket_id) or {}
        updated_state = {**existing_state, **updates}

        return self.set_session_state(session_id, ticket_id, updated_state)

    def clear_session_state(self, session_id: str, ticket_id: str) -> bool:
        """
        Clear ticket state data from session.

        Args:
            session_id: Session identifier
            ticket_id: Ticket identifier

        Returns:
            True if successful
        """
        session_data = self.session_manager.get_session(session_id)
        if not session_data:
            return False

        session_key = f"ticket_state:{ticket_id}"
        if session_key in session_data:
            del session_data[session_key]
            return self.session_manager.set_session(session_id, session_data)

        return True

    def clear_session(self, session_id: str) -> bool:
        """
        Clear all session data.

        Args:
            session_id: Session identifier to clear

        Returns:
            True if successful
        """
        return self.session_manager.delete_session(session_id)

    def get_ticket_state_history(self, ticket_id: str) -> list[AuditEventModel]:
        """
        Get complete state transition history for a ticket.

        Args:
            ticket_id: Ticket identifier

        Returns:
            List of audit events for state changes (newest first)
        """
        return self.audit_storage.get_audit_events(
            ticket_id=ticket_id, action=AuditAction.STATUS_CHANGED
        )

    def get_state_summary(self, ticket: TicketModel) -> dict[str, Any]:
        """
        Get comprehensive state summary for a ticket.

        Args:
            ticket: Ticket model

        Returns:
            Dictionary with state information and allowed actions
        """
        locked_fields = self.get_locked_fields(ticket.status)
        valid_transitions = VALID_STATE_TRANSITIONS.get(ticket.status, [])

        # Get lifecycle status from compliance calculator
        lifecycle_status = self.compliance_calculator.get_ticket_lifecycle_status(
            ticket.model_dump()
        )

        return {
            "current_status": ticket.status,
            "locked_fields": locked_fields,
            "valid_transitions": [status.value for status in valid_transitions],
            "can_edit_fields": len(locked_fields) == 0 or "*" not in locked_fields,
            "last_updated": ticket.updated_at.isoformat(),
            "lifecycle_info": lifecycle_status,
        }


# Convenience functions for common operations
def create_state_machine(
    session_manager: RedisSessionManager | None = None,
    audit_storage_path: Path | None = None,
) -> TicketStateMachine:
    """
    Create state machine instance with default dependencies.

    Args:
        session_manager: Optional session manager (uses global if None)
        audit_storage_path: Optional audit path (uses default if None)

    Returns:
        Configured TicketStateMachine instance
    """
    from .config import settings
    from .redis_client import session_manager as default_session_manager

    if session_manager is None:
        session_manager = default_session_manager

    if audit_storage_path is None:
        audit_storage_path = settings.audit_dir

    return TicketStateMachine(
        session_manager=session_manager, audit_storage_path=audit_storage_path
    )
