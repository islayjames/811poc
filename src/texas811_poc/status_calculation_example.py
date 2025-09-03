"""
Example usage of status calculation logic with storage integration.

This demonstrates how to use the status calculation functions
with the storage system for complete response tracking workflow.
"""

from pathlib import Path

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
from texas811_poc.storage import TicketStorage


def example_status_tracking_workflow():
    """
    Example workflow showing status tracking from submission to completion.

    This demonstrates:
    1. Creating a ticket with expected members
    2. Submitting member responses
    3. Automatic status transitions
    4. Storage integration
    """
    # Initialize storage
    storage = TicketStorage(Path("/tmp/example_storage"))

    # 1. Create ticket with expected members
    expected_members = [
        MemberInfo(member_code="ATMOS", member_name="Atmos Energy"),
        MemberInfo(member_code="ONCOR", member_name="Oncor Electric"),
        MemberInfo(member_code="WATER", member_name="City Water Department"),
    ]

    ticket = TicketModel(
        session_id="demo_session_123",
        county="Travis",
        city="Austin",
        address="123 Congress Ave",
        work_description="Installing fiber optic cable",
        status=TicketStatus.SUBMITTED,
        expected_members=expected_members,
    )

    # Save initial ticket
    storage.save_ticket(ticket)
    print(f"Initial ticket status: {ticket.status}")
    print(f"Expected responses: {len(ticket.expected_members)}")
    print()

    # 2. Simulate member responses coming in
    responses = []

    # First response - should trigger IN_PROGRESS status
    response1 = MemberResponseDetail(
        ticket_id=ticket.ticket_id,
        member_code="ATMOS",
        member_name="Atmos Energy",
        status=ResponseStatus.CLEAR,
        user_name="atmos.operator@atmose.com",
        comment="No facilities in work area",
    )
    responses.append(response1)

    # Update ticket status
    updated_ticket, status_changed = update_ticket_status_with_responses(
        ticket, responses
    )
    if status_changed:
        storage.save_ticket(updated_ticket, create_backup=True)
        ticket = updated_ticket

        summary = get_status_transition_summary(
            TicketStatus.SUBMITTED,
            ticket.status,
            len(responses),
            len(ticket.expected_members),
        )
        print(f"Status update: {summary}")
        print(f"Current status: {ticket.status}")
        print()

    # Second response - should keep IN_PROGRESS status
    response2 = MemberResponseDetail(
        ticket_id=ticket.ticket_id,
        member_code="ONCOR",
        member_name="Oncor Electric",
        status=ResponseStatus.NOT_CLEAR,
        user_name="oncor.locates@oncor.com",
        facilities="Electric: 12kV underground distribution",
        comment="Facilities present - marked with red paint",
    )
    responses.append(response2)

    # Update ticket status
    old_status = ticket.status
    updated_ticket, status_changed = update_ticket_status_with_responses(
        ticket, responses
    )
    if status_changed:
        storage.save_ticket(updated_ticket, create_backup=True)
        ticket = updated_ticket

        summary = get_status_transition_summary(
            old_status, ticket.status, len(responses), len(ticket.expected_members)
        )
        print(f"Status update: {summary}")
    else:
        print(
            f"Status unchanged: {ticket.status} ({len(responses)}/{len(ticket.expected_members)} responses)"
        )
    print()

    # Third response - should trigger RESPONSES_IN status
    response3 = MemberResponseDetail(
        ticket_id=ticket.ticket_id,
        member_code="WATER",
        member_name="City Water Department",
        status=ResponseStatus.CLEAR,
        user_name="water.locates@austintexas.gov",
        comment="No water lines in immediate work area",
    )
    responses.append(response3)

    # Final status update
    old_status = ticket.status
    updated_ticket, status_changed = update_ticket_status_with_responses(
        ticket, responses
    )
    if status_changed:
        storage.save_ticket(updated_ticket, create_backup=True)
        ticket = updated_ticket

        summary = get_status_transition_summary(
            old_status, ticket.status, len(responses), len(ticket.expected_members)
        )
        print(f"Status update: {summary}")
        print(f"Final status: {ticket.status}")
        print()

    # 3. Summary of final state
    print("=== Final Ticket State ===")
    print(f"Ticket ID: {ticket.ticket_id}")
    print(f"Status: {ticket.status}")
    print(f"Expected members: {len(ticket.expected_members)}")
    print(f"Responses received: {len(responses)}")
    print("\nResponse details:")
    for response in responses:
        print(f"  - {response.member_name}: {response.status}")
        if response.comment:
            print(f"    Comment: {response.comment}")
    print()


def example_legacy_behavior():
    """
    Example showing legacy behavior for tickets without expected members.
    """
    print("=== Legacy Behavior Demo ===")

    # Create ticket without expected members (legacy)
    legacy_ticket = TicketModel(
        session_id="legacy_session_456",
        county="Harris",
        city="Houston",
        address="456 Main St",
        work_description="Emergency gas line repair",
        status=TicketStatus.SUBMITTED,
        # expected_members defaults to empty list
    )

    print(f"Legacy ticket status: {legacy_ticket.status}")
    print(f"Expected members: {len(legacy_ticket.expected_members)} (legacy mode)")

    # Any response triggers RESPONSES_IN status
    legacy_responses = [
        MemberResponseDetail(
            ticket_id=legacy_ticket.ticket_id,
            member_code="UNKNOWN",
            member_name="Unknown Utility",
            status=ResponseStatus.CLEAR,
            user_name="utility@example.com",
        )
    ]

    new_status = calculate_ticket_status(legacy_ticket, legacy_responses)
    summary = get_status_transition_summary(
        legacy_ticket.status,
        new_status,
        len(legacy_responses),
        len(legacy_ticket.expected_members),
    )

    print(f"Status update: {summary}")
    print(f"New status: {new_status}")
    print()


if __name__ == "__main__":
    print("Texas 811 POC - Status Calculation Example")
    print("=" * 50)
    print()

    example_status_tracking_workflow()
    example_legacy_behavior()

    print("Example completed!")
