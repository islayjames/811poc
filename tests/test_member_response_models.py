"""
Tests for member response tracking models.

Following TDD approach for Task 2: Response Models & Validation.
Tests for MemberResponseRequest, MemberResponseDetail, ResponseSummary, and MemberInfo models.
"""

import json
from datetime import datetime

import pytest
from pydantic import ValidationError

from texas811_poc.models import (
    MemberInfo,
    MemberResponseDetail,
    MemberResponseRequest,
    ResponseStatus,
    ResponseSummary,
    TicketModel,
    TicketStatus,
)


class TestResponseStatus:
    """Tests for ResponseStatus enum."""

    def test_response_status_values(self):
        """Test that response status enum has required values."""
        assert ResponseStatus.CLEAR == "clear"
        assert ResponseStatus.NOT_CLEAR == "not_clear"

    def test_response_status_serialization(self):
        """Test that response status serializes correctly."""
        assert ResponseStatus.CLEAR.value == "clear"
        assert ResponseStatus.NOT_CLEAR.value == "not_clear"


class TestMemberResponseRequest:
    """Tests for MemberResponseRequest validation model."""

    def test_member_response_request_minimal_fields(self):
        """Test creation with minimal required fields."""
        response_data = {
            "member_name": "CenterPoint Energy",
            "status": "clear",
            "user_name": "john.doe@centerpoint.com",
        }
        response = MemberResponseRequest(**response_data)

        assert response.member_name == "CenterPoint Energy"
        assert response.status == ResponseStatus.CLEAR
        assert response.user_name == "john.doe@centerpoint.com"
        assert response.facilities is None
        assert response.comment is None

    def test_member_response_request_all_fields(self):
        """Test creation with all fields populated."""
        response_data = {
            "member_name": "CenterPoint Energy",
            "status": "not_clear",
            "user_name": "john.doe@centerpoint.com",
            "facilities": "Electric: Underground primary distribution line along Main St",
            "comment": "Line is located 3 feet north of centerline. Exercise caution when digging.",
        }
        response = MemberResponseRequest(**response_data)

        assert response.member_name == "CenterPoint Energy"
        assert response.status == ResponseStatus.NOT_CLEAR
        assert response.user_name == "john.doe@centerpoint.com"
        assert (
            response.facilities
            == "Electric: Underground primary distribution line along Main St"
        )
        assert (
            response.comment
            == "Line is located 3 feet north of centerline. Exercise caution when digging."
        )

    def test_member_response_request_missing_required_fields(self):
        """Test validation errors for missing required fields."""
        # Missing member_name
        with pytest.raises(ValidationError) as exc_info:
            MemberResponseRequest(status="clear", user_name="user@test.com")
        assert "member_name" in str(exc_info.value)

        # Missing status
        with pytest.raises(ValidationError) as exc_info:
            MemberResponseRequest(member_name="Test Member", user_name="user@test.com")
        assert "status" in str(exc_info.value)

        # Missing user_name
        with pytest.raises(ValidationError) as exc_info:
            MemberResponseRequest(member_name="Test Member", status="clear")
        assert "user_name" in str(exc_info.value)

    def test_member_response_request_invalid_status(self):
        """Test validation error for invalid status value."""
        with pytest.raises(ValidationError) as exc_info:
            MemberResponseRequest(
                member_name="Test Member",
                status="invalid_status",
                user_name="user@test.com",
            )
        assert "status" in str(exc_info.value)

    def test_member_response_request_empty_strings(self):
        """Test validation for empty string values."""
        with pytest.raises(ValidationError) as exc_info:
            MemberResponseRequest(
                member_name="", status="clear", user_name="user@test.com"
            )
        assert "member_name" in str(exc_info.value)

        with pytest.raises(ValidationError) as exc_info:
            MemberResponseRequest(
                member_name="Test Member", status="clear", user_name=""
            )
        assert "user_name" in str(exc_info.value)

    def test_member_response_request_json_serialization(self):
        """Test that model can be serialized to/from JSON."""
        response_data = {
            "member_name": "CenterPoint Energy",
            "status": "not_clear",
            "user_name": "john.doe@centerpoint.com",
            "facilities": "Electric lines present",
            "comment": "Exercise caution",
        }
        response = MemberResponseRequest(**response_data)

        # Test serialization
        json_str = response.model_dump_json()
        parsed = json.loads(json_str)

        assert parsed["member_name"] == "CenterPoint Energy"
        assert parsed["status"] == "not_clear"
        assert parsed["user_name"] == "john.doe@centerpoint.com"
        assert parsed["facilities"] == "Electric lines present"
        assert parsed["comment"] == "Exercise caution"

        # Test deserialization
        recreated = MemberResponseRequest.model_validate_json(json_str)
        assert recreated == response


class TestMemberResponseDetail:
    """Tests for MemberResponseDetail model with persistence fields."""

    def test_member_response_detail_creation(self):
        """Test creation of detailed response model."""
        response_data = {
            "ticket_id": "ticket_123",
            "member_code": "CENTERPOINT",
            "member_name": "CenterPoint Energy",
            "status": "clear",
            "user_name": "john.doe@centerpoint.com",
        }
        response = MemberResponseDetail(**response_data)

        assert response.ticket_id == "ticket_123"
        assert response.member_code == "CENTERPOINT"
        assert response.member_name == "CenterPoint Energy"
        assert response.status == ResponseStatus.CLEAR
        assert response.user_name == "john.doe@centerpoint.com"
        assert response.response_id is not None
        assert response.created_at is not None
        assert response.updated_at is not None

    def test_member_response_detail_unique_response_id(self):
        """Test that response_id is unique for different responses."""
        response_data = {
            "ticket_id": "ticket_123",
            "member_code": "CENTERPOINT",
            "member_name": "CenterPoint Energy",
            "status": "clear",
            "user_name": "john.doe@centerpoint.com",
        }

        response1 = MemberResponseDetail(**response_data)
        response2 = MemberResponseDetail(**response_data)

        assert response1.response_id != response2.response_id

    def test_member_response_detail_timestamps(self):
        """Test that timestamps are set correctly."""
        response_data = {
            "ticket_id": "ticket_123",
            "member_code": "CENTERPOINT",
            "member_name": "CenterPoint Energy",
            "status": "clear",
            "user_name": "john.doe@centerpoint.com",
        }
        response = MemberResponseDetail(**response_data)

        assert isinstance(response.created_at, datetime)
        assert isinstance(response.updated_at, datetime)
        assert response.created_at <= response.updated_at

    def test_member_response_detail_all_fields(self):
        """Test detailed response with all fields."""
        response_data = {
            "ticket_id": "ticket_123",
            "member_code": "CENTERPOINT",
            "member_name": "CenterPoint Energy",
            "status": "not_clear",
            "user_name": "john.doe@centerpoint.com",
            "facilities": "Electric: 12kV underground distribution",
            "comment": "Located 36 inches east of centerline",
        }
        response = MemberResponseDetail(**response_data)

        assert response.facilities == "Electric: 12kV underground distribution"
        assert response.comment == "Located 36 inches east of centerline"

    def test_member_response_detail_json_serialization(self):
        """Test JSON serialization with datetime handling."""
        response_data = {
            "ticket_id": "ticket_123",
            "member_code": "CENTERPOINT",
            "member_name": "CenterPoint Energy",
            "status": "clear",
            "user_name": "john.doe@centerpoint.com",
        }
        response = MemberResponseDetail(**response_data)

        json_str = response.model_dump_json()
        parsed = json.loads(json_str)

        assert "created_at" in parsed
        assert "updated_at" in parsed
        assert "response_id" in parsed

        recreated = MemberResponseDetail.model_validate_json(json_str)
        assert recreated.ticket_id == response.ticket_id
        assert recreated.status == response.status


class TestResponseSummary:
    """Tests for ResponseSummary aggregate model."""

    def test_response_summary_creation(self):
        """Test creation of response summary."""
        summary_data = {
            "ticket_id": "ticket_123",
            "total_expected": 5,
            "total_received": 3,
            "clear_count": 2,
            "not_clear_count": 1,
        }
        summary = ResponseSummary(**summary_data)

        assert summary.ticket_id == "ticket_123"
        assert summary.total_expected == 5
        assert summary.total_received == 3
        assert summary.clear_count == 2
        assert summary.not_clear_count == 1
        assert summary.is_complete is False
        assert summary.all_clear is False

    def test_response_summary_complete_all_clear(self):
        """Test summary when all responses received and all clear."""
        summary_data = {
            "ticket_id": "ticket_123",
            "total_expected": 3,
            "total_received": 3,
            "clear_count": 3,
            "not_clear_count": 0,
        }
        summary = ResponseSummary(**summary_data)

        assert summary.is_complete is True
        assert summary.all_clear is True

    def test_response_summary_complete_with_conflicts(self):
        """Test summary when complete but has not_clear responses."""
        summary_data = {
            "ticket_id": "ticket_123",
            "total_expected": 4,
            "total_received": 4,
            "clear_count": 2,
            "not_clear_count": 2,
        }
        summary = ResponseSummary(**summary_data)

        assert summary.is_complete is True
        assert summary.all_clear is False

    def test_response_summary_validation(self):
        """Test validation rules for response summary."""
        # total_received CAN exceed total_expected (unknown members can respond)
        # This should NOT raise a ValidationError per model design
        summary = ResponseSummary(
            ticket_id="ticket_123",
            total_expected=3,
            total_received=5,
            clear_count=3,
            not_clear_count=2,
        )
        assert summary.total_received == 5
        assert summary.total_expected == 3

        # clear_count + not_clear_count should equal total_received
        with pytest.raises(ValidationError):
            ResponseSummary(
                ticket_id="ticket_123",
                total_expected=5,
                total_received=3,
                clear_count=2,
                not_clear_count=2,  # 2+2=4 but total_received=3
            )

    def test_response_summary_negative_values(self):
        """Test validation prevents negative values."""
        with pytest.raises(ValidationError):
            ResponseSummary(
                ticket_id="ticket_123",
                total_expected=-1,
                total_received=0,
                clear_count=0,
                not_clear_count=0,
            )

    def test_response_summary_json_serialization(self):
        """Test JSON serialization of response summary."""
        summary_data = {
            "ticket_id": "ticket_123",
            "total_expected": 5,
            "total_received": 3,
            "clear_count": 2,
            "not_clear_count": 1,
        }
        summary = ResponseSummary(**summary_data)

        json_str = summary.model_dump_json()
        parsed = json.loads(json_str)

        assert parsed["is_complete"] is False
        assert parsed["all_clear"] is False

        recreated = ResponseSummary.model_validate_json(json_str)
        assert recreated == summary


class TestMemberInfo:
    """Tests for MemberInfo model."""

    def test_member_info_creation(self):
        """Test creation of member info."""
        member_data = {
            "member_code": "CENTERPOINT",
            "member_name": "CenterPoint Energy",
            "contact_phone": "713-555-0100",
            "contact_email": "locates@centerpointenergy.com",
        }
        member = MemberInfo(**member_data)

        assert member.member_code == "CENTERPOINT"
        assert member.member_name == "CenterPoint Energy"
        assert member.contact_phone == "713-555-0100"
        assert member.contact_email == "locates@centerpointenergy.com"
        assert member.is_active is True

    def test_member_info_minimal_fields(self):
        """Test member info with only required fields."""
        member_data = {
            "member_code": "CENTERPOINT",
            "member_name": "CenterPoint Energy",
        }
        member = MemberInfo(**member_data)

        assert member.member_code == "CENTERPOINT"
        assert member.member_name == "CenterPoint Energy"
        assert member.contact_phone is None
        assert member.contact_email is None
        assert member.is_active is True

    def test_member_info_inactive_member(self):
        """Test member info with inactive status."""
        member_data = {
            "member_code": "OLDMEMBER",
            "member_name": "Old Utility Company",
            "is_active": False,
        }
        member = MemberInfo(**member_data)

        assert member.is_active is False

    def test_member_info_validation(self):
        """Test validation for member info."""
        # Empty member_code should fail
        with pytest.raises(ValidationError):
            MemberInfo(member_code="", member_name="Test Member")

        # Empty member_name should fail
        with pytest.raises(ValidationError):
            MemberInfo(member_code="TEST", member_name="")

        # Invalid email format should fail
        with pytest.raises(ValidationError):
            MemberInfo(
                member_code="TEST",
                member_name="Test Member",
                contact_email="invalid-email",
            )

    def test_member_info_json_serialization(self):
        """Test JSON serialization of member info."""
        member_data = {
            "member_code": "CENTERPOINT",
            "member_name": "CenterPoint Energy",
            "contact_phone": "713-555-0100",
            "contact_email": "locates@centerpointenergy.com",
        }
        member = MemberInfo(**member_data)

        json_str = member.model_dump_json()
        parsed = json.loads(json_str)

        assert parsed["member_code"] == "CENTERPOINT"
        assert parsed["is_active"] is True

        recreated = MemberInfo.model_validate_json(json_str)
        assert recreated == member


class TestTicketModelExpansion:
    """Tests for expanded TicketModel to support response tracking."""

    def test_ticket_model_with_expected_members(self):
        """Test ticket model with expected_members field."""
        ticket_data = {
            "session_id": "session_123",
            "county": "Harris",
            "city": "Houston",
            "address": "123 Main St, Houston, TX 77001",
            "work_description": "Install fiber optic cable",
            "expected_members": [
                {"member_code": "CENTERPOINT", "member_name": "CenterPoint Energy"},
                {"member_code": "ATMOS", "member_name": "Atmos Energy"},
            ],
        }
        ticket = TicketModel(**ticket_data)

        assert len(ticket.expected_members) == 2
        assert ticket.expected_members[0].member_code == "CENTERPOINT"
        assert ticket.expected_members[1].member_code == "ATMOS"

    def test_ticket_model_with_responses_in_status(self):
        """Test ticket model supports 'responses_in' status."""
        ticket_data = {
            "session_id": "session_123",
            "county": "Harris",
            "city": "Houston",
            "address": "123 Main St, Houston, TX 77001",
            "work_description": "Install fiber optic cable",
            "status": "responses_in",
        }
        ticket = TicketModel(**ticket_data)

        assert ticket.status == TicketStatus.RESPONSES_IN

    def test_ticket_model_with_in_progress_status(self):
        """Test ticket model supports 'in_progress' status."""
        ticket_data = {
            "session_id": "session_123",
            "county": "Harris",
            "city": "Houston",
            "address": "123 Main St, Houston, TX 77001",
            "work_description": "Install fiber optic cable",
            "status": "in_progress",
        }
        ticket = TicketModel(**ticket_data)

        assert ticket.status == TicketStatus.IN_PROGRESS

    def test_ticket_model_json_with_response_fields(self):
        """Test JSON serialization with response tracking fields."""
        ticket_data = {
            "session_id": "session_123",
            "county": "Harris",
            "city": "Houston",
            "address": "123 Main St, Houston, TX 77001",
            "work_description": "Install fiber optic cable",
            "expected_members": [
                {"member_code": "CENTERPOINT", "member_name": "CenterPoint Energy"}
            ],
        }
        ticket = TicketModel(**ticket_data)

        json_str = ticket.model_dump_json()
        parsed = json.loads(json_str)

        assert "expected_members" in parsed
        assert len(parsed["expected_members"]) == 1
        assert parsed["expected_members"][0]["member_code"] == "CENTERPOINT"

        recreated = TicketModel.model_validate_json(json_str)
        assert len(recreated.expected_members) == 1
        assert recreated.expected_members[0].member_code == "CENTERPOINT"
