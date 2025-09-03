"""
Member management logic for expanded response tracking.

This module provides functions to manage utility members in the expected_members
list for tickets, supporting dynamic addition of unknown members when they
submit responses and preventing duplicate entries.

Key Features:
- Add unknown members when responses are received
- Prevent duplicate members based on member_code
- Case-insensitive member code matching
- Immutable operations (return new ticket instances)
- Integration with JSON storage persistence
"""

from texas811_poc.models import MemberInfo, TicketModel


def handle_unknown_member(
    ticket: TicketModel, member_code: str, member_name: str
) -> TicketModel:
    """
    Add unknown member to ticket's expected_members list if not already present.

    This function is called when a response is received from a utility member
    that is not in the expected_members list. It ensures the member is added
    to track future responses properly.

    Args:
        ticket: The ticket model to potentially update
        member_code: Short code identifying the utility member
        member_name: Full name of the utility member

    Returns:
        Updated ticket model with member added (if needed)

    Raises:
        ValueError: If member_code or member_name is empty or whitespace-only

    Note:
        This function does not modify the original ticket. It returns a new
        ticket instance with the updated expected_members list.
    """
    # Validate inputs
    if not member_code or not member_code.strip():
        raise ValueError("Member code cannot be empty")
    if not member_name or not member_name.strip():
        raise ValueError("Member name cannot be empty")

    # Clean inputs
    member_code = member_code.strip()
    member_name = member_name.strip()

    # Check if member already exists (case insensitive)
    if is_member_in_list(member_code, ticket.expected_members):
        return ticket  # Return unchanged ticket

    # Add new member to the list
    return add_member_to_ticket(ticket, member_code, member_name)


def is_member_in_list(member_code: str, members: list[MemberInfo]) -> bool:
    """
    Check if a member with the given code exists in the members list.

    Performs case-insensitive matching on member codes.

    Args:
        member_code: The member code to search for
        members: List of MemberInfo objects to search

    Returns:
        True if member exists, False otherwise
    """
    member_code_lower = member_code.lower()
    return any(member.member_code.lower() == member_code_lower for member in members)


def add_member_to_ticket(
    ticket: TicketModel, member_code: str, member_name: str
) -> TicketModel:
    """
    Add a new member to the ticket's expected_members list.

    Creates a new ticket instance with the member added to the expected_members
    list. This function assumes the member does not already exist.

    Args:
        ticket: The ticket model to update
        member_code: Short code for the member
        member_name: Full name of the member

    Returns:
        New ticket instance with member added
    """
    new_member = MemberInfo(
        member_code=member_code, member_name=member_name, is_active=True
    )

    # Create new ticket with updated members list
    updated_data = ticket.model_dump()
    updated_data["expected_members"] = ticket.expected_members + [new_member]

    return TicketModel.model_validate(updated_data)


def ensure_member_exists(
    ticket: TicketModel, member_code: str, member_name: str
) -> TicketModel:
    """
    Ensure a member exists in the expected_members list, adding if necessary.

    This is an idempotent operation - if the member already exists, the ticket
    is returned unchanged. If not, the member is added.

    Args:
        ticket: The ticket model to potentially update
        member_code: Short code identifying the utility member
        member_name: Full name of the utility member

    Returns:
        Ticket model with member guaranteed to be in expected_members list
    """
    if is_member_in_list(member_code, ticket.expected_members):
        return ticket

    return add_member_to_ticket(ticket, member_code, member_name)


def get_member_by_code(
    member_code: str, members: list[MemberInfo]
) -> MemberInfo | None:
    """
    Find a member in the list by their member code.

    Performs case-insensitive matching on member codes.

    Args:
        member_code: The member code to search for
        members: List of MemberInfo objects to search

    Returns:
        MemberInfo object if found, None otherwise
    """
    member_code_lower = member_code.lower()
    for member in members:
        if member.member_code.lower() == member_code_lower:
            return member
    return None


def update_member_info(
    ticket: TicketModel,
    member_code: str,
    contact_phone: str | None = None,
    contact_email: str | None = None,
    is_active: bool | None = None,
) -> TicketModel:
    """
    Update contact information for an existing member.

    This function allows updating optional fields for members that are already
    in the expected_members list. If the member doesn't exist, returns the
    ticket unchanged.

    Args:
        ticket: The ticket model to potentially update
        member_code: Code of the member to update
        contact_phone: New contact phone (if provided)
        contact_email: New contact email (if provided)
        is_active: New active status (if provided)

    Returns:
        Updated ticket model if member found, unchanged ticket otherwise
    """
    member = get_member_by_code(member_code, ticket.expected_members)
    if not member:
        return ticket  # Member not found, return unchanged

    # Create updated member with new contact info
    updated_member_data = member.model_dump()
    if contact_phone is not None:
        updated_member_data["contact_phone"] = contact_phone
    if contact_email is not None:
        updated_member_data["contact_email"] = contact_email
    if is_active is not None:
        updated_member_data["is_active"] = is_active

    updated_member = MemberInfo.model_validate(updated_member_data)

    # Replace member in the list
    updated_members = []
    for existing_member in ticket.expected_members:
        if existing_member.member_code.lower() == member_code.lower():
            updated_members.append(updated_member)
        else:
            updated_members.append(existing_member)

    # Create new ticket with updated members list
    updated_data = ticket.model_dump()
    updated_data["expected_members"] = updated_members

    return TicketModel.model_validate(updated_data)


def remove_member_from_ticket(ticket: TicketModel, member_code: str) -> TicketModel:
    """
    Remove a member from the ticket's expected_members list.

    Performs case-insensitive matching on member codes. If the member is not
    found, returns the ticket unchanged.

    Args:
        ticket: The ticket model to potentially update
        member_code: Code of the member to remove

    Returns:
        Updated ticket model with member removed (if found)
    """
    member_code_lower = member_code.lower()

    # Filter out the member with matching code
    updated_members = [
        member
        for member in ticket.expected_members
        if member.member_code.lower() != member_code_lower
    ]

    # If no members were removed, return unchanged ticket
    if len(updated_members) == len(ticket.expected_members):
        return ticket

    # Create new ticket with updated members list
    updated_data = ticket.model_dump()
    updated_data["expected_members"] = updated_members

    return TicketModel.model_validate(updated_data)


def get_member_summary(ticket: TicketModel) -> dict[str, int]:
    """
    Get summary statistics about members in the ticket.

    Args:
        ticket: The ticket model to analyze

    Returns:
        Dictionary with member statistics:
        - total_members: Total number of expected members
        - active_members: Number of active members
        - inactive_members: Number of inactive members
        - members_with_phone: Number of members with contact phone
        - members_with_email: Number of members with contact email
    """
    members = ticket.expected_members

    return {
        "total_members": len(members),
        "active_members": sum(1 for m in members if m.is_active),
        "inactive_members": sum(1 for m in members if not m.is_active),
        "members_with_phone": sum(1 for m in members if m.contact_phone),
        "members_with_email": sum(1 for m in members if m.contact_email),
    }


def validate_member_codes(members: list[MemberInfo]) -> list[str]:
    """
    Validate member codes in a list and return any issues found.

    Checks for:
    - Empty or whitespace-only member codes
    - Duplicate member codes (case insensitive)

    Args:
        members: List of MemberInfo objects to validate

    Returns:
        List of validation error messages (empty if all valid)
    """
    errors = []
    seen_codes = set()

    for i, member in enumerate(members):
        # Check for empty/whitespace codes
        if not member.member_code or not member.member_code.strip():
            errors.append(f"Member at index {i} has empty member_code")
            continue

        # Check for duplicates (case insensitive)
        code_lower = member.member_code.lower()
        if code_lower in seen_codes:
            errors.append(
                f"Duplicate member_code '{member.member_code}' found at index {i}"
            )
        else:
            seen_codes.add(code_lower)

    return errors
