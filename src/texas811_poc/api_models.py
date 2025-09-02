"""
Pydantic models for CustomGPT API endpoints.

This module defines request/response models for the three main API endpoints:
- CreateTicketRequest/Response: Initial ticket creation from extracted PDF data
- UpdateTicketRequest/Response: Iterative field updates during conversation
- ConfirmTicketRequest/Response: Final confirmation and submission packet generation

All models are optimized for CustomGPT integration with clear field descriptions
and proper validation for Texas811 requirements.
"""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field

from texas811_poc.models import (
    GeometryModel,
    ParcelInfoModel,
    TicketModel,
    TicketStatus,
    ValidationGapModel,
)


# Base API Response Model
class APIResponse(BaseModel):
    """Base response model with common fields for all API endpoints."""

    success: bool = Field(True, description="Whether the request was successful")
    timestamp: datetime = Field(
        description="Server timestamp when response was generated"
    )
    request_id: str | None = Field(None, description="Unique request ID for debugging")


# Error Response Models
class APIError(BaseModel):
    """Error response model for API endpoints."""

    error: bool = Field(True, description="Indicates this is an error response")
    message: str = Field(description="Human-readable error message")
    error_code: str = Field(description="Machine-readable error code")
    details: dict[str, Any] | None = Field(None, description="Additional error details")
    request_id: str | None = Field(None, description="Request ID for debugging")


class ValidationError(APIError):
    """Validation error response with field-specific details."""

    validation_errors: list[dict[str, Any]] = Field(
        description="List of field validation errors"
    )
    validation_gaps: list[ValidationGapModel] | None = Field(
        None, description="Current validation gaps"
    )


# Create Ticket Endpoint Models
class CreateTicketRequest(BaseModel):
    """Request model for POST /tickets/create endpoint."""

    # Required CustomGPT session tracking
    session_id: str = Field(
        description="CustomGPT session ID for multi-turn workflow tracking",
        min_length=1,
        max_length=100,
    )

    # Texas811 Required Fields - Location
    county: str = Field(
        description="Texas county where work will occur (required by Texas811)",
        min_length=1,
        max_length=50,
    )
    city: str = Field(
        description="City where work will occur (required by Texas811)",
        min_length=1,
        max_length=100,
    )
    address: str = Field(
        description="Street address of work location (required by Texas811)",
        min_length=1,
        max_length=200,
    )
    cross_street: str | None = Field(
        None, description="Nearest cross street for location clarity", max_length=100
    )

    # GPS coordinates (alternative/supplement to address)
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

    # Texas811 Required Work Description
    work_description: str = Field(
        description="Description of work to be performed (required by Texas811)",
        min_length=1,
        max_length=1000,
    )

    # Contact Information
    caller_name: str | None = Field(
        None, description="Name of person calling in locate request", max_length=100
    )
    caller_company: str | None = Field(
        None, description="Company requesting the locate", max_length=100
    )
    caller_phone: str | None = Field(
        None, description="Contact phone number for locate coordination", max_length=20
    )
    caller_email: str | None = Field(
        None, description="Email for locate updates and notifications", max_length=100
    )

    # Excavator Information
    excavator_company: str | None = Field(
        None, description="Company performing the excavation work", max_length=100
    )
    excavator_address: str | None = Field(
        None, description="Excavator business address", max_length=200
    )
    excavator_phone: str | None = Field(
        None, description="Excavator contact phone number", max_length=20
    )

    # Work Details
    work_start_date: date | None = Field(
        None,
        description="Requested work start date (must be at least 2 business days future)",
    )
    work_duration_days: int | None = Field(
        None, ge=1, le=30, description="Expected duration of work in days"
    )
    work_type: str | None = Field(
        None, description="Type of work (Normal, Emergency, etc.)", max_length=50
    )

    # Additional Details
    remarks: str | None = Field(
        None, description="Additional remarks or special instructions", max_length=500
    )

    # Work Method Flags
    white_lining_complete: bool | None = Field(
        None, description="Has white lining been completed?"
    )
    boring_crossing: bool | None = Field(
        None, description="Will work involve boring/crossing utilities?"
    )
    explosives_used: bool | None = Field(
        None, description="Will explosives be used in the work?"
    )
    hand_digging_only: bool | None = Field(
        None, description="Hand digging only (no mechanical excavation)?"
    )


class CreateTicketResponse(APIResponse):
    """Response model for successful ticket creation."""

    ticket_id: str = Field(description="Unique ticket identifier")
    session_id: str = Field(description="CustomGPT session ID")
    status: TicketStatus = Field(description="Current ticket status")

    # Core ticket data
    county: str
    city: str
    address: str
    work_description: str
    cross_street: str | None = None

    # Geocoded coordinates (if available)
    gps_lat: float | None = None
    gps_lng: float | None = None

    # Generated geometry
    geometry: GeometryModel | None = Field(
        None, description="Generated GeoJSON geometry for work area"
    )

    # Parcel enrichment data
    parcel_info: ParcelInfoModel | None = Field(
        None, description="GIS parcel enrichment data from county systems"
    )

    # Validation results
    validation_gaps: list[ValidationGapModel] = Field(
        description="Current validation gaps that need to be resolved"
    )
    next_prompt: str | None = Field(
        None, description="Next conversational prompt for CustomGPT to ask user"
    )

    # Calculated compliance dates
    lawful_start_date: date | None = Field(
        None, description="Earliest lawful work start date (+2 business days)"
    )
    ticket_expires_date: date | None = Field(
        None, description="Date when ticket expires (14 days from submission)"
    )

    # Timestamps
    created_at: datetime
    updated_at: datetime


# Update Ticket Endpoint Models
class UpdateTicketRequest(BaseModel):
    """Request model for POST /tickets/{ticket_id}/update endpoint."""

    # Any field from the original ticket can be updated
    # Using Optional for all fields since updates are partial

    county: str | None = Field(None, min_length=1, max_length=50)
    city: str | None = Field(None, min_length=1, max_length=100)
    address: str | None = Field(None, min_length=1, max_length=200)
    cross_street: str | None = Field(None, max_length=100)

    gps_lat: float | None = Field(None, ge=25.0, le=37.0)
    gps_lng: float | None = Field(None, ge=-107.0, le=-93.0)

    work_description: str | None = Field(None, min_length=1, max_length=1000)

    caller_name: str | None = Field(None, max_length=100)
    caller_company: str | None = Field(None, max_length=100)
    caller_phone: str | None = Field(None, max_length=20)
    caller_email: str | None = Field(None, max_length=100)

    excavator_company: str | None = Field(None, max_length=100)
    excavator_address: str | None = Field(None, max_length=200)
    excavator_phone: str | None = Field(None, max_length=20)

    work_start_date: date | None = None
    work_duration_days: int | None = Field(None, ge=1, le=30)
    work_type: str | None = Field(None, max_length=50)

    remarks: str | None = Field(None, max_length=500)

    white_lining_complete: bool | None = None
    boring_crossing: bool | None = None
    explosives_used: bool | None = None
    hand_digging_only: bool | None = None


class UpdateTicketResponse(APIResponse):
    """Response model for successful ticket update."""

    ticket_id: str = Field(description="Unique ticket identifier")
    session_id: str = Field(description="CustomGPT session ID")
    status: TicketStatus = Field(description="Current ticket status (may have changed)")

    # All current ticket fields (same as CreateTicketResponse)
    county: str
    city: str
    address: str
    work_description: str
    cross_street: str | None = None

    gps_lat: float | None = None
    gps_lng: float | None = None

    # Contact Information
    caller_name: str | None = None
    caller_company: str | None = None
    caller_phone: str | None = None
    caller_email: str | None = None

    # Excavator Information
    excavator_company: str | None = None
    excavator_address: str | None = None
    excavator_phone: str | None = None

    # Work Details
    work_start_date: date | None = None
    work_duration_days: int | None = None
    work_type: str | None = None

    # Additional Details
    remarks: str | None = None

    # Work Method Flags
    white_lining_complete: bool | None = None
    boring_crossing: bool | None = None
    explosives_used: bool | None = None
    hand_digging_only: bool | None = None

    geometry: GeometryModel | None = None

    # Parcel enrichment data
    parcel_info: ParcelInfoModel | None = Field(
        None, description="GIS parcel enrichment data from county systems"
    )

    # Updated validation results
    validation_gaps: list[ValidationGapModel] = Field(
        description="Current validation gaps after update"
    )
    next_prompt: str | None = Field(
        None, description="Next conversational prompt (if gaps remain)"
    )

    # Recalculated compliance dates
    lawful_start_date: date | None = None
    ticket_expires_date: date | None = None

    # Update tracking
    updated_fields: list[str] = Field(
        description="List of fields that were updated in this request"
    )

    created_at: datetime
    updated_at: datetime


# Confirm Ticket Endpoint Models
class ConfirmTicketRequest(BaseModel):
    """Request model for POST /tickets/{ticket_id}/confirm endpoint."""

    # Confirmation endpoint typically doesn't need request body
    # But we can include optional final confirmation fields

    final_remarks: str | None = Field(
        None, description="Final remarks before submission", max_length=500
    )

    confirm_accuracy: bool = Field(
        True, description="User confirms all information is accurate"
    )


class ConfirmTicketResponse(APIResponse):
    """Response model for successful ticket confirmation."""

    ticket_id: str = Field(description="Unique ticket identifier")
    session_id: str = Field(description="CustomGPT session ID")
    status: TicketStatus = Field(
        description="Final ticket status (READY for manual submission)"
    )

    # Final validated ticket data
    ticket_data: TicketModel = Field(description="Complete validated ticket data")

    # Texas811 submission packet
    submission_packet: dict[str, Any] = Field(
        description="Texas811-formatted submission packet"
    )

    # Compliance information
    compliance_dates: dict[str, Any] = Field(
        description="All relevant compliance dates and deadlines"
    )

    # Summary for user
    summary: dict[str, Any] = Field(description="Human-readable summary of the ticket")

    confirmed_at: datetime = Field(description="When ticket was confirmed and locked")


# Health and Status Models
class HealthStatus(BaseModel):
    """Health check response model."""

    service: str
    status: str  # "healthy" or "unhealthy"
    version: str
    components: dict[str, dict[str, Any]]


# OpenAPI Documentation Enhancement
class OpenAPIInfo(BaseModel):
    """Enhanced OpenAPI info for CustomGPT integration."""

    title: str = "Texas 811 POC API"
    version: str = "1.0.0"
    description: str = """
    Texas 811 POC Backend API for automated ticket submission workflow.

    This API provides three main endpoints for CustomGPT integration:

    1. **POST /tickets/create** - Create draft ticket from extracted PDF data
    2. **POST /tickets/{ticket_id}/update** - Update ticket fields iteratively
    3. **POST /tickets/{ticket_id}/confirm** - Lock ticket and generate submission packet

    ## Authentication
    All endpoints require API key authentication via Bearer token in Authorization header.

    ## Workflow
    1. CustomGPT extracts fields from PDF and calls /create
    2. API returns validation gaps with conversational prompts
    3. CustomGPT asks user for missing info and calls /update
    4. Repeat until all required fields are complete
    5. CustomGPT calls /confirm to generate final submission packet

    ## Error Handling
    All endpoints return structured error responses with:
    - Human-readable error messages
    - Machine-readable error codes
    - Field-specific validation details
    - Request IDs for debugging
    """
    contact: dict[str, str] = {
        "name": "Texas 811 POC Support",
        "email": "support@texas811poc.com",
    }


# Request/Response logging models
class RequestLogEntry(BaseModel):
    """Model for logging API requests."""

    request_id: str
    endpoint: str
    method: str
    session_id: str | None
    ticket_id: str | None
    user_agent: str | None
    ip_address: str | None
    request_size_bytes: int
    timestamp: datetime


class ResponseLogEntry(BaseModel):
    """Model for logging API responses."""

    request_id: str
    status_code: int
    response_size_bytes: int
    processing_time_ms: float
    validation_gaps_count: int
    error_code: str | None
    timestamp: datetime


# Parcel Enrichment Endpoint Models
class ParcelEnrichRequest(BaseModel):
    """Request model for POST /parcels/enrich endpoint."""

    address: str | None = Field(
        None,
        description="Street address to geocode and enrich (optional if GPS provided)",
        max_length=200,
    )
    gps_lat: float | None = Field(
        None,
        ge=-90.0,
        le=90.0,
        description="GPS latitude to enrich directly (optional if address provided)",
    )
    gps_lng: float | None = Field(
        None,
        ge=-180.0,
        le=180.0,
        description="GPS longitude to enrich directly (optional if address provided)",
    )
    county: str | None = Field(
        None,
        description="County name to help with address geocoding (optional)",
        max_length=50,
    )

    def model_post_init(self, __context):
        """Validate that at least one input method is provided."""
        if not self.address and (self.gps_lat is None or self.gps_lng is None):
            raise ValueError("Must provide either address or both gps_lat and gps_lng")


class ParcelEnrichmentResult(BaseModel):
    """Model for individual enrichment results (address or GPS)."""

    geocoded_location: dict[str, float] | None = Field(
        None, description="Geocoded coordinates {lat, lng} if address was provided"
    )
    geocoding_confidence: float | None = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Confidence score for geocoding (0.0-1.0)",
    )
    coordinates_used: dict[str, float] | None = Field(
        None, description="Final coordinates used for parcel enrichment {lat, lng}"
    )
    parcel_info: ParcelInfoModel | None = Field(
        None, description="GIS parcel enrichment data from county systems"
    )


class ParcelComparisonMetrics(BaseModel):
    """Model for comparison metrics when both address and GPS are provided."""

    both_provided: bool = Field(
        description="Whether both address and GPS were provided"
    )
    parcel_id_match: bool | None = Field(
        None, description="Whether parcel IDs match between address and GPS results"
    )
    owner_match: bool | None = Field(
        None, description="Whether owners match between address and GPS results"
    )
    address_match: bool | None = Field(
        None, description="Whether addresses match between address and GPS results"
    )
    distance_meters: float | None = Field(
        None,
        ge=0.0,
        description="Distance in meters between geocoded address and GPS coordinates",
    )
    same_parcel: bool | None = Field(
        None, description="Overall assessment: do results represent the same parcel?"
    )


class ParcelEnrichResponse(APIResponse):
    """Response model for successful parcel enrichment."""

    address_provided: str | None = Field(
        None, description="Original address from request"
    )
    gps_provided: dict[str, float] | None = Field(
        None, description="Original GPS coordinates from request {lat, lng}"
    )

    address_enrichment: ParcelEnrichmentResult | None = Field(
        None, description="Enrichment results from address geocoding"
    )
    gps_enrichment: ParcelEnrichmentResult | None = Field(
        None, description="Enrichment results from GPS coordinates"
    )

    comparison: ParcelComparisonMetrics = Field(
        description="Comparison metrics and analysis"
    )
