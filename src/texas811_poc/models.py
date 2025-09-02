"""
Pydantic data models for Texas811 POC.

This module defines the core data structures for:
- Tickets (work order data and Texas811 fields)
- Validation gaps (missing/incorrect field identification)
- Geometry (GeoJSON-compatible shapes)
- Audit events (compliance logging)

Following Texas811 requirements and CustomGPT integration patterns.
"""

import uuid
from datetime import UTC, date, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class TicketStatus(str, Enum):
    """Ticket lifecycle status."""

    DRAFT = "draft"
    VALIDATED = "validated"
    READY = "ready"
    SUBMITTED = "submitted"
    RESPONSES_IN = "responses_in"
    READY_TO_DIG = "ready_to_dig"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class ValidationSeverity(str, Enum):
    """Validation gap severity levels."""

    REQUIRED = "required"
    RECOMMENDED = "recommended"
    WARNING = "warning"
    INFO = "info"


class GeometryType(str, Enum):
    """GeoJSON geometry types."""

    POINT = "Point"
    LINESTRING = "LineString"
    POLYGON = "Polygon"
    MULTIPOINT = "MultiPoint"
    MULTILINESTRING = "MultiLineString"
    MULTIPOLYGON = "MultiPolygon"


class AuditAction(str, Enum):
    """Audit event action types."""

    TICKET_CREATED = "ticket_created"
    TICKET_UPDATED = "ticket_updated"
    FIELD_UPDATED = "field_updated"
    STATUS_CHANGED = "status_changed"
    VALIDATION_RUN = "validation_run"
    GEOMETRY_GENERATED = "geometry_generated"
    SUBMISSION_PACKET_CREATED = "submission_packet_created"
    TICKET_SUBMITTED = "ticket_submitted"
    RESPONSES_RECEIVED = "responses_received"
    TICKET_CANCELLED = "ticket_cancelled"


class ValidationGapModel(BaseModel):
    """Model for validation gaps - missing or incorrect fields."""

    field_name: str = Field(..., description="Name of the field with validation gap")
    severity: ValidationSeverity = Field(..., description="Severity level of this gap")
    message: str = Field(..., description="Human-readable description of the gap")
    suggested_value: str | None = Field(
        None, description="Suggested value to fill the gap"
    )
    prompt_text: str | None = Field(
        None, description="Text to prompt user for this field"
    )

    model_config = ConfigDict(use_enum_values=True)


class GeometryModel(BaseModel):
    """GeoJSON-compatible geometry model with confidence scoring."""

    type: GeometryType = Field(..., description="GeoJSON geometry type")
    coordinates: list[float] | list[list[float]] | list[list[list[float]]] = Field(
        ..., description="GeoJSON coordinates array"
    )
    confidence_score: float = Field(
        ..., ge=0.0, le=1.0, description="Confidence score for geometry accuracy (0-1)"
    )
    source: str = Field(
        ..., description="Source of geometry (geocoded_address, manual_gps, etc.)"
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When geometry was created",
    )

    model_config = ConfigDict(use_enum_values=True)


class AuditEventModel(BaseModel):
    """Model for audit trail events."""

    event_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()), description="Unique event ID"
    )
    ticket_id: str = Field(..., description="ID of associated ticket")
    action: AuditAction = Field(..., description="Type of action performed")
    user_id: str = Field(..., description="ID of user/session performing action")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When event occurred",
    )
    details: dict[str, Any] | None = Field(None, description="Additional event details")
    ip_address: str | None = Field(None, description="IP address of request")
    user_agent: str | None = Field(None, description="User agent string")

    model_config = ConfigDict(use_enum_values=True)


class ParcelInfoModel(BaseModel):
    """Model for parcel information from ReportAll USA API enrichment."""

    subdivision: str | None = Field(
        None, description="Subdivision name from legal description"
    )
    lot: str | None = Field(None, description="Lot information from legal description")
    block: str | None = Field(
        None, description="Block information from legal description"
    )
    parcel_id: str | None = Field(
        None, description="Parcel/account ID from ReportAll USA"
    )
    owner: str | None = Field(
        None, description="Property owner name from ReportAll USA"
    )
    address: str | None = Field(None, description="Property address from ReportAll USA")
    feature_found: bool = Field(
        False, description="Whether parcel data was found in ReportAll USA"
    )
    matched_count: int = Field(
        0, description="Number of features returned from ReportAll USA query"
    )
    arcgis_url: str | None = Field(
        None, description="ReportAll USA endpoint URL used for query"
    )
    source_county: str | None = Field(None, description="County used for GIS lookup")
    enrichment_attempted: bool = Field(
        False, description="Whether parcel enrichment was attempted"
    )
    enrichment_timestamp: datetime | None = Field(
        None, description="When parcel enrichment was performed"
    )

    model_config = ConfigDict(use_enum_values=True)


class TicketModel(BaseModel):
    """
    Main ticket model representing work order data and Texas811 fields.

    This model captures all fields needed for Texas811 submission plus
    POC-specific fields for session management and workflow tracking.
    """

    # System fields
    ticket_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()), description="Unique ticket ID"
    )
    session_id: str = Field(
        ..., description="CustomGPT session ID for multi-turn workflow"
    )
    status: TicketStatus = Field(
        default=TicketStatus.DRAFT, description="Current ticket status"
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When ticket was created",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When ticket was last updated",
    )

    # Texas811 Required Fields - Location
    county: str = Field(
        ..., min_length=1, description="Texas county where work will occur"
    )
    city: str = Field(..., min_length=1, description="City where work will occur")
    address: str = Field(
        ..., min_length=1, description="Street address of work location"
    )
    cross_street: str | None = Field(None, description="Nearest cross street")

    # Texas811 Required Fields - GPS (alternative to address)
    gps_lat: float | None = Field(
        None,
        ge=25.0,
        le=37.0,
        description="GPS latitude (Texas bounds approximately 25-37°N)",
    )
    gps_lng: float | None = Field(
        None,
        ge=-107.0,
        le=-93.0,
        description="GPS longitude (Texas bounds approximately -107 to -93°W)",
    )

    # Texas811 Required Fields - Work Description
    work_description: str = Field(
        ..., min_length=1, description="Description of work to be performed"
    )

    # Texas811 Caller Information
    caller_name: str | None = Field(
        None, description="Name of person calling in locate"
    )
    caller_company: str | None = Field(None, description="Company requesting locate")
    caller_phone: str | None = Field(None, description="Caller contact phone number")
    caller_email: str | None = Field(None, description="Caller contact email")

    # Texas811 Excavator Information
    excavator_company: str | None = Field(
        None, description="Company performing excavation"
    )
    excavator_address: str | None = Field(
        None, description="Excavator business address"
    )
    excavator_phone: str | None = Field(None, description="Excavator contact phone")

    # Texas811 Work Details
    work_start_date: date | None = Field(None, description="Requested work start date")
    work_duration_days: int | None = Field(
        None, ge=1, le=30, description="Expected duration of work in days"
    )
    work_type: str | None = Field(
        None, description="Type of work (Normal, Emergency, etc.)"
    )

    # Additional Details
    driving_directions: str | None = Field(
        None, description="Driving directions to work location"
    )
    marking_instructions: str | None = Field(
        None, description="Specific marking and work area instructions"
    )
    remarks: str | None = Field(
        None, description="Additional remarks or special instructions"
    )

    # Work Method Flags
    white_lining_complete: bool | None = Field(
        None, description="Has white lining been completed"
    )
    boring_crossing: bool | None = Field(
        None, description="Will work involve boring/crossing"
    )
    explosives_used: bool | None = Field(None, description="Will explosives be used")
    hand_digging_only: bool | None = Field(
        None, description="Hand digging only (no mechanical)"
    )

    # POC Workflow Fields
    validation_gaps: list[ValidationGapModel] = Field(
        default_factory=list, description="Current validation gaps"
    )
    geometry: GeometryModel | None = Field(
        None, description="Generated geometry for work area"
    )
    parcel_info: ParcelInfoModel | None = Field(
        None, description="GIS parcel enrichment data"
    )

    # Calculated Fields (populated by backend)
    lawful_start_date: date | None = Field(
        None, description="Earliest lawful start date (+2 business days)"
    )
    ticket_expires_date: date | None = Field(
        None, description="Date when ticket expires (14 days)"
    )
    marking_valid_until: date | None = Field(
        None, description="Date when markings expire"
    )

    # Submission Tracking
    submitted_at: datetime | None = Field(
        None, description="When ticket was submitted to Texas811"
    )
    submission_packet: dict[str, Any] | None = Field(
        None, description="Final submission packet data"
    )

    model_config = ConfigDict(use_enum_values=True)

    @field_validator("updated_at", mode="before")
    @classmethod
    def set_updated_at(cls, v: Any) -> datetime:
        """Always update the updated_at timestamp."""
        return datetime.now(UTC)

    @model_validator(mode="after")
    def validate_location_info(self) -> "TicketModel":
        """Validate that either address OR GPS coordinates are provided."""
        address = self.address
        gps_lat = self.gps_lat
        gps_lng = self.gps_lng

        # Address is always required for this POC, GPS is supplementary
        if not address or not address.strip():
            raise ValueError("Address is required")

        # If GPS is partially provided, require both coordinates
        if (gps_lat is None) != (gps_lng is None):
            raise ValueError(
                "Both GPS latitude and longitude must be provided together"
            )

        return self

    @field_validator("caller_email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        """Basic email validation."""
        if v and "@" not in v:
            raise ValueError("Invalid email format")
        return v

    @field_validator("work_start_date")
    @classmethod
    def validate_work_start_date(cls, v: date | None) -> date | None:
        """Ensure work start date is not in the past."""
        if v and v < date.today():
            raise ValueError("Work start date cannot be in the past")
        return v


# Collection models for API responses
class TicketListResponse(BaseModel):
    """Response model for ticket listing endpoints."""

    tickets: list[TicketModel]
    total_count: int
    page: int = 1
    page_size: int = 50


class ValidationResponse(BaseModel):
    """Response model for ticket validation results."""

    is_valid: bool
    gaps: list[ValidationGapModel]
    status: TicketStatus
    message: str

    model_config = ConfigDict(use_enum_values=True)


class SubmissionPacketResponse(BaseModel):
    """Response model for Texas811 submission packet."""

    ticket_id: str
    packet_data: dict[str, Any]
    created_at: datetime
    is_frozen: bool = Field(
        default=True, description="Whether packet is frozen (cannot be modified)"
    )

    model_config = ConfigDict(use_enum_values=True)
