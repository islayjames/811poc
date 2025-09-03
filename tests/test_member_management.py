"""
Test suite for member management logic in expanded response tracking.

Tests the functionality for:
- Adding unknown members to expected_members list
- Preventing duplicate members
- Member list persistence in JSON storage
- Integration with ticket storage operations
"""

import shutil
import tempfile
from pathlib import Path

import pytest

from texas811_poc.member_management import (
    add_member_to_ticket,
    ensure_member_exists,
    get_member_by_code,
    handle_unknown_member,
    is_member_in_list,
)
from texas811_poc.models import (
    MemberInfo,
    MemberResponseDetail,
    ResponseStatus,
    TicketModel,
    TicketStatus,
)
from texas811_poc.storage import TicketStorage


class TestMemberManagement:
    """Test suite for member management functions."""

    def test_handle_unknown_member_adds_new_member(self):
        """Test that handle_unknown_member adds a new member when not already present."""
        # Create ticket with no expected members
        ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
            expected_members=[],
        )

        # Add unknown member
        updated_ticket = handle_unknown_member(
            ticket, "CenterPoint", "CenterPoint Energy"
        )

        # Verify member was added
        assert len(updated_ticket.expected_members) == 1
        assert updated_ticket.expected_members[0].member_code == "CenterPoint"
        assert updated_ticket.expected_members[0].member_name == "CenterPoint Energy"
        assert updated_ticket.expected_members[0].is_active is True

    def test_handle_unknown_member_ignores_duplicate(self):
        """Test that handle_unknown_member does not add duplicate members."""
        # Create ticket with existing member
        existing_member = MemberInfo(
            member_code="CenterPoint", member_name="CenterPoint Energy"
        )
        ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
            expected_members=[existing_member],
        )

        # Attempt to add same member
        updated_ticket = handle_unknown_member(
            ticket, "CenterPoint", "CenterPoint Energy Texas"
        )

        # Verify no duplicate was added and original preserved
        assert len(updated_ticket.expected_members) == 1
        assert updated_ticket.expected_members[0].member_code == "CenterPoint"
        assert (
            updated_ticket.expected_members[0].member_name == "CenterPoint Energy"
        )  # Original name preserved

    def test_handle_unknown_member_case_insensitive_duplicate_check(self):
        """Test that duplicate checking is case insensitive."""
        # Create ticket with existing member
        existing_member = MemberInfo(
            member_code="centerpoint", member_name="CenterPoint Energy"
        )
        ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
            expected_members=[existing_member],
        )

        # Attempt to add same member with different case
        updated_ticket = handle_unknown_member(
            ticket, "CENTERPOINT", "CenterPoint Energy Texas"
        )

        # Verify no duplicate was added
        assert len(updated_ticket.expected_members) == 1
        assert (
            updated_ticket.expected_members[0].member_code == "centerpoint"
        )  # Original case preserved

    def test_handle_unknown_member_adds_multiple_different_members(self):
        """Test that multiple different members can be added."""
        ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
            expected_members=[],
        )

        # Add first member
        ticket = handle_unknown_member(ticket, "CenterPoint", "CenterPoint Energy")

        # Add second member
        ticket = handle_unknown_member(ticket, "Atmos", "Atmos Energy")

        # Add third member
        ticket = handle_unknown_member(ticket, "Comcast", "Comcast Cable")

        # Verify all members were added
        assert len(ticket.expected_members) == 3
        member_codes = [m.member_code for m in ticket.expected_members]
        assert "CenterPoint" in member_codes
        assert "Atmos" in member_codes
        assert "Comcast" in member_codes

    def test_is_member_in_list_finds_existing_member(self):
        """Test that is_member_in_list correctly identifies existing members."""
        members = [
            MemberInfo(member_code="CenterPoint", member_name="CenterPoint Energy"),
            MemberInfo(member_code="Atmos", member_name="Atmos Energy"),
        ]

        assert is_member_in_list("CenterPoint", members) is True
        assert is_member_in_list("centerpoint", members) is True  # Case insensitive
        assert is_member_in_list("ATMOS", members) is True
        assert is_member_in_list("Comcast", members) is False

    def test_is_member_in_list_empty_list(self):
        """Test that is_member_in_list handles empty list correctly."""
        assert is_member_in_list("CenterPoint", []) is False

    def test_add_member_to_ticket_creates_new_member_info(self):
        """Test that add_member_to_ticket creates proper MemberInfo object."""
        ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
            expected_members=[],
        )

        updated_ticket = add_member_to_ticket(
            ticket, "CenterPoint", "CenterPoint Energy"
        )

        # Verify member was added with proper structure
        assert len(updated_ticket.expected_members) == 1
        member = updated_ticket.expected_members[0]
        assert isinstance(member, MemberInfo)
        assert member.member_code == "CenterPoint"
        assert member.member_name == "CenterPoint Energy"
        assert member.is_active is True
        assert member.contact_phone is None
        assert member.contact_email is None

    def test_ensure_member_exists_adds_missing_member(self):
        """Test that ensure_member_exists adds member when not present."""
        ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
            expected_members=[],
        )

        updated_ticket = ensure_member_exists(
            ticket, "CenterPoint", "CenterPoint Energy"
        )

        assert len(updated_ticket.expected_members) == 1
        assert updated_ticket.expected_members[0].member_code == "CenterPoint"

    def test_ensure_member_exists_preserves_existing_member(self):
        """Test that ensure_member_exists doesn't modify existing member."""
        existing_member = MemberInfo(
            member_code="CenterPoint",
            member_name="CenterPoint Energy",
            contact_phone="555-0123",
        )
        ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
            expected_members=[existing_member],
        )

        updated_ticket = ensure_member_exists(ticket, "CenterPoint", "New Name")

        # Verify existing member preserved
        assert len(updated_ticket.expected_members) == 1
        assert (
            updated_ticket.expected_members[0].member_name == "CenterPoint Energy"
        )  # Original name
        assert (
            updated_ticket.expected_members[0].contact_phone == "555-0123"
        )  # Original data

    def test_get_member_by_code_finds_existing_member(self):
        """Test that get_member_by_code returns correct member."""
        members = [
            MemberInfo(member_code="CenterPoint", member_name="CenterPoint Energy"),
            MemberInfo(member_code="Atmos", member_name="Atmos Energy"),
        ]

        member = get_member_by_code("CenterPoint", members)
        assert member is not None
        assert member.member_name == "CenterPoint Energy"

        member = get_member_by_code("centerpoint", members)  # Case insensitive
        assert member is not None
        assert member.member_name == "CenterPoint Energy"

    def test_get_member_by_code_returns_none_for_missing_member(self):
        """Test that get_member_by_code returns None for non-existent member."""
        members = [
            MemberInfo(member_code="CenterPoint", member_name="CenterPoint Energy")
        ]

        member = get_member_by_code("NonExistent", members)
        assert member is None

    def test_handle_unknown_member_preserves_ticket_immutability(self):
        """Test that handle_unknown_member doesn't modify original ticket."""
        original_ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
            expected_members=[],
        )

        # Store original data for comparison
        original_member_count = len(original_ticket.expected_members)

        # Call function
        updated_ticket = handle_unknown_member(
            original_ticket, "CenterPoint", "CenterPoint Energy"
        )

        # Verify original ticket unchanged
        assert len(original_ticket.expected_members) == original_member_count
        assert updated_ticket is not original_ticket  # Different objects

    def test_member_validation_errors(self):
        """Test that member functions handle invalid input properly."""
        ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
        )

        # Test empty member code
        with pytest.raises(ValueError, match="Member code cannot be empty"):
            handle_unknown_member(ticket, "", "Some Name")

        # Test empty member name
        with pytest.raises(ValueError, match="Member name cannot be empty"):
            handle_unknown_member(ticket, "SomeCode", "")

        # Test whitespace-only inputs
        with pytest.raises(ValueError, match="Member code cannot be empty"):
            handle_unknown_member(ticket, "   ", "Some Name")

        with pytest.raises(ValueError, match="Member name cannot be empty"):
            handle_unknown_member(ticket, "SomeCode", "   ")


class TestMemberPersistence:
    """Test suite for member persistence in JSON storage."""

    def setup_method(self):
        """Set up temporary storage for each test."""
        self.temp_dir = tempfile.mkdtemp()
        self.storage = TicketStorage(Path(self.temp_dir))

    def teardown_method(self):
        """Clean up temporary storage after each test."""
        shutil.rmtree(self.temp_dir)

    def test_member_list_persists_in_storage(self):
        """Test that expected_members list is properly saved and loaded."""
        # Create ticket with members
        ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
            expected_members=[
                MemberInfo(member_code="CenterPoint", member_name="CenterPoint Energy"),
                MemberInfo(
                    member_code="Atmos",
                    member_name="Atmos Energy",
                    contact_phone="555-0123",
                ),
            ],
        )

        # Save ticket
        self.storage.save_ticket(ticket)

        # Load ticket
        loaded_ticket = self.storage.load_ticket(ticket.ticket_id)

        # Verify members persisted correctly
        assert loaded_ticket is not None
        assert len(loaded_ticket.expected_members) == 2

        # Check first member
        member1 = loaded_ticket.expected_members[0]
        assert member1.member_code == "CenterPoint"
        assert member1.member_name == "CenterPoint Energy"
        assert member1.is_active is True

        # Check second member with contact info
        member2 = loaded_ticket.expected_members[1]
        assert member2.member_code == "Atmos"
        assert member2.member_name == "Atmos Energy"
        assert member2.contact_phone == "555-0123"

    def test_empty_member_list_persists(self):
        """Test that empty expected_members list persists correctly."""
        ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
            expected_members=[],
        )

        self.storage.save_ticket(ticket)
        loaded_ticket = self.storage.load_ticket(ticket.ticket_id)

        assert loaded_ticket is not None
        assert len(loaded_ticket.expected_members) == 0

    def test_member_update_persists(self):
        """Test that updates to member list persist correctly."""
        # Create and save initial ticket
        ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
            expected_members=[],
        )
        self.storage.save_ticket(ticket)

        # Load and update ticket with new member
        loaded_ticket = self.storage.load_ticket(ticket.ticket_id)
        updated_ticket = handle_unknown_member(
            loaded_ticket, "CenterPoint", "CenterPoint Energy"
        )
        self.storage.save_ticket(updated_ticket)

        # Load again and verify member persisted
        final_ticket = self.storage.load_ticket(ticket.ticket_id)
        assert len(final_ticket.expected_members) == 1
        assert final_ticket.expected_members[0].member_code == "CenterPoint"

    def test_member_data_types_persist_correctly(self):
        """Test that all MemberInfo field types persist correctly."""
        member = MemberInfo(
            member_code="TestUtility",
            member_name="Test Utility Company",
            contact_phone="555-0123",
            contact_email="contact@testutil.com",
            is_active=False,  # Test boolean field
        )

        ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
            expected_members=[member],
        )

        self.storage.save_ticket(ticket)
        loaded_ticket = self.storage.load_ticket(ticket.ticket_id)

        loaded_member = loaded_ticket.expected_members[0]
        assert loaded_member.member_code == "TestUtility"
        assert loaded_member.member_name == "Test Utility Company"
        assert loaded_member.contact_phone == "555-0123"
        assert loaded_member.contact_email == "contact@testutil.com"
        assert loaded_member.is_active is False  # Boolean preserved


class TestMemberManagementIntegration:
    """Integration tests for member management with response workflow."""

    def setup_method(self):
        """Set up temporary storage for each test."""
        self.temp_dir = tempfile.mkdtemp()
        self.storage = TicketStorage(Path(self.temp_dir))

    def teardown_method(self):
        """Clean up temporary storage after each test."""
        shutil.rmtree(self.temp_dir)

    def test_unknown_member_workflow_with_response_submission(self):
        """Test complete workflow: unknown member submits response, gets added to ticket."""
        # Create ticket with no expected members
        ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
            expected_members=[],
        )
        self.storage.save_ticket(ticket)

        # Simulate response from unknown member
        response = MemberResponseDetail(
            ticket_id=ticket.ticket_id,
            member_code="CenterPoint",
            member_name="CenterPoint Energy",
            status=ResponseStatus.CLEAR,
            user_name="operator@centerpoint.com",
            facilities="No facilities in area",
        )

        # Handle unknown member (this would be called during response processing)
        updated_ticket = handle_unknown_member(
            ticket, response.member_code, response.member_name
        )
        self.storage.save_ticket(updated_ticket)

        # Verify member was added
        loaded_ticket = self.storage.load_ticket(ticket.ticket_id)
        assert len(loaded_ticket.expected_members) == 1
        assert loaded_ticket.expected_members[0].member_code == "CenterPoint"
        assert loaded_ticket.expected_members[0].member_name == "CenterPoint Energy"

    def test_member_management_with_status_calculation(self):
        """Test that member management integrates properly with status calculation."""
        from texas811_poc.status_calculator import calculate_ticket_status

        # Create submitted ticket with no expected members
        ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
            status=TicketStatus.SUBMITTED,
            expected_members=[],
        )

        # Add unknown member when response comes in
        ticket = handle_unknown_member(ticket, "CenterPoint", "CenterPoint Energy")

        # Create response
        responses = [
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="CenterPoint",
                member_name="CenterPoint Energy",
                status=ResponseStatus.CLEAR,
                user_name="operator@centerpoint.com",
            )
        ]

        # Calculate status - should be RESPONSES_IN since all expected members responded
        new_status = calculate_ticket_status(ticket, responses)
        assert new_status == TicketStatus.RESPONSES_IN

    def test_multiple_unknown_members_response_workflow(self):
        """Test workflow with multiple unknown members submitting responses."""
        ticket = TicketModel(
            session_id="test-session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
            status=TicketStatus.SUBMITTED,
            expected_members=[],
        )

        # First unknown member responds
        ticket = handle_unknown_member(ticket, "CenterPoint", "CenterPoint Energy")

        # Second unknown member responds
        ticket = handle_unknown_member(ticket, "Atmos", "Atmos Energy")

        # Third unknown member responds
        ticket = handle_unknown_member(ticket, "Comcast", "Comcast Cable")

        # Verify all members added
        assert len(ticket.expected_members) == 3
        member_codes = [m.member_code for m in ticket.expected_members]
        assert "CenterPoint" in member_codes
        assert "Atmos" in member_codes
        assert "Comcast" in member_codes

        # Save and reload to verify persistence
        self.storage.save_ticket(ticket)
        loaded_ticket = self.storage.load_ticket(ticket.ticket_id)
        assert len(loaded_ticket.expected_members) == 3
