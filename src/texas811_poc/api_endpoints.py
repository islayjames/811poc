"""
CustomGPT API endpoints implementation.

This module implements the three main API endpoints for CustomGPT integration:
- POST /tickets/create: Create draft ticket from extracted PDF data
- POST /tickets/{ticket_id}/update: Update ticket fields iteratively
- POST /tickets/{ticket_id}/confirm: Lock ticket and generate submission packet

Key features:
- API key authentication
- Request/response logging
- Comprehensive error handling
- Validation gap detection with conversational prompts
- Geocoding integration
- Texas811 compliance date calculation
- Submission packet generation
"""

import logging
import time
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from texas811_poc.api_models import (
    ConfirmTicketRequest,
    ConfirmTicketResponse,
    CreateTicketRequest,
    CreateTicketResponse,
    RequestLogEntry,
    ResponseLogEntry,
    UpdateTicketRequest,
    UpdateTicketResponse,
    ValidationError,
)
from texas811_poc.config import settings
from texas811_poc.geocoding import GeocodingService, GeofenceBuilder, GeometryGenerator
from texas811_poc.models import (
    AuditAction,
    AuditEventModel,
    TicketModel,
    TicketStatus,
    ValidationSeverity,
)
from texas811_poc.storage import create_storage_instances
from texas811_poc.validation import ValidationEngine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(settings.data_root / "api.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# Initialize services
ticket_storage, audit_storage, backup_manager = create_storage_instances(
    settings.data_root
)
validation_engine = ValidationEngine()
geocoding_service = GeocodingService()
geometry_generator = GeometryGenerator()
geofence_builder = GeofenceBuilder()

# API Router
router = APIRouter(prefix="/tickets", tags=["CustomGPT Integration"])

# Security
security = HTTPBearer()


# Authentication
async def verify_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Verify API key authentication.

    Args:
        credentials: Bearer token credentials

    Returns:
        API key if valid

    Raises:
        HTTPException: If authentication fails
    """
    api_key = credentials.credentials

    # For POC, accept any non-empty key or specific test keys
    valid_keys = [
        settings.api_key,
        "test-api-key-12345",  # For testing
        "customgpt-integration-key",  # For CustomGPT
    ]

    # Remove None and empty keys
    valid_keys = [key for key in valid_keys if key and key.strip()]

    if not api_key or (valid_keys and api_key not in valid_keys):
        logger.warning(f"Invalid API key attempted: {api_key[:10]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return api_key


# Request/Response logging utilities
def generate_request_id() -> str:
    """Generate unique request ID for logging."""
    return str(uuid.uuid4())


def log_request(
    request: Request,
    endpoint: str,
    request_id: str,
    session_id: Optional[str] = None,
    ticket_id: Optional[str] = None,
) -> None:
    """Log API request details.

    Args:
        request: FastAPI request object
        endpoint: API endpoint name
        request_id: Unique request ID
        session_id: CustomGPT session ID if available
        ticket_id: Ticket ID if available
    """
    try:
        log_entry = RequestLogEntry(
            request_id=request_id,
            endpoint=endpoint,
            method=request.method,
            session_id=session_id,
            ticket_id=ticket_id,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
            request_size_bytes=int(request.headers.get("content-length", 0)),
            timestamp=datetime.now(UTC),
        )

        logger.info(
            f"API Request: {endpoint} | ID: {request_id} | Session: {session_id}"
        )

        # Store detailed log entry (in production, this would go to structured logging)
        # For POC, we'll just log the summary

    except Exception as e:
        logger.error(f"Failed to log request: {e}")


def log_response(
    request_id: str,
    status_code: int,
    processing_time: float,
    response_size: int = 0,
    validation_gaps_count: int = 0,
    error_code: Optional[str] = None,
) -> None:
    """Log API response details.

    Args:
        request_id: Unique request ID
        status_code: HTTP status code
        processing_time: Processing time in milliseconds
        response_size: Response size in bytes
        validation_gaps_count: Number of validation gaps
        error_code: Error code if applicable
    """
    try:
        log_entry = ResponseLogEntry(
            request_id=request_id,
            status_code=status_code,
            response_size_bytes=response_size,
            processing_time_ms=processing_time,
            validation_gaps_count=validation_gaps_count,
            error_code=error_code,
            timestamp=datetime.now(UTC),
        )

        logger.info(
            f"API Response: {status_code} | Time: {processing_time:.1f}ms | "
            f"Gaps: {validation_gaps_count} | ID: {request_id}"
        )

    except Exception as e:
        logger.error(f"Failed to log response: {e}")


# Business date calculation utilities
def calculate_lawful_start_date(reference_date: date = None) -> date:
    """Calculate earliest lawful start date (+2 business days).

    Args:
        reference_date: Reference date (defaults to today)

    Returns:
        Earliest lawful start date per Texas811 requirements
    """
    if reference_date is None:
        reference_date = date.today()

    # Add 2 business days
    business_days_added = 0
    current_date = reference_date

    while business_days_added < 2:
        current_date += timedelta(days=1)
        # Skip weekends (Monday=0, Sunday=6)
        if current_date.weekday() < 5:  # Monday-Friday
            business_days_added += 1

    return current_date


def calculate_ticket_expiration(lawful_start: date) -> date:
    """Calculate ticket expiration date (14 days from lawful start).

    Args:
        lawful_start: Lawful start date

    Returns:
        Ticket expiration date
    """
    return lawful_start + timedelta(days=14)


# Geocoding and geometry utilities
def process_geocoding(ticket_data: dict[str, Any]) -> dict[str, Any]:
    """Process geocoding for ticket address.

    Args:
        ticket_data: Ticket data dictionary

    Returns:
        Updated ticket data with geocoded coordinates and geometry
    """
    try:
        address = ticket_data.get("address")
        if not address:
            return ticket_data

        # Skip if coordinates already provided
        if ticket_data.get("gps_lat") and ticket_data.get("gps_lng"):
            logger.info("GPS coordinates already provided, skipping geocoding")
            return ticket_data

        # Geocode address
        geocode_result = geocoding_service.geocode_address(address)

        # Update ticket data
        ticket_data["gps_lat"] = geocode_result["latitude"]
        ticket_data["gps_lng"] = geocode_result["longitude"]

        # Generate geometry
        geometry = geometry_generator.create_point(
            geocode_result["latitude"],
            geocode_result["longitude"],
            confidence=geocode_result["confidence"],
            source="geocoded_address",
        )

        ticket_data["geometry"] = geometry

        logger.info(
            f"Geocoded address: {address} -> {geocode_result['latitude']:.4f}, {geocode_result['longitude']:.4f}"
        )

    except Exception as e:
        logger.warning(f"Geocoding failed for address '{address}': {e}")
        # Continue without geocoding

    return ticket_data


def generate_submission_packet(ticket: TicketModel) -> dict[str, Any]:
    """Generate Texas811 submission packet.

    Args:
        ticket: Complete ticket model

    Returns:
        Texas811-formatted submission packet
    """
    # Calculate compliance dates
    lawful_start = calculate_lawful_start_date()
    ticket_expires = calculate_ticket_expiration(lawful_start)

    packet = {
        "texas811_fields": {
            "county": ticket.county,
            "city": ticket.city,
            "address": ticket.address,
            "cross_street": ticket.cross_street,
            "work_description": ticket.work_description,
            "caller_name": ticket.caller_name,
            "caller_company": ticket.caller_company,
            "caller_phone": ticket.caller_phone,
            "caller_email": ticket.caller_email,
            "excavator_company": ticket.excavator_company,
            "excavator_address": ticket.excavator_address,
            "excavator_phone": ticket.excavator_phone,
            "work_start_date": (
                ticket.work_start_date.isoformat() if ticket.work_start_date else None
            ),
            "work_duration_days": ticket.work_duration_days,
            "work_type": ticket.work_type or "Normal",
            "remarks": ticket.remarks,
        },
        "geometry_data": {
            "gps_coordinates": (
                {
                    "latitude": ticket.gps_lat,
                    "longitude": ticket.gps_lng,
                }
                if ticket.gps_lat and ticket.gps_lng
                else None
            ),
            "geometry": ticket.geometry.model_dump() if ticket.geometry else None,
        },
        "compliance_dates": {
            "lawful_start_date": lawful_start.isoformat(),
            "ticket_expires_date": ticket_expires.isoformat(),
            "marking_valid_until": (lawful_start + timedelta(days=14)).isoformat(),
        },
        "work_methods": {
            "white_lining_complete": ticket.white_lining_complete,
            "boring_crossing": ticket.boring_crossing,
            "explosives_used": ticket.explosives_used,
            "hand_digging_only": ticket.hand_digging_only,
        },
        "metadata": {
            "ticket_id": ticket.ticket_id,
            "session_id": ticket.session_id,
            "created_at": ticket.created_at.isoformat(),
            "confirmed_at": datetime.now(UTC).isoformat(),
            "submission_format": "texas811_portal",
            "generated_by": "texas811_poc_api",
        },
    }

    return packet


# API Endpoints


@router.post(
    "/create", response_model=CreateTicketResponse, status_code=status.HTTP_201_CREATED
)
async def create_ticket(
    request: Request,
    ticket_request: CreateTicketRequest,
    api_key: str = Depends(verify_api_key),
) -> CreateTicketResponse:
    """Create new ticket from extracted PDF data.

    This endpoint creates a draft ticket from data extracted by CustomGPT from PDF work orders.
    It performs validation, geocoding, and returns validation gaps with conversational prompts.

    Args:
        request: FastAPI request object
        ticket_request: Ticket creation request data
        api_key: Verified API key

    Returns:
        Created ticket with validation gaps and next prompt

    Raises:
        HTTPException: If ticket creation fails
    """
    start_time = time.time()
    request_id = generate_request_id()

    try:
        # Log request
        log_request(request, "create_ticket", request_id, ticket_request.session_id)

        # Convert request to ticket data
        ticket_data = ticket_request.model_dump(exclude_unset=True)

        # Process geocoding if needed
        ticket_data = process_geocoding(ticket_data)

        # Calculate compliance dates
        lawful_start = calculate_lawful_start_date()
        ticket_data["lawful_start_date"] = lawful_start
        ticket_data["ticket_expires_date"] = calculate_ticket_expiration(lawful_start)

        # Create ticket model
        ticket = TicketModel(**ticket_data)

        # Run validation
        validation_result = validation_engine.validate_ticket(ticket)
        ticket.validation_gaps = validation_result.gaps

        # Update status based on validation
        if validation_result.is_submittable:
            ticket.status = TicketStatus.VALIDATED

        # Save ticket
        ticket_storage.save_ticket(ticket)

        # Create audit event
        audit_event = AuditEventModel(
            ticket_id=ticket.ticket_id,
            action=AuditAction.TICKET_CREATED,
            user_id=ticket_request.session_id,
            details={
                "request_id": request_id,
                "validation_score": validation_result.score,
                "gaps_count": len(validation_result.gaps),
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        audit_storage.save_audit_event(audit_event)

        # Get next prompt
        next_prompt = (
            validation_engine.get_next_prompt(ticket)
            if validation_result.gaps
            else None
        )

        # Build response
        response = CreateTicketResponse(
            success=True,
            timestamp=datetime.now(UTC),
            request_id=request_id,
            ticket_id=ticket.ticket_id,
            session_id=ticket.session_id,
            status=ticket.status,
            county=ticket.county,
            city=ticket.city,
            address=ticket.address,
            work_description=ticket.work_description,
            cross_street=ticket.cross_street,
            gps_lat=ticket.gps_lat,
            gps_lng=ticket.gps_lng,
            geometry=ticket.geometry,
            validation_gaps=ticket.validation_gaps,
            next_prompt=next_prompt,
            lawful_start_date=ticket.lawful_start_date,
            ticket_expires_date=ticket.ticket_expires_date,
            created_at=ticket.created_at,
            updated_at=ticket.updated_at,
        )

        # Log response
        processing_time = (time.time() - start_time) * 1000
        log_response(
            request_id,
            status.HTTP_201_CREATED,
            processing_time,
            validation_gaps_count=len(validation_result.gaps),
        )

        return response

    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        log_response(
            request_id,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            processing_time,
            error_code="ticket_creation_failed",
        )

        logger.error(f"Ticket creation failed: {e}", exc_info=True)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create ticket: {str(e)}",
        )


@router.post("/{ticket_id}/update", response_model=UpdateTicketResponse)
async def update_ticket(
    request: Request,
    ticket_id: str,
    update_request: UpdateTicketRequest,
    api_key: str = Depends(verify_api_key),
) -> UpdateTicketResponse:
    """Update ticket fields iteratively during CustomGPT conversation.

    This endpoint allows incremental updates to ticket fields as CustomGPT gathers
    missing information from the user. It re-runs validation and returns updated gaps.

    Args:
        request: FastAPI request object
        ticket_id: Unique ticket identifier
        update_request: Fields to update
        api_key: Verified API key

    Returns:
        Updated ticket with new validation status

    Raises:
        HTTPException: If ticket not found or update fails
    """
    start_time = time.time()
    request_id = generate_request_id()

    try:
        # Load existing ticket
        ticket = ticket_storage.load_ticket(ticket_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ticket {ticket_id} not found",
            )

        # Log request
        log_request(request, "update_ticket", request_id, ticket.session_id, ticket_id)

        # Apply updates
        update_data = update_request.model_dump(exclude_unset=True)
        updated_fields = []

        for field_name, field_value in update_data.items():
            if hasattr(ticket, field_name):
                setattr(ticket, field_name, field_value)
                updated_fields.append(field_name)

        # Update timestamp
        ticket.updated_at = datetime.now(UTC)

        # Reprocess geocoding if address changed
        if (
            "address" in updated_fields
            or "gps_lat" in updated_fields
            or "gps_lng" in updated_fields
        ):
            ticket_data = ticket.model_dump()
            ticket_data = process_geocoding(ticket_data)
            # Update ticket with any new geocoding results
            if "gps_lat" in ticket_data:
                ticket.gps_lat = ticket_data["gps_lat"]
            if "gps_lng" in ticket_data:
                ticket.gps_lng = ticket_data["gps_lng"]
            if "geometry" in ticket_data:
                ticket.geometry = ticket_data["geometry"]

        # Re-run validation
        validation_result = validation_engine.validate_ticket(ticket)
        ticket.validation_gaps = validation_result.gaps

        # Update status based on validation
        if validation_result.is_submittable:
            if ticket.status == TicketStatus.DRAFT:
                ticket.status = TicketStatus.VALIDATED

        # Recalculate compliance dates if work start date changed
        if "work_start_date" in updated_fields:
            lawful_start = calculate_lawful_start_date(ticket.work_start_date)
            ticket.lawful_start_date = lawful_start
            ticket.ticket_expires_date = calculate_ticket_expiration(lawful_start)

        # Save updated ticket
        ticket_storage.save_ticket(ticket, create_backup=True)

        # Create audit event
        audit_event = AuditEventModel(
            ticket_id=ticket.ticket_id,
            action=AuditAction.TICKET_UPDATED,
            user_id=ticket.session_id,
            details={
                "request_id": request_id,
                "updated_fields": updated_fields,
                "validation_score": validation_result.score,
                "gaps_count": len(validation_result.gaps),
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        audit_storage.save_audit_event(audit_event)

        # Get next prompt
        next_prompt = (
            validation_engine.get_next_prompt(ticket)
            if validation_result.gaps
            else None
        )

        # Build response
        response = UpdateTicketResponse(
            success=True,
            timestamp=datetime.now(UTC),
            request_id=request_id,
            ticket_id=ticket.ticket_id,
            session_id=ticket.session_id,
            status=ticket.status,
            county=ticket.county,
            city=ticket.city,
            address=ticket.address,
            work_description=ticket.work_description,
            cross_street=ticket.cross_street,
            gps_lat=ticket.gps_lat,
            gps_lng=ticket.gps_lng,
            caller_name=ticket.caller_name,
            caller_company=ticket.caller_company,
            caller_phone=ticket.caller_phone,
            caller_email=ticket.caller_email,
            excavator_company=ticket.excavator_company,
            excavator_address=ticket.excavator_address,
            excavator_phone=ticket.excavator_phone,
            work_start_date=ticket.work_start_date,
            work_duration_days=ticket.work_duration_days,
            work_type=ticket.work_type,
            remarks=ticket.remarks,
            white_lining_complete=ticket.white_lining_complete,
            boring_crossing=ticket.boring_crossing,
            explosives_used=ticket.explosives_used,
            hand_digging_only=ticket.hand_digging_only,
            geometry=ticket.geometry,
            validation_gaps=ticket.validation_gaps,
            next_prompt=next_prompt,
            lawful_start_date=ticket.lawful_start_date,
            ticket_expires_date=ticket.ticket_expires_date,
            updated_fields=updated_fields,
            created_at=ticket.created_at,
            updated_at=ticket.updated_at,
        )

        # Log response
        processing_time = (time.time() - start_time) * 1000
        log_response(
            request_id,
            status.HTTP_200_OK,
            processing_time,
            validation_gaps_count=len(validation_result.gaps),
        )

        return response

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        log_response(
            request_id,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            processing_time,
            error_code="ticket_update_failed",
        )

        logger.error(f"Ticket update failed: {e}", exc_info=True)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update ticket: {str(e)}",
        )


@router.post("/{ticket_id}/confirm", response_model=ConfirmTicketResponse)
async def confirm_ticket(
    request: Request,
    ticket_id: str,
    confirm_request: ConfirmTicketRequest = ConfirmTicketRequest(),
    api_key: str = Depends(verify_api_key),
) -> ConfirmTicketResponse:
    """Confirm ticket and generate Texas811 submission packet.

    This endpoint locks the ticket with final confirmation and generates a complete
    Texas811 submission packet ready for manual portal submission.

    Args:
        request: FastAPI request object
        ticket_id: Unique ticket identifier
        confirm_request: Confirmation request (optional fields)
        api_key: Verified API key

    Returns:
        Confirmed ticket with submission packet

    Raises:
        HTTPException: If ticket not found, has required gaps, or already confirmed
    """
    start_time = time.time()
    request_id = generate_request_id()

    try:
        # Load existing ticket
        ticket = ticket_storage.load_ticket(ticket_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ticket {ticket_id} not found",
            )

        # Log request
        log_request(request, "confirm_ticket", request_id, ticket.session_id, ticket_id)

        # Check if ticket is already confirmed/ready
        if ticket.status in [TicketStatus.READY, TicketStatus.SUBMITTED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ticket is already confirmed and cannot be modified",
            )

        # Final validation check
        validation_result = validation_engine.validate_ticket(ticket)

        # Check for required gaps
        required_gaps = [
            g
            for g in validation_result.gaps
            if g.severity == ValidationSeverity.REQUIRED
        ]

        if required_gaps:
            error_response = ValidationError(
                error=True,
                message="Cannot confirm ticket with required validation gaps",
                error_code="required_gaps_remaining",
                validation_errors=[
                    {"field": gap.field_name, "message": gap.message}
                    for gap in required_gaps
                ],
                validation_gaps=required_gaps,
                request_id=request_id,
            )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_response.model_dump(),
            )

        # Apply any final fields from confirm request
        if confirm_request.final_remarks:
            ticket.remarks = confirm_request.final_remarks

        # Update status and timestamps
        ticket.status = TicketStatus.READY
        ticket.updated_at = datetime.now(UTC)

        # Generate submission packet
        submission_packet = generate_submission_packet(ticket)
        ticket.submission_packet = submission_packet

        # Update compliance dates from packet
        compliance_dates = submission_packet["compliance_dates"]
        ticket.lawful_start_date = date.fromisoformat(
            compliance_dates["lawful_start_date"]
        )
        ticket.ticket_expires_date = date.fromisoformat(
            compliance_dates["ticket_expires_date"]
        )
        ticket.marking_valid_until = date.fromisoformat(
            compliance_dates["marking_valid_until"]
        )

        # Save confirmed ticket
        ticket_storage.save_ticket(ticket, create_backup=True)

        # Create audit events
        audit_event = AuditEventModel(
            ticket_id=ticket.ticket_id,
            action=AuditAction.SUBMISSION_PACKET_CREATED,
            user_id=ticket.session_id,
            details={
                "request_id": request_id,
                "final_validation_score": validation_result.score,
                "packet_generated": True,
                "confirm_accuracy": confirm_request.confirm_accuracy,
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        audit_storage.save_audit_event(audit_event)

        # Generate summary for user
        summary = {
            "ticket_id": ticket.ticket_id,
            "location": f"{ticket.address}, {ticket.city}, {ticket.county} County",
            "work_description": ticket.work_description,
            "caller": ticket.caller_name or "Not specified",
            "company": ticket.caller_company or "Not specified",
            "lawful_start_date": ticket.lawful_start_date.isoformat(),
            "ticket_expires_date": ticket.ticket_expires_date.isoformat(),
            "ready_for_submission": True,
            "submission_method": "Manual via Texas811 portal",
        }

        # Build response
        response = ConfirmTicketResponse(
            success=True,
            timestamp=datetime.now(UTC),
            request_id=request_id,
            ticket_id=ticket.ticket_id,
            session_id=ticket.session_id,
            status=ticket.status,
            ticket_data=ticket,
            submission_packet=submission_packet,
            compliance_dates=submission_packet["compliance_dates"],
            summary=summary,
            confirmed_at=datetime.now(UTC),
        )

        # Log response
        processing_time = (time.time() - start_time) * 1000
        log_response(request_id, status.HTTP_200_OK, processing_time)

        return response

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        log_response(
            request_id,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            processing_time,
            error_code="ticket_confirmation_failed",
        )

        logger.error(f"Ticket confirmation failed: {e}", exc_info=True)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to confirm ticket: {str(e)}",
        )


# Additional utility endpoints
@router.get("/{ticket_id}", tags=["Ticket Management"])
async def get_ticket(
    ticket_id: str,
    api_key: str = Depends(verify_api_key),
) -> TicketModel:
    """Get ticket by ID.

    Args:
        ticket_id: Unique ticket identifier
        api_key: Verified API key

    Returns:
        Complete ticket data

    Raises:
        HTTPException: If ticket not found
    """
    ticket = ticket_storage.load_ticket(ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found",
        )

    return ticket


@router.get("/session/{session_id}/tickets", tags=["Ticket Management"])
async def get_session_tickets(
    session_id: str,
    api_key: str = Depends(verify_api_key),
) -> list[TicketModel]:
    """Get all tickets for a CustomGPT session.

    Args:
        session_id: CustomGPT session ID
        api_key: Verified API key

    Returns:
        List of tickets for the session
    """
    tickets = ticket_storage.search_tickets(session_id=session_id)
    return tickets
