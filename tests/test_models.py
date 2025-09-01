"""
Tests for Pydantic data models and JSON serialization.

Following TDD approach for Task 2: JSON Data Models and Storage Layer.
"""

import json
from datetime import date, datetime

import pytest
from pydantic import ValidationError
from texas811_poc.models import (
    AuditAction,
    AuditEventModel,
    GeometryModel,
    GeometryType,
    TicketModel,
    TicketStatus,
    ValidationGapModel,
    ValidationSeverity,
)


class TestTicketModel:
    """Tests for the main TicketModel Pydantic model."""

    def test_ticket_model_minimal_required_fields(self):
        """Test that minimal required fields create valid ticket."""
        ticket_data = {
            "session_id": "session_123",
            "county": "Harris",
            "city": "Houston",
            "address": "123 Main St, Houston, TX 77001",
            "work_description": "Install fiber optic cable",
        }
        ticket = TicketModel(**ticket_data)

        assert ticket.session_id == "session_123"
        assert ticket.county == "Harris"
        assert ticket.city == "Houston"
        assert ticket.address == "123 Main St, Houston, TX 77001"
        assert ticket.work_description == "Install fiber optic cable"
        assert ticket.status == TicketStatus.DRAFT
        assert ticket.created_at is not None
        assert ticket.updated_at is not None
        assert ticket.ticket_id is not None

    def test_ticket_model_all_fields(self):
        """Test ticket model with all possible fields populated."""
        ticket_data = {
            "session_id": "session_456",
            "county": "Travis",
            "city": "Austin",
            "address": "456 Congress Ave, Austin, TX 78701",
            "cross_street": "6th Street",
            "gps_lat": 30.2672,
            "gps_lng": -97.7431,
            "work_description": "Emergency gas line repair",
            "caller_name": "John Doe",
            "caller_company": "ABC Utilities",
            "caller_phone": "512-555-1234",
            "caller_email": "john.doe@abcutil.com",
            "excavator_company": "XYZ Excavating",
            "excavator_address": "789 Worker St, Austin, TX 78702",
            "work_start_date": date(2025, 9, 15),
            "work_duration_days": 3,
            "work_type": "Emergency",
            "remarks": "Gas leak reported by resident",
            "white_lining_complete": True,
            "boring_crossing": False,
            "explosives_used": False,
            "hand_digging_only": False,
        }

        ticket = TicketModel(**ticket_data)

        assert ticket.county == "Travis"
        assert ticket.gps_lat == 30.2672
        assert ticket.gps_lng == -97.7431
        assert ticket.caller_name == "John Doe"
        assert ticket.work_start_date == date(2025, 9, 15)
        assert ticket.work_duration_days == 3
        assert ticket.white_lining_complete is True

    def test_ticket_model_missing_required_field(self):
        """Test that missing required fields raise ValidationError."""
        ticket_data = {
            "session_id": "session_123",
            "county": "Harris",
            # Missing city, address, work_description
        }

        with pytest.raises(ValidationError) as exc_info:
            TicketModel(**ticket_data)

        errors = exc_info.value.errors()
        missing_fields = [error["loc"][0] for error in errors]
        assert "city" in missing_fields
        assert "address" in missing_fields
        assert "work_description" in missing_fields

    def test_ticket_model_status_enum_validation(self):
        """Test that ticket status must be valid enum value."""
        ticket_data = {
            "session_id": "session_123",
            "county": "Harris",
            "city": "Houston",
            "address": "123 Main St",
            "work_description": "Test work",
            "status": "INVALID_STATUS",
        }

        with pytest.raises(ValidationError):
            TicketModel(**ticket_data)

    def test_ticket_model_json_serialization(self):
        """Test that ticket model serializes to JSON correctly."""
        ticket_data = {
            "session_id": "session_123",
            "county": "Harris",
            "city": "Houston",
            "address": "123 Main St",
            "work_description": "Install cable",
            "gps_lat": 29.7604,
            "gps_lng": -95.3698,
        }

        ticket = TicketModel(**ticket_data)
        json_str = ticket.model_dump_json()
        json_dict = json.loads(json_str)

        assert json_dict["session_id"] == "session_123"
        assert json_dict["county"] == "Harris"
        assert json_dict["gps_lat"] == 29.7604
        assert json_dict["status"] == "draft"
        assert "created_at" in json_dict
        assert "ticket_id" in json_dict

    def test_ticket_model_from_json(self):
        """Test loading ticket model from JSON."""
        json_data = {
            "ticket_id": "ticket_123",
            "session_id": "session_456",
            "county": "Dallas",
            "city": "Dallas",
            "address": "789 Elm St",
            "work_description": "Sidewalk repair",
            "status": "validated",
            "created_at": "2024-01-01T12:00:00Z",
            "updated_at": "2024-01-01T12:30:00Z",
        }

        ticket = TicketModel.model_validate(json_data)

        assert ticket.ticket_id == "ticket_123"
        assert ticket.status == TicketStatus.VALIDATED
        assert isinstance(ticket.created_at, datetime)


class TestValidationGapModel:
    """Tests for ValidationGapModel."""

    def test_validation_gap_model_creation(self):
        """Test creating validation gap with all fields."""
        gap_data = {
            "field_name": "cross_street",
            "severity": ValidationSeverity.REQUIRED,
            "message": "Cross street is required for Texas811 submission",
            "suggested_value": "Main Street",
            "prompt_text": "What is the nearest cross street to the work location?",
        }

        gap = ValidationGapModel(**gap_data)

        assert gap.field_name == "cross_street"
        assert gap.severity == ValidationSeverity.REQUIRED
        assert gap.message == "Cross street is required for Texas811 submission"
        assert gap.suggested_value == "Main Street"
        assert (
            gap.prompt_text == "What is the nearest cross street to the work location?"
        )

    def test_validation_gap_severity_enum(self):
        """Test validation gap severity enum validation."""
        gap_data = {
            "field_name": "work_duration_days",
            "severity": "INVALID_SEVERITY",
            "message": "Test message",
        }

        with pytest.raises(ValidationError):
            ValidationGapModel(**gap_data)

    def test_validation_gap_json_serialization(self):
        """Test validation gap JSON serialization."""
        gap_data = {
            "field_name": "caller_phone",
            "severity": ValidationSeverity.RECOMMENDED,
            "message": "Phone number recommended for contact",
        }

        gap = ValidationGapModel(**gap_data)
        json_str = gap.model_dump_json()
        json_dict = json.loads(json_str)

        assert json_dict["field_name"] == "caller_phone"
        assert json_dict["severity"] == "recommended"
        assert json_dict["message"] == "Phone number recommended for contact"


class TestGeometryModel:
    """Tests for GeometryModel (GeoJSON-compatible geometry)."""

    def test_geometry_model_point(self):
        """Test creating point geometry."""
        geometry_data = {
            "type": GeometryType.POINT,
            "coordinates": [-95.3698, 29.7604],
            "confidence_score": 0.95,
            "source": "geocoded_address",
        }

        geometry = GeometryModel(**geometry_data)

        assert geometry.type == GeometryType.POINT
        assert geometry.coordinates == [-95.3698, 29.7604]
        assert geometry.confidence_score == 0.95
        assert geometry.source == "geocoded_address"

    def test_geometry_model_polygon(self):
        """Test creating polygon geometry (simple geofence)."""
        geometry_data = {
            "type": GeometryType.POLYGON,
            "coordinates": [
                [
                    [-95.3700, 29.7600],
                    [-95.3690, 29.7600],
                    [-95.3690, 29.7610],
                    [-95.3700, 29.7610],
                    [-95.3700, 29.7600],
                ]
            ],
            "confidence_score": 0.85,
            "source": "geofence_buffer",
        }

        geometry = GeometryModel(**geometry_data)

        assert geometry.type == GeometryType.POLYGON
        assert len(geometry.coordinates) == 1  # One ring
        assert len(geometry.coordinates[0]) == 5  # Closed polygon
        assert geometry.source == "geofence_buffer"

    def test_geometry_model_validation(self):
        """Test geometry model validation rules."""
        # Test invalid confidence score
        with pytest.raises(ValidationError):
            GeometryModel(
                type=GeometryType.POINT,
                coordinates=[-95.0, 29.0],
                confidence_score=1.5,  # Invalid: > 1.0
            )

        # Test missing coordinates
        with pytest.raises(ValidationError):
            GeometryModel(
                type=GeometryType.POINT,
                confidence_score=0.9,
                # Missing coordinates
            )


class TestAuditEventModel:
    """Tests for AuditEventModel."""

    def test_audit_event_model_creation(self):
        """Test creating audit event."""
        event_data = {
            "ticket_id": "ticket_123",
            "action": AuditAction.TICKET_CREATED,
            "user_id": "customgpt_session_456",
            "details": {"extracted_fields": ["county", "address"]},
            "ip_address": "192.168.1.1",
        }

        event = AuditEventModel(**event_data)

        assert event.ticket_id == "ticket_123"
        assert event.action == AuditAction.TICKET_CREATED
        assert event.user_id == "customgpt_session_456"
        assert event.details == {"extracted_fields": ["county", "address"]}
        assert event.ip_address == "192.168.1.1"
        assert event.timestamp is not None

    def test_audit_event_action_enum(self):
        """Test audit action enum validation."""
        event_data = {
            "ticket_id": "ticket_123",
            "action": "INVALID_ACTION",
            "user_id": "user_123",
        }

        with pytest.raises(ValidationError):
            AuditEventModel(**event_data)

    def test_audit_event_json_serialization(self):
        """Test audit event JSON serialization."""
        event_data = {
            "ticket_id": "ticket_789",
            "action": AuditAction.FIELD_UPDATED,
            "user_id": "user_456",
            "details": {
                "field": "work_start_date",
                "old_value": None,
                "new_value": "2024-01-15",
            },
        }

        event = AuditEventModel(**event_data)
        json_str = event.model_dump_json()
        json_dict = json.loads(json_str)

        assert json_dict["ticket_id"] == "ticket_789"
        assert json_dict["action"] == "field_updated"
        assert json_dict["details"]["field"] == "work_start_date"
        assert "timestamp" in json_dict


class TestModelIntegration:
    """Integration tests for models working together."""

    def test_complete_ticket_with_gaps_and_geometry(self):
        """Test ticket model with validation gaps and geometry."""
        # Create ticket
        ticket_data = {
            "session_id": "session_integration",
            "county": "Collin",
            "city": "Plano",
            "address": "100 Test Drive",
            "work_description": "Install new service line",
        }
        ticket = TicketModel(**ticket_data)

        # Create validation gaps
        gaps = [
            ValidationGapModel(
                field_name="cross_street",
                severity=ValidationSeverity.REQUIRED,
                message="Cross street required",
            ),
            ValidationGapModel(
                field_name="caller_phone",
                severity=ValidationSeverity.RECOMMENDED,
                message="Phone number recommended",
            ),
        ]

        # Create geometry
        geometry = GeometryModel(
            type=GeometryType.POINT,
            coordinates=[-96.6917, 33.0198],
            confidence_score=0.92,
            source="geocoded_address",
        )

        # Verify all models work together
        assert ticket.ticket_id is not None
        assert len(gaps) == 2
        assert gaps[0].severity == ValidationSeverity.REQUIRED
        assert geometry.type == GeometryType.POINT

        # Test JSON serialization of all models
        ticket_json = ticket.model_dump_json()
        gaps_json = [gap.model_dump_json() for gap in gaps]
        geometry_json = geometry.model_dump_json()

        assert all(json_str for json_str in [ticket_json] + gaps_json + [geometry_json])

    def test_model_field_constraints(self):
        """Test various field constraints and validations."""
        # Test GPS coordinate bounds (should be Texas-area coordinates)
        with pytest.raises(ValidationError):
            TicketModel(
                session_id="test",
                county="Test",
                city="Test",
                address="Test",
                work_description="Test",
                gps_lat=45.0,  # Too far north for Texas
                gps_lng=-95.0,
            )

        # Test phone number format (if implemented)
        # Test email format validation
        # Test date constraints (work_start_date not in past)
