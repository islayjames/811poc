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

import asyncio
import logging
import time
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from texas811_poc.api_models import (
    ConfirmTicketRequest,
    ConfirmTicketResponse,
    CreateTicketRequest,
    CreateTicketResponse,
    ParcelComparisonMetrics,
    ParcelEnrichmentResult,
    ParcelEnrichRequest,
    ParcelEnrichResponse,
    ResponseRetrievalResponse,
    UpdateTicketRequest,
    UpdateTicketResponse,
    ValidationError,
)
from texas811_poc.compliance import ComplianceCalculator
from texas811_poc.config import settings
from texas811_poc.geocoding import (
    GeocodingService,
    GeofenceBuilder,
    GeometryGenerator,
    calculate_haversine_distance,
)
from texas811_poc.gis.parcel_enrichment import enrichParcelFromGIS
from texas811_poc.member_management import handle_unknown_member
from texas811_poc.models import (
    AuditAction,
    AuditEventModel,
    GeometryModel,
    MemberResponseDetail,
    MemberResponseRequest,
    ParcelInfoModel,
    ResponseSummary,
    TicketModel,
    TicketStatus,
    ValidationSeverity,
)
from texas811_poc.status_calculator import calculate_ticket_status
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
ticket_storage, audit_storage, response_storage, backup_manager = (
    create_storage_instances(settings.data_root)
)
validation_engine = ValidationEngine()
geocoding_service = GeocodingService()
geometry_generator = GeometryGenerator()
geofence_builder = GeofenceBuilder()
compliance_calculator = ComplianceCalculator()

# API Router
router = APIRouter(prefix="/tickets", tags=["Tickets"])

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
    session_id: str | None = None,
    ticket_id: str | None = None,
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
        # Log request details (detailed log entry would be stored in production)
        logger.info(
            f"API Request: {endpoint} | ID: {request_id} | Session: {session_id} | "
            f"Method: {request.method} | User-Agent: {request.headers.get('user-agent')} | "
            f"IP: {request.client.host if request.client else None}"
        )

    except Exception as e:
        logger.error(f"Failed to log request: {e}")


def log_response(
    request_id: str,
    status_code: int,
    processing_time: float,
    response_size: int = 0,
    validation_gaps_count: int = 0,
    error_code: str | None = None,
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
        # Log response details (detailed log entry would be stored in production)
        logger.info(
            f"API Response: {status_code} | Time: {processing_time:.1f}ms | "
            f"Gaps: {validation_gaps_count} | ID: {request_id} | Size: {response_size}B"
        )

    except Exception as e:
        logger.error(f"Failed to log response: {e}")


# Compliance calculations are now handled by ComplianceCalculator


async def enrich_parcel_data(
    lat: float, lng: float, county: str | None
) -> ParcelInfoModel:
    """Enrich ticket with parcel information from GIS systems.

    Args:
        lat: Latitude coordinate
        lng: Longitude coordinate
        county: County name for parcel lookup

    Returns:
        ParcelInfoModel with enrichment data
    """
    logger.info(
        f"Attempting parcel enrichment for coordinates {lat:.4f}, {lng:.4f} in {county} County"
    )

    try:
        # Call the GIS parcel enrichment service
        parcel_result = await enrichParcelFromGIS(lat, lng, county)

        # Convert to ParcelInfoModel with additional metadata
        parcel_info = ParcelInfoModel(
            subdivision=parcel_result.get("subdivision"),
            lot=parcel_result.get("lot"),
            block=parcel_result.get("block"),
            parcel_id=parcel_result.get("parcel_id"),
            owner=parcel_result.get("owner"),
            address=parcel_result.get("address"),
            feature_found=parcel_result.get("feature_found", False),
            matched_count=parcel_result.get("matched_count", 0),
            arcgis_url=parcel_result.get("arcgis_url"),
            source_county=parcel_result.get("source_county"),
            enrichment_attempted=True,
            enrichment_timestamp=datetime.now(UTC),
        )

        if parcel_info.feature_found:
            logger.info(
                f"Successfully enriched parcel data: {parcel_info.parcel_id} in {parcel_info.subdivision}"
            )
        else:
            logger.info(f"No parcel data found for coordinates in {county} County")

        return parcel_info

    except Exception as e:
        logger.error(f"Parcel enrichment failed for {county} County: {str(e)}")

        # Return default parcel info indicating attempted enrichment
        return ParcelInfoModel(
            subdivision=None,
            lot=None,
            block=None,
            parcel_id=None,
            feature_found=False,
            matched_count=0,
            arcgis_url=None,
            source_county=county,
            enrichment_attempted=True,
            enrichment_timestamp=datetime.now(UTC),
        )


# Geocoding and geometry utilities
async def process_geocoding_and_enrichment(
    ticket_data: dict[str, Any],
) -> dict[str, Any]:
    """Process geocoding and parcel enrichment for ticket address.

    Args:
        ticket_data: Ticket data dictionary

    Returns:
        Updated ticket data with geocoded coordinates, geometry, and parcel data
    """
    try:
        address = ticket_data.get("address")
        if not address:
            return ticket_data

        # Skip geocoding if coordinates already provided
        if ticket_data.get("gps_lat") and ticket_data.get("gps_lng"):
            logger.info("GPS coordinates already provided, skipping geocoding")
            lat, lng = ticket_data["gps_lat"], ticket_data["gps_lng"]
        else:
            # Geocode address
            geocode_result = geocoding_service.geocode_address(address)

            # Update ticket data
            lat = geocode_result["latitude"]
            lng = geocode_result["longitude"]
            ticket_data["gps_lat"] = lat
            ticket_data["gps_lng"] = lng

            # Generate geometry
            geometry = geometry_generator.create_point(
                lat,
                lng,
                confidence=geocode_result["confidence"],
                source="geocoded_address",
            )

            ticket_data["geometry"] = geometry

            logger.info(f"Geocoded address: {address} -> {lat:.4f}, {lng:.4f}")

        # Enrich with parcel data if coordinates are available
        if lat is not None and lng is not None:
            county = ticket_data.get("county")
            parcel_info = await enrich_parcel_data(lat, lng, county)
            ticket_data["parcel_info"] = parcel_info.model_dump()

    except Exception as e:
        logger.warning(f"Geocoding and enrichment failed for address '{address}': {e}")
        # Continue without geocoding/enrichment

    return ticket_data


def process_geocoding(ticket_data: dict[str, Any]) -> dict[str, Any]:
    """Legacy synchronous geocoding function - maintained for backwards compatibility.

    Args:
        ticket_data: Ticket data dictionary

    Returns:
        Updated ticket data with geocoded coordinates and geometry
    """
    # Run the async version synchronously
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(process_geocoding_and_enrichment(ticket_data))
    finally:
        loop.close()


def generate_submission_packet(ticket: TicketModel) -> dict[str, Any]:
    """Generate Texas811 submission packet.

    Args:
        ticket: Complete ticket model

    Returns:
        Texas811-formatted submission packet
    """
    # Calculate compliance dates using ticket's submitted time or current time
    submission_time = ticket.submitted_at or datetime.now(UTC)
    lawful_start = compliance_calculator.calculate_lawful_start_date(submission_time)
    ticket_expires = compliance_calculator.calculate_ticket_expiration(submission_time)

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
    "/create",
    response_model=CreateTicketResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create new ticket with validation",
    description=(
        "Creates a draft ticket from partial or complete work order data. "
        "Returns detailed validation gaps for iterative completion via CustomGPT. "
        "Automatically enriches data with geocoding and compliance calculations."
    ),
    response_description="Created ticket with validation gaps and session ID",
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

        # Extract and remove skip_validation flag for sync processing
        skip_validation = ticket_data.pop("skip_validation", False)

        # Process geocoding and parcel enrichment if needed (skip for sync override)
        if not skip_validation:
            ticket_data = await process_geocoding_and_enrichment(ticket_data)

        # Calculate compliance dates using new compliance calculator
        created_time = datetime.now(UTC)
        ticket_data["lawful_start_date"] = (
            compliance_calculator.calculate_lawful_start_date(created_time)
        )
        ticket_data["ticket_expires_date"] = (
            compliance_calculator.calculate_ticket_expiration(created_time)
        )

        # Create ticket model
        ticket = TicketModel(**ticket_data)

        # Run validation (skip strict validation for sync override)
        if skip_validation:
            # For sync, mark as validated with no gaps
            ticket.validation_gaps = []
            ticket.status = TicketStatus.VALIDATED
            validation_result = type(
                "obj", (object,), {"gaps": [], "is_submittable": True, "score": 1.0}
            )()
        else:
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
            driving_directions=ticket.driving_directions,
            marking_instructions=ticket.marking_instructions,
            remarks=ticket.remarks,
            cross_street=ticket.cross_street,
            gps_lat=ticket.gps_lat,
            gps_lng=ticket.gps_lng,
            geometry=ticket.geometry,
            parcel_info=ticket.parcel_info,
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
        ) from e


@router.post(
    "/{ticket_id}/update",
    response_model=UpdateTicketResponse,
    summary="Update ticket with additional data",
    description=(
        "Updates an existing ticket with new or corrected field values. "
        "Used iteratively as CustomGPT gathers missing information from users. "
        "Re-validates all fields and returns updated validation gaps."
    ),
    response_description="Updated ticket with current validation status",
)
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

        # Reprocess geocoding and parcel enrichment if address/location changed
        if (
            "address" in updated_fields
            or "gps_lat" in updated_fields
            or "gps_lng" in updated_fields
            or "county" in updated_fields
        ):
            ticket_data = ticket.model_dump()
            ticket_data = await process_geocoding_and_enrichment(ticket_data)
            # Update ticket with any new geocoding and parcel results
            if "gps_lat" in ticket_data:
                ticket.gps_lat = ticket_data["gps_lat"]
            if "gps_lng" in ticket_data:
                ticket.gps_lng = ticket_data["gps_lng"]
            if "geometry" in ticket_data and ticket_data["geometry"] is not None:
                geometry_data = ticket_data["geometry"]
                if isinstance(geometry_data, GeometryModel):
                    ticket.geometry = geometry_data
                elif isinstance(geometry_data, dict):
                    ticket.geometry = GeometryModel(**geometry_data)
                else:
                    ticket.geometry = geometry_data
            if "parcel_info" in ticket_data and ticket_data["parcel_info"]:
                ticket.parcel_info = ParcelInfoModel(**ticket_data["parcel_info"])

        # Re-run validation
        validation_result = validation_engine.validate_ticket(ticket)
        ticket.validation_gaps = validation_result.gaps

        # Update status based on validation
        if validation_result.is_submittable:
            if ticket.status == TicketStatus.DRAFT:
                ticket.status = TicketStatus.VALIDATED

        # Recalculate compliance dates if work start date changed
        if "work_start_date" in updated_fields:
            # Use submission time for compliance calculations, not work start date
            submission_time = ticket.submitted_at or ticket.created_at
            ticket.lawful_start_date = (
                compliance_calculator.calculate_lawful_start_date(submission_time)
            )
            ticket.ticket_expires_date = (
                compliance_calculator.calculate_ticket_expiration(submission_time)
            )

            # Validate that work start date is not before lawful start
            if (
                ticket.work_start_date
                and ticket.work_start_date < ticket.lawful_start_date
            ):
                ticket.validation_gaps.append(
                    {
                        "field_name": "work_start_date",
                        "severity": "required",
                        "message": f"Work start date cannot be before lawful start date ({ticket.lawful_start_date})",
                        "suggested_value": str(ticket.lawful_start_date),
                        "prompt_text": f"The earliest you can start work is {ticket.lawful_start_date.strftime('%B %d, %Y')}. Please choose a start date on or after this date.",
                    }
                )

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
            parcel_info=ticket.parcel_info,
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
        ) from e


@router.post(
    "/{ticket_id}/confirm",
    response_model=ConfirmTicketResponse,
    summary="Confirm ticket and generate submission packet",
    description=(
        "Confirms a validated ticket, locking all fields from further changes. "
        "Generates a Texas 811-compliant submission packet ready for portal entry. "
        "Ticket must be fully validated before confirmation."
    ),
    response_description="Confirmed ticket with submission packet",
)
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
        ) from e


# Additional utility endpoints
@router.get(
    "/{ticket_id}",
    tags=["Tickets"],
    summary="Get ticket details",
    description="Retrieves complete ticket information including validation status and enrichments.",
    response_description="Complete ticket data",
)
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


@router.get(
    "/session/{session_id}/tickets",
    tags=["Tickets"],
    summary="List tickets in session",
    description=(
        "Retrieves all tickets associated with a CustomGPT session. "
        "Sessions maintain state across multiple API calls for iterative completion."
    ),
    response_description="List of tickets in the session",
)
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


# Helper functions for response processing


def generate_response_summary(
    ticket: TicketModel, responses: list[MemberResponseDetail]
) -> ResponseSummary:
    """Generate response summary for a ticket."""
    expected_count = len(ticket.expected_members) if ticket.expected_members else 0
    received_count = len(responses)

    clear_count = sum(1 for r in responses if r.status == "clear")
    not_clear_count = sum(1 for r in responses if r.status == "not_clear")

    return ResponseSummary(
        ticket_id=ticket.ticket_id,
        total_expected=expected_count,
        total_received=received_count,
        clear_count=clear_count,
        not_clear_count=not_clear_count,
    )


@router.post(
    "/{ticket_id}/responses/{member_code}",
    summary="Submit member response to ticket",
    description=(
        "Submits a utility member response (clear/not clear) to a ticket. "
        "Supports upsert behavior - creates new response or updates existing. "
        "Automatically handles unknown members by adding them to expected_members. "
        "Updates ticket status based on response tracking logic."
    ),
    response_description="Response submission confirmation with updated ticket status",
    responses={
        201: {"description": "Response created successfully"},
        200: {"description": "Response updated successfully"},
        400: {"description": "Invalid request data"},
        404: {"description": "Ticket not found"},
        422: {"description": "Validation error"},
    },
)
async def submit_member_response(
    request: Request,
    ticket_id: str,
    member_code: str,
    response_request: MemberResponseRequest,
    api_key: str = Depends(verify_api_key),
):
    """Submit or update a utility member response to a ticket.

    This endpoint allows utility members to submit their responses (clear/not clear)
    to locate tickets. It supports upsert behavior and automatic member management.

    Args:
        request: FastAPI request object
        ticket_id: Unique ticket identifier
        member_code: Short code identifying the utility member
        response_request: Response submission data
        api_key: Verified API key

    Returns:
        Response submission confirmation with updated ticket status

    Raises:
        HTTPException: If ticket not found or validation fails
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
        log_request(
            request, "submit_response", request_id, ticket.session_id, ticket_id
        )

        # Check if member is unknown and handle it
        member_codes = [m.member_code.upper() for m in (ticket.expected_members or [])]
        if member_code.upper() not in member_codes:
            logger.info(
                f"Unknown member {member_code} submitting response for ticket {ticket_id}"
            )
            ticket = handle_unknown_member(
                ticket, member_code, response_request.member_name
            )

        # Check if response already exists (for upsert behavior)
        existing_response = response_storage.load_response(ticket_id, member_code)
        is_update = existing_response is not None

        # Create response detail
        response_detail = MemberResponseDetail(
            response_id=(
                existing_response.response_id
                if existing_response
                else str(uuid.uuid4())
            ),
            ticket_id=ticket_id,
            member_code=member_code.upper(),
            member_name=response_request.member_name,
            status=response_request.status,
            facilities=response_request.facilities,
            comment=response_request.comment,
            user_name=response_request.user_name,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC) if is_update else None,
        )

        # Save response
        response_storage.save_response(response_detail)

        # Load all responses for status calculation
        all_responses = response_storage.load_ticket_responses(ticket_id)

        # Update ticket status based on responses
        new_status = calculate_ticket_status(ticket, all_responses)
        if new_status != ticket.status:
            ticket.status = new_status
            ticket.updated_at = datetime.now(UTC)
            ticket_storage.save_ticket(ticket)

        # Generate response summary
        response_summary = generate_response_summary(ticket, all_responses)

        # Create audit event
        audit_action = (
            AuditAction.MEMBER_RESPONSE_UPDATED
            if is_update
            else AuditAction.MEMBER_RESPONSE_SUBMITTED
        )
        audit_event = AuditEventModel(
            ticket_id=ticket_id,
            action=audit_action,
            user_id=response_request.user_name,
            details={
                "request_id": request_id,
                "member_code": member_code,
                "member_name": response_request.member_name,
                "response_status": response_request.status,
                "is_update": is_update,
                "new_ticket_status": new_status,
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        audit_storage.save_audit_event(audit_event)

        # Build response - always use the new calculated status
        response_data = {
            "success": True,
            "timestamp": datetime.now(UTC).isoformat(),
            "request_id": request_id,
            "ticket_id": ticket_id,
            "ticket_status": new_status,  # Always the calculated new status
            "response": response_detail.model_dump(mode="json"),
            "response_summary": response_summary.model_dump(mode="json"),
        }

        # Log response
        processing_time = (time.time() - start_time) * 1000
        response_code = status.HTTP_200_OK if is_update else status.HTTP_201_CREATED
        log_response(request_id, response_code, processing_time)

        # Return response with appropriate status code
        from fastapi.responses import JSONResponse

        return JSONResponse(
            content=response_data,
            status_code=response_code,
        )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        log_response(
            request_id,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            processing_time,
            error_code="response_submission_failed",
        )

        logger.error(f"Response submission failed: {e}", exc_info=True)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit response: {str(e)}",
        ) from e


@router.get(
    "/{ticket_id}/responses",
    response_model=ResponseRetrievalResponse,
    summary="Get member responses for ticket",
    description=(
        "Retrieves all member responses for a ticket including expected members, "
        "actual responses received, and summary statistics. "
        "Responses are sorted chronologically by response date. "
        "Calculates pending members by comparing expected vs actual responses."
    ),
    response_description="Complete response data with summary statistics",
    responses={
        200: {"description": "Response data retrieved successfully"},
        404: {"description": "Ticket not found"},
        401: {"description": "Invalid API key"},
    },
)
async def get_ticket_responses(
    request: Request,
    ticket_id: str,
    api_key: str = Depends(verify_api_key),
) -> ResponseRetrievalResponse:
    """Get all member responses for a ticket.

    This endpoint retrieves comprehensive response information for a ticket:
    - Expected members list from ticket
    - All responses received (sorted by date)
    - Summary statistics (totals, clear/not clear counts, pending members)

    Args:
        request: FastAPI request object
        ticket_id: Unique ticket identifier
        api_key: Verified API key

    Returns:
        Complete response data with summary statistics

    Raises:
        HTTPException: If ticket not found
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
        log_request(request, "get_responses", request_id, ticket.session_id, ticket_id)

        # Load all responses for this ticket
        all_responses = response_storage.load_ticket_responses(ticket_id)

        # Sort responses by created_at (chronological order)
        sorted_responses = sorted(all_responses, key=lambda r: r.created_at)

        # Convert expected members to serializable format
        expected_members = []
        if ticket.expected_members:
            for member in ticket.expected_members:
                expected_members.append(
                    {
                        "member_code": member.member_code,
                        "member_name": member.member_name,
                        "added_at": (
                            member.added_at.isoformat() if member.added_at else None
                        ),
                    }
                )

        # Convert responses to serializable format
        responses = []
        for response in sorted_responses:
            responses.append(
                {
                    "response_id": response.response_id,
                    "member_code": response.member_code,
                    "member_name": response.member_name,
                    "response_date": response.created_at.isoformat(),
                    "status": response.status,
                    "facilities": response.facilities,
                    "comment": response.comment,
                    "user_name": response.user_name,
                }
            )

        # Generate response summary with pending members calculation
        response_summary = generate_response_summary_with_pending(
            ticket, sorted_responses
        )

        # Build response
        response_data = ResponseRetrievalResponse(
            success=True,
            timestamp=datetime.now(UTC),
            request_id=request_id,
            ticket_id=ticket_id,
            expected_members=expected_members,
            responses=responses,
            summary=response_summary.model_dump(),
        )

        # Log response
        processing_time = (time.time() - start_time) * 1000
        log_response(request_id, status.HTTP_200_OK, processing_time)

        return response_data

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        log_response(
            request_id,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            processing_time,
            error_code="response_retrieval_failed",
        )

        logger.error(f"Response retrieval failed: {e}", exc_info=True)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve responses: {str(e)}",
        ) from e


def generate_response_summary_with_pending(
    ticket: TicketModel, responses: list[MemberResponseDetail]
) -> ResponseSummary:
    """Generate response summary including pending members calculation."""
    expected_count = len(ticket.expected_members) if ticket.expected_members else 0
    received_count = len(responses)

    clear_count = sum(1 for r in responses if r.status == "clear")
    not_clear_count = sum(1 for r in responses if r.status == "not_clear")

    # Calculate pending members - those expected but not yet responded
    responded_codes = {r.member_code.upper() for r in responses}
    pending_members = []

    if ticket.expected_members:
        for member in ticket.expected_members:
            if member.member_code.upper() not in responded_codes:
                pending_members.append(
                    {
                        "member_code": member.member_code,
                        "member_name": member.member_name,
                    }
                )

    # Create custom summary with pending members
    return ResponseSummary(
        ticket_id=ticket.ticket_id,
        total_expected=expected_count,
        total_received=received_count,
        clear_count=clear_count,
        not_clear_count=not_clear_count,
        pending_members=pending_members,
    )


# Parcel Enrichment Router
parcel_router = APIRouter(prefix="/parcels", tags=["Parcels"])


@parcel_router.post(
    "/enrich",
    tags=["Parcels"],
    summary="Enrich parcel data from address or GPS coordinates",
    description=(
        "Provides detailed parcel enrichment by querying GIS databases. "
        "Accepts address, GPS coordinates, or both for comparison analysis. "
        "Returns parcel ownership, legal descriptions, and comparison metrics."
    ),
    response_description="Enriched parcel data with optional comparison analysis",
    response_model=ParcelEnrichResponse,
)
async def enrich_parcel_endpoint(
    request: ParcelEnrichRequest,
    api_key: str = Depends(verify_api_key),
) -> ParcelEnrichResponse:
    """
    Enrich parcel data from address, GPS coordinates, or both.

    This endpoint provides detailed parcel information by:
    1. Geocoding addresses to GPS coordinates (if address provided)
    2. Querying GIS systems for parcel data at coordinates
    3. Comparing results when both address and GPS are provided

    Args:
        request: Parcel enrichment request with address and/or GPS coordinates
        api_key: Verified API key

    Returns:
        Detailed parcel enrichment response with comparison metrics

    Raises:
        HTTPException: If enrichment fails or invalid input provided
    """
    start_time = time.time()
    request_id = str(uuid.uuid4())

    try:
        logger.info(f"Parcel enrichment request {request_id}: {request}")

        # Initialize response data
        address_enrichment = None
        gps_enrichment = None
        both_provided = bool(
            request.address
            and request.gps_lat is not None
            and request.gps_lng is not None
        )

        # Process address geocoding + enrichment
        if request.address:
            try:
                # Geocode the address
                geocode_result = geocoding_service.geocode_address(request.address)
                geocoded_lat = geocode_result["latitude"]
                geocoded_lng = geocode_result["longitude"]
                geocoding_confidence = geocode_result.get("confidence", 0.0)

                # Enrich with parcel data
                parcel_data = await enrichParcelFromGIS(
                    geocoded_lat, geocoded_lng, request.county
                )

                # Convert to ParcelInfoModel
                parcel_info = (
                    ParcelInfoModel(
                        subdivision=parcel_data.get("subdivision"),
                        lot=parcel_data.get("lot"),
                        block=parcel_data.get("block"),
                        parcel_id=parcel_data.get("parcel_id"),
                        owner=parcel_data.get("owner"),
                        address=parcel_data.get("address"),
                        feature_found=parcel_data.get("feature_found", False),
                        matched_count=parcel_data.get("matched_count", 0),
                        raw_features=parcel_data.get("raw_features"),
                    )
                    if parcel_data.get("feature_found")
                    else None
                )

                address_enrichment = ParcelEnrichmentResult(
                    geocoded_location={"lat": geocoded_lat, "lng": geocoded_lng},
                    geocoding_confidence=geocoding_confidence,
                    coordinates_used={"lat": geocoded_lat, "lng": geocoded_lng},
                    parcel_info=parcel_info,
                )

            except Exception as e:
                logger.error(f"Address enrichment failed for {request.address}: {e}")
                # Continue with partial results rather than failing completely

        # Process GPS coordinates enrichment
        if request.gps_lat is not None and request.gps_lng is not None:
            try:
                # Enrich with parcel data directly from GPS coordinates
                parcel_data = await enrichParcelFromGIS(
                    request.gps_lat, request.gps_lng, request.county
                )

                # Convert to ParcelInfoModel
                parcel_info = (
                    ParcelInfoModel(
                        subdivision=parcel_data.get("subdivision"),
                        lot=parcel_data.get("lot"),
                        block=parcel_data.get("block"),
                        parcel_id=parcel_data.get("parcel_id"),
                        owner=parcel_data.get("owner"),
                        address=parcel_data.get("address"),
                        feature_found=parcel_data.get("feature_found", False),
                        matched_count=parcel_data.get("matched_count", 0),
                        raw_features=parcel_data.get("raw_features"),
                    )
                    if parcel_data.get("feature_found")
                    else None
                )

                gps_enrichment = ParcelEnrichmentResult(
                    coordinates_used={"lat": request.gps_lat, "lng": request.gps_lng},
                    parcel_info=parcel_info,
                )

            except Exception as e:
                logger.error(
                    f"GPS enrichment failed for {request.gps_lat}, {request.gps_lng}: {e}"
                )
                # Continue with partial results rather than failing completely

        # Calculate comparison metrics
        comparison = ParcelComparisonMetrics(both_provided=both_provided)

        if both_provided and address_enrichment and gps_enrichment:
            addr_parcel = address_enrichment.parcel_info
            gps_parcel = gps_enrichment.parcel_info

            if addr_parcel and gps_parcel:
                # Compare parcel IDs
                comparison.parcel_id_match = (
                    addr_parcel.parcel_id is not None
                    and gps_parcel.parcel_id is not None
                    and addr_parcel.parcel_id == gps_parcel.parcel_id
                )

                # Compare owners (case-insensitive)
                comparison.owner_match = (
                    addr_parcel.owner is not None
                    and gps_parcel.owner is not None
                    and addr_parcel.owner.lower() == gps_parcel.owner.lower()
                )

                # Compare addresses (case-insensitive)
                comparison.address_match = (
                    addr_parcel.address is not None
                    and gps_parcel.address is not None
                    and addr_parcel.address.lower() == gps_parcel.address.lower()
                )

                # Calculate distance between geocoded address and GPS coordinates
                if address_enrichment.geocoded_location:
                    geocoded_lat = address_enrichment.geocoded_location["lat"]
                    geocoded_lng = address_enrichment.geocoded_location["lng"]
                    comparison.distance_meters = calculate_haversine_distance(
                        geocoded_lat, geocoded_lng, request.gps_lat, request.gps_lng
                    )

                # Overall assessment - same parcel if parcel ID matches or very close distance
                comparison.same_parcel = comparison.parcel_id_match or (
                    comparison.distance_meters is not None
                    and comparison.distance_meters < 50
                )  # 50 meters

        # Build response
        response = ParcelEnrichResponse(
            success=True,
            timestamp=datetime.now(UTC),
            request_id=request_id,
            address_provided=request.address,
            gps_provided=(
                {"lat": request.gps_lat, "lng": request.gps_lng}
                if request.gps_lat is not None and request.gps_lng is not None
                else None
            ),
            address_enrichment=address_enrichment,
            gps_enrichment=gps_enrichment,
            comparison=comparison,
        )

        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Parcel enrichment completed in {processing_time:.1f}ms")

        return response

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Parcel enrichment failed: {e}", exc_info=True)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enrich parcel data: {str(e)}",
        ) from e
