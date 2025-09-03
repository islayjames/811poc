"""
Integration tests for member management with the complete response tracking system.

Tests the end-to-end workflow of:
1. Unknown member submits response
2. Member gets added to expected_members
3. Status calculation accounts for new member
4. Persistence works correctly
"""

import shutil
import tempfile
from pathlib import Path

import pytest
from texas811_poc.member_management import handle_unknown_member
from texas811_poc.models import (
    MemberInfo,
    MemberResponseDetail,
    ResponseStatus,
    TicketModel,
    TicketStatus,
)
from texas811_poc.status_calculator import calculate_ticket_status
from texas811_poc.storage import TicketStorage


class TestMemberManagementIntegration:
    """Integration tests for complete member management workflow."""

    def setup_method(self):
        """Set up temporary storage for each test."""
        self.temp_dir = tempfile.mkdtemp()
        self.storage = TicketStorage(Path(self.temp_dir))

    def teardown_method(self):
        """Clean up temporary storage after each test."""
        shutil.rmtree(self.temp_dir)

    def test_complete_unknown_member_response_workflow(self):
        """
        Test the complete workflow from unknown member response to status calculation.

        Scenario:
        1. Create a submitted ticket with no expected members
        2. Unknown member "CenterPoint" submits a response
        3. System adds CenterPoint to expected_members
        4. Status calculation shows ticket as RESPONSES_IN
        5. Persistence works correctly
        """
        # Step 1: Create ticket with no expected members
        ticket = TicketModel(
            session_id="test-session-001",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Install new fiber line",
            status=TicketStatus.SUBMITTED,
            expected_members=[],
        )

        # Save initial ticket
        self.storage.save_ticket(ticket)

        # Step 2: Unknown member submits response
        response = MemberResponseDetail(
            ticket_id=ticket.ticket_id,
            member_code="CenterPoint",
            member_name="CenterPoint Energy",
            status=ResponseStatus.CLEAR,
            user_name="operator@centerpoint.com",
            facilities="No electric facilities in work area",
            comment="Area is clear for excavation",
        )

        # Step 3: Handle unknown member (simulates response processing)
        updated_ticket = handle_unknown_member(
            ticket, response.member_code, response.member_name
        )

        # Verify member was added
        assert len(updated_ticket.expected_members) == 1
        assert updated_ticket.expected_members[0].member_code == "CenterPoint"
        assert updated_ticket.expected_members[0].member_name == "CenterPoint Energy"

        # Step 4: Calculate status with responses
        responses = [response]
        calculated_status = calculate_ticket_status(updated_ticket, responses)

        # Status should be RESPONSES_IN since all expected members responded
        assert calculated_status == TicketStatus.RESPONSES_IN

        # Step 5: Save updated ticket and verify persistence
        updated_ticket_data = updated_ticket.model_dump()
        updated_ticket_data["status"] = calculated_status
        final_ticket = TicketModel.model_validate(updated_ticket_data)

        self.storage.save_ticket(final_ticket)

        # Load from storage and verify everything persisted correctly
        loaded_ticket = self.storage.load_ticket(ticket.ticket_id)
        assert loaded_ticket is not None
        assert loaded_ticket.status == TicketStatus.RESPONSES_IN
        assert len(loaded_ticket.expected_members) == 1
        assert loaded_ticket.expected_members[0].member_code == "CenterPoint"

    def test_multiple_unknown_members_workflow(self):
        """
        Test workflow with multiple unknown members submitting responses progressively.

        Scenario:
        1. Ticket starts with no expected members
        2. CenterPoint responds -> ticket goes to IN_PROGRESS
        3. Atmos responds -> ticket goes to IN_PROGRESS
        4. Comcast responds -> ticket goes to RESPONSES_IN
        """
        # Create initial ticket
        ticket = TicketModel(
            session_id="test-session-002",
            county="Travis",
            city="Austin",
            address="456 Oak Ave",
            work_description="Water line repair",
            status=TicketStatus.SUBMITTED,
            expected_members=[],
        )

        # First response from CenterPoint
        ticket = handle_unknown_member(ticket, "CenterPoint", "CenterPoint Energy")
        response1 = MemberResponseDetail(
            ticket_id=ticket.ticket_id,
            member_code="CenterPoint",
            member_name="CenterPoint Energy",
            status=ResponseStatus.NOT_CLEAR,
            user_name="ops1@centerpoint.com",
            facilities="Electric lines present",
            comment="Hand dig within 2 feet of marked utilities",
        )

        # Status should be RESPONSES_IN (all expected members responded)
        status1 = calculate_ticket_status(ticket, [response1])
        assert status1 == TicketStatus.RESPONSES_IN

        # Second response from Atmos (unknown member)
        ticket = handle_unknown_member(ticket, "Atmos", "Atmos Energy")
        response2 = MemberResponseDetail(
            ticket_id=ticket.ticket_id,
            member_code="Atmos",
            member_name="Atmos Energy",
            status=ResponseStatus.CLEAR,
            user_name="dispatch@atmos.com",
            facilities="No gas facilities",
        )

        # Status should be IN_PROGRESS (partial responses: 1 of 2 expected)
        status2 = calculate_ticket_status(ticket, [response1])
        assert status2 == TicketStatus.IN_PROGRESS

        # All responses received
        status3 = calculate_ticket_status(ticket, [response1, response2])
        assert status3 == TicketStatus.RESPONSES_IN

        # Verify final state
        assert len(ticket.expected_members) == 2
        member_codes = [m.member_code for m in ticket.expected_members]
        assert "CenterPoint" in member_codes
        assert "Atmos" in member_codes

    def test_duplicate_member_response_handling(self):
        """
        Test that duplicate responses from same member don't create duplicate entries.
        """
        # Create ticket with existing member
        existing_member = MemberInfo(
            member_code="CenterPoint",
            member_name="CenterPoint Energy",
            contact_phone="555-0100",
        )
        ticket = TicketModel(
            session_id="test-session-003",
            county="Dallas",
            city="Dallas",
            address="789 Elm St",
            work_description="Sidewalk repair",
            status=TicketStatus.SUBMITTED,
            expected_members=[existing_member],
        )

        # Same member submits another response (maybe an update)
        ticket = handle_unknown_member(
            ticket, "CenterPoint", "CenterPoint Energy Texas"
        )

        # Verify no duplicate and original data preserved
        assert len(ticket.expected_members) == 1
        assert (
            ticket.expected_members[0].member_name == "CenterPoint Energy"
        )  # Original name
        assert (
            ticket.expected_members[0].contact_phone == "555-0100"
        )  # Original contact

    def test_case_insensitive_member_handling(self):
        """Test that member code matching is case insensitive."""
        # Create ticket with lowercase member code
        existing_member = MemberInfo(
            member_code="centerpoint", member_name="CenterPoint Energy"
        )
        ticket = TicketModel(
            session_id="test-session-004",
            county="Collin",
            city="Plano",
            address="321 Pine Dr",
            work_description="Driveway expansion",
            status=TicketStatus.SUBMITTED,
            expected_members=[existing_member],
        )

        # Response comes in with uppercase member code
        ticket = handle_unknown_member(ticket, "CENTERPOINT", "CenterPoint Energy Corp")

        # Should not create duplicate
        assert len(ticket.expected_members) == 1
        assert (
            ticket.expected_members[0].member_code == "centerpoint"
        )  # Original case preserved

        # Status calculation should work correctly
        response = MemberResponseDetail(
            ticket_id=ticket.ticket_id,
            member_code="CENTERPOINT",  # Different case
            member_name="CenterPoint Energy Corp",
            status=ResponseStatus.CLEAR,
            user_name="ops@centerpoint.com",
        )

        status = calculate_ticket_status(ticket, [response])
        assert status == TicketStatus.RESPONSES_IN  # Should recognize as complete

    def test_storage_persistence_with_member_updates(self):
        """Test that member updates persist correctly through storage operations."""
        # Create and save initial ticket
        ticket = TicketModel(
            session_id="test-session-005",
            county="Fort Bend",
            city="Sugar Land",
            address="654 Maple Ln",
            work_description="Pool installation",
            status=TicketStatus.SUBMITTED,
            expected_members=[],
        )

        self.storage.save_ticket(ticket)

        # Load ticket and add first member
        loaded_ticket = self.storage.load_ticket(ticket.ticket_id)
        updated_ticket = handle_unknown_member(
            loaded_ticket, "CenterPoint", "CenterPoint Energy"
        )
        self.storage.save_ticket(updated_ticket)

        # Load again and add second member
        loaded_ticket2 = self.storage.load_ticket(ticket.ticket_id)
        updated_ticket2 = handle_unknown_member(loaded_ticket2, "Atmos", "Atmos Energy")
        self.storage.save_ticket(updated_ticket2)

        # Final load and verification
        final_ticket = self.storage.load_ticket(ticket.ticket_id)
        assert len(final_ticket.expected_members) == 2

        member_codes = [m.member_code for m in final_ticket.expected_members]
        assert "CenterPoint" in member_codes
        assert "Atmos" in member_codes

        # Verify each member has proper structure
        for member in final_ticket.expected_members:
            assert isinstance(member, MemberInfo)
            assert member.member_code
            assert member.member_name
            assert member.is_active is True

    def test_error_handling_in_integration_workflow(self):
        """Test error handling throughout the integration workflow."""
        ticket = TicketModel(
            session_id="test-session-006",
            county="Williamson",
            city="Round Rock",
            address="987 Cedar Blvd",
            work_description="Foundation work",
            status=TicketStatus.SUBMITTED,
            expected_members=[],
        )

        # Test invalid member code
        with pytest.raises(ValueError, match="Member code cannot be empty"):
            handle_unknown_member(ticket, "", "Some Utility")

        # Test invalid member name
        with pytest.raises(ValueError, match="Member name cannot be empty"):
            handle_unknown_member(ticket, "SomeCode", "")

        # Test that valid operations still work after errors
        valid_ticket = handle_unknown_member(ticket, "ValidCode", "Valid Utility")
        assert len(valid_ticket.expected_members) == 1
        assert valid_ticket.expected_members[0].member_code == "ValidCode"

    def test_member_management_with_existing_expected_members(self):
        """
        Test member management when ticket already has expected members from setup.

        Scenario: Ticket created with pre-populated expected members,
        then unknown members submit responses.
        """
        # Create ticket with pre-existing expected members
        pre_existing_members = [
            MemberInfo(member_code="CenterPoint", member_name="CenterPoint Energy"),
            MemberInfo(member_code="Atmos", member_name="Atmos Energy"),
        ]

        ticket = TicketModel(
            session_id="test-session-007",
            county="Tarrant",
            city="Fort Worth",
            address="111 Ranch Rd",
            work_description="Fence installation",
            status=TicketStatus.SUBMITTED,
            expected_members=pre_existing_members,
        )

        # Unknown member responds
        ticket = handle_unknown_member(ticket, "Comcast", "Comcast Cable")

        # Verify all members present
        assert len(ticket.expected_members) == 3
        member_codes = [m.member_code for m in ticket.expected_members]
        assert "CenterPoint" in member_codes
        assert "Atmos" in member_codes
        assert "Comcast" in member_codes

        # Test status calculation with mixed responses
        responses = [
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="CenterPoint",
                member_name="CenterPoint Energy",
                status=ResponseStatus.CLEAR,
                user_name="ops1@centerpoint.com",
            ),
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="Comcast",
                member_name="Comcast Cable",
                status=ResponseStatus.NOT_CLEAR,
                user_name="tech@comcast.com",
            ),
        ]

        # Partial responses (2 of 3) should be IN_PROGRESS
        status = calculate_ticket_status(ticket, responses)
        assert status == TicketStatus.IN_PROGRESS

        # Add third response
        responses.append(
            MemberResponseDetail(
                ticket_id=ticket.ticket_id,
                member_code="Atmos",
                member_name="Atmos Energy",
                status=ResponseStatus.CLEAR,
                user_name="dispatch@atmos.com",
            )
        )

        # All responses (3 of 3) should be RESPONSES_IN
        status = calculate_ticket_status(ticket, responses)
        assert status == TicketStatus.RESPONSES_IN
