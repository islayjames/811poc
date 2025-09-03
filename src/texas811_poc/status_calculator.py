"""
Status calculation logic for expanded response tracking.

This module provides functions to calculate ticket status based on
response tracking state and expected member information.
"""

from texas811_poc.models import MemberResponseDetail, TicketModel, TicketStatus


def calculate_ticket_status(
    ticket: TicketModel, responses: list[MemberResponseDetail]
) -> TicketStatus:
    """
    Calculate ticket status based on response tracking state.

    Args:
        ticket: The ticket model containing expected members
        responses: List of member responses received for the ticket

    Returns:
        The calculated ticket status based on response tracking logic

    Logic:
        - If no expected members: Use legacy behavior (submitted → responses_in when any response)
        - If expected members but no responses: Keep current status
        - If expected members with partial responses: Set to in_progress
        - If expected members with all responses: Set to responses_in
    """
    # No expected members - use legacy logic
    if not ticket.expected_members:
        return TicketStatus.RESPONSES_IN if responses else ticket.status

    # With expected members - implement new logic
    if len(responses) == 0:
        return ticket.status  # Keep current status

    if len(responses) < len(ticket.expected_members):
        return TicketStatus.IN_PROGRESS  # Partial responses

    return TicketStatus.RESPONSES_IN  # All responded


def update_ticket_status_with_responses(
    ticket: TicketModel, responses: list[MemberResponseDetail]
) -> tuple[TicketModel, bool]:
    """
    Update ticket status based on current responses and return whether status changed.

    Args:
        ticket: The ticket model to potentially update
        responses: List of member responses for this ticket

    Returns:
        Tuple of (updated_ticket, status_changed)

    Note:
        This function does not persist the changes. Use with storage.save_ticket().
    """
    old_status = ticket.status
    new_status = calculate_ticket_status(ticket, responses)

    if old_status != new_status:
        # Create updated ticket with new status
        updated_data = ticket.model_dump()
        updated_data["status"] = new_status
        updated_ticket = TicketModel.model_validate(updated_data)
        return updated_ticket, True
    else:
        return ticket, False


def get_status_transition_summary(
    old_status: TicketStatus,
    new_status: TicketStatus,
    responses_count: int,
    expected_count: int,
) -> str:
    """
    Generate a human-readable summary of status transition.

    Args:
        old_status: Previous ticket status
        new_status: New ticket status
        responses_count: Number of responses received
        expected_count: Number of expected responses

    Returns:
        Human-readable transition summary
    """
    # Handle both enum and string status values
    old_status_str = (
        old_status.value if hasattr(old_status, "value") else str(old_status)
    )
    new_status_str = (
        new_status.value if hasattr(new_status, "value") else str(new_status)
    )

    if old_status == new_status:
        return f"Status unchanged: {old_status_str}"

    transition_messages = {
        (
            TicketStatus.SUBMITTED,
            TicketStatus.IN_PROGRESS,
        ): f"First response received ({responses_count}/{expected_count})",
        (
            TicketStatus.IN_PROGRESS,
            TicketStatus.RESPONSES_IN,
        ): f"All responses received ({responses_count}/{expected_count})",
        (TicketStatus.SUBMITTED, TicketStatus.RESPONSES_IN): "Responses received"
        + (f" ({responses_count}/{expected_count})" if expected_count > 0 else ""),
    }

    return transition_messages.get(
        (old_status, new_status),
        f"Status changed from {old_status_str} to {new_status_str}",
    )
