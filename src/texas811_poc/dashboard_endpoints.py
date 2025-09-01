"""
Dashboard endpoints implementation for Texas811 POC.

This module implements dashboard endpoints for manual ticket management:
- GET /tickets: List tickets with filtering and pagination
- GET /tickets/{ticket_id}: Detailed ticket view with audit history
- POST /tickets/{ticket_id}/mark-submitted: Manual submission tracking
- POST /tickets/{ticket_id}/mark-responses-in: Response tracking
- DELETE /tickets/{ticket_id}: Ticket cancellation and deletion

Focus on compliance officers and field managers operations.
"""

import logging
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, model_validator

from texas811_poc.compliance import ComplianceCalculator
from texas811_poc.config import settings
from texas811_poc.models import (
    AuditAction,
    AuditEventModel,
    TicketModel,
    TicketStatus,
)
from texas811_poc.storage import create_storage_instances

# Configure logging
logger = logging.getLogger(__name__)

# Initialize storage and compliance calculator
ticket_storage, audit_storage, backup_manager = create_storage_instances(
    settings.data_root
)
compliance_calculator = ComplianceCalculator()

# API Router
router = APIRouter(prefix="/dashboard", tags=["Dashboard & Manual Operations"])

# Security
security = HTTPBearer()


# Request/Response Models
class TicketListResponse(BaseModel):
    """Response model for ticket listing."""

    tickets: list[TicketModel]
    total_count: int
    page: int = Field(default=1, description="Current page number")
    page_size: int = Field(default=50, description="Number of tickets per page")


class CountdownInfo(BaseModel):
    """Countdown and compliance deadline information."""

    days_until_start: int = Field(..., description="Days until lawful start date")
    days_until_expiry: int = Field(..., description="Days until ticket expires")
    days_until_marking_expiry: int | None = Field(
        None, description="Days until markings expire"
    )
    can_start_today: bool = Field(..., description="Whether work can start today")
    can_start_work: bool = Field(
        ..., description="Whether work is authorized (past lawful start)"
    )
    markings_valid: bool = Field(
        ..., description="Whether markings are currently valid"
    )
    is_expired: bool = Field(..., description="Whether ticket has expired")
    is_urgent: bool = Field(
        ..., description="Whether ticket is urgent (start < 2 days)"
    )
    requires_action: bool = Field(
        ..., description="Whether ticket requires immediate action"
    )
    action_required: str | None = Field(
        None, description="Description of required action"
    )
    status_description: str = Field(
        ..., description="Human-readable status description"
    )


class TicketDetailResponse(BaseModel):
    """Extended ticket response with audit history and countdown info."""

    ticket_id: str
    session_id: str
    status: TicketStatus
    county: str
    city: str
    address: str
    cross_street: str | None = None
    work_description: str
    caller_name: str | None = None
    caller_company: str | None = None
    caller_phone: str | None = None
    caller_email: str | None = None
    excavator_company: str | None = None
    excavator_address: str | None = None
    excavator_phone: str | None = None
    work_start_date: date | None = None
    work_duration_days: int | None = None
    work_type: str | None = None
    remarks: str | None = None
    gps_lat: float | None = None
    gps_lng: float | None = None
    lawful_start_date: date | None = None
    ticket_expires_date: date | None = None
    marking_valid_until: date | None = None
    submitted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    audit_history: list[AuditEventModel]
    countdown_info: CountdownInfo


class MarkSubmittedRequest(BaseModel):
    """Request model for marking ticket as submitted."""

    submission_reference: str = Field(
        ..., min_length=1, description="Texas811 submission reference"
    )
    notes: str | None = Field(None, description="Additional submission notes")


class MarkSubmittedResponse(BaseModel):
    """Response model for marking ticket as submitted."""

    success: bool = True
    ticket_id: str
    old_status: TicketStatus
    new_status: TicketStatus = TicketStatus.SUBMITTED
    submitted_at: datetime
    submission_reference: str
    audit_event_created: bool = True


class MarkResponsesInRequest(BaseModel):
    """Request model for marking positive responses received."""

    response_count: int = Field(
        ..., ge=1, description="Number of utility responses received"
    )
    all_clear: bool = Field(..., description="Whether all responses were clear to dig")
    notes: str | None = Field(None, description="Response details or notes")


class MarkResponsesInResponse(BaseModel):
    """Response model for marking responses received."""

    success: bool = True
    ticket_id: str
    old_status: TicketStatus
    new_status: TicketStatus = TicketStatus.RESPONSES_IN
    responses_received_at: datetime
    response_count: int
    all_clear: bool
    audit_event_created: bool = True


class CancelTicketRequest(BaseModel):
    """Request model for cancelling ticket."""

    reason: str | None = Field(None, description="Reason for cancellation")
    confirm_deletion: bool | None = Field(
        False, description="Confirm permanent deletion"
    )

    @model_validator(mode="after")
    def validate_reason_or_deletion(self) -> "CancelTicketRequest":
        """Ensure either reason is provided for cancellation or confirm_deletion is True for deletion."""
        if self.confirm_deletion is True:
            # For permanent deletion, reason is optional
            return self
        elif not self.reason or len(self.reason.strip()) == 0:
            # For cancellation, reason is required
            raise ValueError("Reason is required for ticket cancellation")
        return self


class CancelTicketResponse(BaseModel):
    """Response model for ticket cancellation."""

    success: bool = True
    ticket_id: str
    action: str  # "cancelled" or "deleted"
    reason: str
    cancelled_at: datetime | None = None
    audit_event_created: bool = True


# Authentication (shared with main API)
async def verify_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Verify API key authentication."""
    api_key = credentials.credentials

    valid_keys = [
        settings.api_key,
        "test-api-key-12345",  # For testing
        "customgpt-integration-key",  # For CustomGPT
        "dashboard-admin-key",  # For dashboard operations
    ]

    # Remove None and empty keys
    valid_keys = [key for key in valid_keys if key and key.strip()]

    if not api_key or (valid_keys and api_key not in valid_keys):
        logger.warning(f"Invalid API key attempted for dashboard: {api_key[:10]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return api_key


# Utility functions
def calculate_countdown_info(ticket: TicketModel) -> CountdownInfo:
    """Calculate countdown and compliance deadline information using comprehensive compliance calculator."""
    # Convert ticket to dict for compliance calculator
    ticket_dict = ticket.model_dump()

    # Get comprehensive lifecycle status from compliance calculator
    lifecycle_status = compliance_calculator.get_ticket_lifecycle_status(ticket_dict)

    # Extract values with defaults
    days_until_start = lifecycle_status.get("days_until_lawful_start") or 0
    days_until_expiry = lifecycle_status.get("days_until_expiration") or 0
    days_until_marking_expiry = lifecycle_status.get("days_until_marking_expiration")
    can_start_work = lifecycle_status.get("can_start_work", False)
    markings_valid = lifecycle_status.get("markings_valid", False)
    requires_action = lifecycle_status.get("requires_action", False)
    action_required = lifecycle_status.get("action_required")

    # Backward compatibility calculations
    can_start_today = days_until_start <= 0
    is_expired = lifecycle_status["current_status"] == "expired"
    is_urgent = 0 < days_until_start <= 2

    # Generate enhanced status descriptions
    current_status = lifecycle_status["current_status"]

    status_descriptions = {
        "draft": "Draft - requires validation before submission",
        "validated": f"Validated - ready for submission ({abs(days_until_start)} days until lawful start)",
        "ready": f"Ready - awaiting submission ({abs(days_until_start)} days until lawful start)",
        "submitted": f"Submitted - waiting for utility responses ({days_until_expiry} days remaining)",
        "responses_in": f"Responses received - markings valid ({days_until_expiry} days remaining)",
        "ready_to_dig": f"Ready to dig - all clear to start work ({days_until_expiry} days remaining)",
        "completed": "Work completed",
        "cancelled": "Cancelled",
        "expired": "Ticket expired - new ticket required",
    }

    status_description = status_descriptions.get(
        current_status, f"Status: {current_status}"
    )

    # Add urgency indicators
    if is_urgent and current_status in ["validated", "ready"]:
        status_description = f"URGENT: {status_description}"
    elif is_expired:
        status_description = f"EXPIRED: {status_description}"
    elif requires_action and action_required:
        status_description = (
            f"ACTION REQUIRED: {status_description} | {action_required}"
        )

    return CountdownInfo(
        days_until_start=days_until_start,
        days_until_expiry=days_until_expiry,
        days_until_marking_expiry=days_until_marking_expiry,
        can_start_today=can_start_today,
        can_start_work=can_start_work,
        markings_valid=markings_valid,
        is_expired=is_expired,
        is_urgent=is_urgent,
        requires_action=requires_action,
        action_required=action_required,
        status_description=status_description,
    )


def parse_date_filter(date_str: str) -> datetime:
    """Parse date string for filtering."""
    try:
        # Handle URL encoding issues and various formats
        clean_date = date_str.replace(" ", "+").replace("Z", "+00:00")
        return datetime.fromisoformat(clean_date)
    except ValueError:
        # Try date only format
        try:
            parsed_date = datetime.strptime(date_str, "%Y-%m-%d")
            return parsed_date.replace(tzinfo=UTC)
        except ValueError:
            try:
                # Try without timezone info
                clean_date = date_str.split("+")[0].split("Z")[0]
                parsed_date = datetime.fromisoformat(clean_date)
                return parsed_date.replace(tzinfo=UTC)
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid date format: {date_str}. Use ISO format (YYYY-MM-DDTHH:MM:SS) or YYYY-MM-DD",
                ) from e


# Dashboard Endpoints


@router.get("/tickets", response_model=TicketListResponse)
async def get_tickets(
    api_key: str = Depends(verify_api_key),
    status: str | None = Query(None, description="Filter by ticket status"),
    county: str | None = Query(None, description="Filter by county"),
    city: str | None = Query(None, description="Filter by city"),
    created_since: str | None = Query(
        None, description="Filter by creation date (ISO format)"
    ),
    updated_since: str | None = Query(
        None, description="Filter by update date (ISO format)"
    ),
    limit: int = Query(
        50, ge=1, le=100, description="Maximum number of tickets to return"
    ),
    offset: int = Query(
        0, ge=0, description="Number of tickets to skip for pagination"
    ),
) -> TicketListResponse:
    """
    Get list of tickets with filtering and pagination.

    Supports filtering by:
    - Status (draft, validated, ready, submitted, etc.)
    - County and city
    - Creation and update dates
    - Pagination with limit/offset

    Results are ordered by updated_at descending (most recent first).
    """
    try:
        logger.info(
            f"Dashboard tickets list requested with filters: status={status}, county={county}, limit={limit}"
        )

        # Get all tickets from storage
        all_tickets = ticket_storage.list_tickets()

        # Apply filters
        filtered_tickets = all_tickets

        # Status filter
        if status:
            # Normalize status for comparison
            status_normalized = status.lower()
            filtered_tickets = [
                t for t in filtered_tickets if t.status.lower() == status_normalized
            ]

        # County filter
        if county:
            filtered_tickets = [
                t for t in filtered_tickets if t.county.lower() == county.lower()
            ]

        # City filter
        if city:
            filtered_tickets = [
                t for t in filtered_tickets if t.city.lower() == city.lower()
            ]

        # Date filters
        if created_since:
            created_since_dt = parse_date_filter(created_since)
            filtered_tickets = [
                t for t in filtered_tickets if t.created_at >= created_since_dt
            ]

        if updated_since:
            updated_since_dt = parse_date_filter(updated_since)
            filtered_tickets = [
                t for t in filtered_tickets if t.updated_at >= updated_since_dt
            ]

        # Sort by updated_at descending (most recent first)
        filtered_tickets.sort(key=lambda t: t.updated_at, reverse=True)

        # Calculate pagination
        total_count = len(filtered_tickets)
        paginated_tickets = filtered_tickets[offset : offset + limit]
        page_number = (offset // limit) + 1

        logger.info(
            f"Returning {len(paginated_tickets)} tickets out of {total_count} total (page {page_number})"
        )

        return TicketListResponse(
            tickets=paginated_tickets,
            total_count=total_count,
            page=page_number,
            page_size=len(paginated_tickets),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving tickets: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve tickets: {str(e)}",
        ) from e


@router.get("/tickets/{ticket_id}", response_model=TicketDetailResponse)
async def get_ticket_detail(
    ticket_id: str,
    api_key: str = Depends(verify_api_key),
) -> TicketDetailResponse:
    """
    Get detailed ticket information with audit history and countdown info.

    Includes:
    - Complete ticket data
    - Full audit trail
    - Countdown calculations (days until start, expiry)
    - Compliance status information
    """
    try:
        logger.info(f"Dashboard ticket detail requested for: {ticket_id}")

        # Load ticket
        ticket = ticket_storage.load_ticket(ticket_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ticket {ticket_id} not found",
            )

        # Load audit history
        audit_events = audit_storage.get_audit_events(ticket_id)

        # Calculate countdown information
        countdown_info = calculate_countdown_info(ticket)

        # Build response
        response = TicketDetailResponse(
            ticket_id=ticket.ticket_id,
            session_id=ticket.session_id,
            status=ticket.status,
            county=ticket.county,
            city=ticket.city,
            address=ticket.address,
            cross_street=ticket.cross_street,
            work_description=ticket.work_description,
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
            gps_lat=ticket.gps_lat,
            gps_lng=ticket.gps_lng,
            lawful_start_date=ticket.lawful_start_date,
            ticket_expires_date=ticket.ticket_expires_date,
            marking_valid_until=ticket.marking_valid_until,
            submitted_at=ticket.submitted_at,
            created_at=ticket.created_at,
            updated_at=ticket.updated_at,
            audit_history=audit_events,
            countdown_info=countdown_info,
        )

        logger.info(f"Ticket detail loaded with {len(audit_events)} audit events")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving ticket detail {ticket_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve ticket detail: {str(e)}",
        ) from e


@router.post(
    "/tickets/{ticket_id}/mark-submitted", response_model=MarkSubmittedResponse
)
async def mark_ticket_submitted(
    ticket_id: str,
    request: MarkSubmittedRequest,
    api_key: str = Depends(verify_api_key),
) -> MarkSubmittedResponse:
    """
    Manually mark ticket as submitted to Texas811.

    Updates ticket status to SUBMITTED and records submission timestamp.
    Only READY tickets can be marked as submitted.
    """
    try:
        logger.info(
            f"Marking ticket {ticket_id} as submitted with reference: {request.submission_reference}"
        )

        # Load ticket
        ticket = ticket_storage.load_ticket(ticket_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ticket {ticket_id} not found",
            )

        # Validate current status
        if ticket.status != TicketStatus.READY:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ticket with status '{ticket.status}' cannot be marked as submitted. Must be 'ready'.",
            )

        # Store old status for response
        old_status = ticket.status

        # Update ticket
        ticket.status = TicketStatus.SUBMITTED
        ticket.submitted_at = datetime.now(UTC)
        ticket.updated_at = datetime.now(UTC)

        # Add submission reference to remarks
        submission_note = (
            f"Submitted to Texas811 - Reference: {request.submission_reference}"
        )
        if request.notes:
            submission_note += f" - Notes: {request.notes}"

        if ticket.remarks:
            ticket.remarks += f"\n{submission_note}"
        else:
            ticket.remarks = submission_note

        # Save updated ticket
        ticket_storage.save_ticket(ticket, create_backup=True)

        # Create audit event
        audit_event = AuditEventModel(
            ticket_id=ticket.ticket_id,
            action=AuditAction.TICKET_SUBMITTED,
            user_id="dashboard_user",  # Could be enhanced with actual user tracking
            details={
                "submission_reference": request.submission_reference,
                "old_status": old_status,
                "new_status": ticket.status,
                "notes": request.notes,
                "submitted_via": "manual_dashboard",
            },
        )
        audit_storage.save_audit_event(audit_event)

        logger.info(f"Ticket {ticket_id} successfully marked as submitted")

        return MarkSubmittedResponse(
            ticket_id=ticket.ticket_id,
            old_status=old_status,
            new_status=ticket.status,
            submitted_at=ticket.submitted_at,
            submission_reference=request.submission_reference,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error marking ticket {ticket_id} as submitted: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark ticket as submitted: {str(e)}",
        ) from e


@router.post(
    "/tickets/{ticket_id}/mark-responses-in", response_model=MarkResponsesInResponse
)
async def mark_responses_received(
    ticket_id: str,
    request: MarkResponsesInRequest,
    api_key: str = Depends(verify_api_key),
) -> MarkResponsesInResponse:
    """
    Manually mark positive responses received from utilities.

    Updates ticket status to RESPONSES_IN when all utility companies
    have responded with locate markings or clear to dig responses.
    Only SUBMITTED tickets can have responses marked.
    """
    try:
        logger.info(
            f"Marking responses received for ticket {ticket_id}: {request.response_count} responses, all_clear={request.all_clear}"
        )

        # Load ticket
        ticket = ticket_storage.load_ticket(ticket_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ticket {ticket_id} not found",
            )

        # Validate current status
        if ticket.status != TicketStatus.SUBMITTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ticket must be submitted before responses can be marked. Current status: '{ticket.status}'",
            )

        # Store old status
        old_status = ticket.status

        # Update ticket status
        if request.all_clear:
            ticket.status = (
                TicketStatus.RESPONSES_IN
            )  # Could evolve to READY_TO_DIG for all clear
        else:
            ticket.status = TicketStatus.RESPONSES_IN

        ticket.updated_at = datetime.now(UTC)

        # Add response information to remarks
        response_note = (
            f"Utility responses received: {request.response_count} responses"
        )
        if request.all_clear:
            response_note += " (ALL CLEAR TO DIG)"
        else:
            response_note += " (markings/conflicts present)"

        if request.notes:
            response_note += f" - Notes: {request.notes}"

        if ticket.remarks:
            ticket.remarks += f"\n{response_note}"
        else:
            ticket.remarks = response_note

        # Save updated ticket
        ticket_storage.save_ticket(ticket, create_backup=True)

        # Create audit event
        audit_event = AuditEventModel(
            ticket_id=ticket.ticket_id,
            action=AuditAction.RESPONSES_RECEIVED,
            user_id="dashboard_user",
            details={
                "response_count": request.response_count,
                "all_clear": request.all_clear,
                "old_status": old_status,
                "new_status": ticket.status,
                "notes": request.notes,
                "marked_via": "manual_dashboard",
            },
        )
        audit_storage.save_audit_event(audit_event)

        logger.info(
            f"Responses marked for ticket {ticket_id}: {request.response_count} responses, all_clear={request.all_clear}"
        )

        return MarkResponsesInResponse(
            ticket_id=ticket.ticket_id,
            old_status=old_status,
            new_status=ticket.status,
            responses_received_at=datetime.now(UTC),
            response_count=request.response_count,
            all_clear=request.all_clear,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error marking responses for ticket {ticket_id}: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark responses received: {str(e)}",
        ) from e


@router.delete("/tickets/{ticket_id}", response_model=CancelTicketResponse)
async def cancel_ticket(
    ticket_id: str,
    request: CancelTicketRequest,
    permanent: bool = Query(False, description="Permanently delete cancelled ticket"),
    api_key: str = Depends(verify_api_key),
) -> CancelTicketResponse:
    """
    Cancel or delete a ticket.

    Normal operation: Cancel ticket (mark as CANCELLED)
    With permanent=true: Permanently delete cancelled ticket

    Active tickets must be cancelled before permanent deletion.
    Submitted tickets require detailed cancellation reason.
    """
    try:
        logger.info(
            f"Cancel/delete request for ticket {ticket_id}: permanent={permanent}"
        )

        # Load ticket
        ticket = ticket_storage.load_ticket(ticket_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ticket {ticket_id} not found",
            )

        # Check if permanent deletion requested
        if permanent:
            if request.confirm_deletion is not True:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Permanent deletion requires explicit confirmation",
                )

            # Only allow deletion of cancelled tickets
            if ticket.status != TicketStatus.CANCELLED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ticket must be cancelled first before permanent deletion",
                )

            # Create deletion audit event before deleting
            audit_event = AuditEventModel(
                ticket_id=ticket.ticket_id,
                action=AuditAction.TICKET_CANCELLED,  # Use same action, details will show deletion
                user_id="dashboard_user",
                details={
                    "action": "permanent_deletion",
                    "reason": request.reason or "Permanent deletion requested",
                    "deleted_via": "manual_dashboard",
                    "original_status": ticket.status,
                },
            )
            audit_storage.save_audit_event(audit_event)

            # Delete ticket permanently
            success = ticket_storage.delete_ticket(ticket_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to delete ticket from storage",
                )

            logger.info(f"Ticket {ticket_id} permanently deleted")

            return CancelTicketResponse(
                ticket_id=ticket_id,
                action="deleted",
                reason=request.reason or "Permanent deletion requested",
                cancelled_at=None,  # No cancellation time for deletion
            )

        else:
            # Normal cancellation

            # Validate reason for submitted tickets
            if ticket.status == TicketStatus.SUBMITTED and (
                not request.reason or len(request.reason.strip()) < 5
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Detailed cancellation reason is required for submitted tickets",
                )

            # Check if already cancelled
            if ticket.status == TicketStatus.CANCELLED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ticket is already cancelled",
                )

            # Store original status
            original_status = ticket.status

            # Cancel ticket
            ticket.status = TicketStatus.CANCELLED
            ticket.updated_at = datetime.now(UTC)
            cancelled_at = datetime.now(UTC)

            # Add cancellation to remarks
            cancellation_note = f"CANCELLED: {request.reason}"
            if ticket.remarks:
                ticket.remarks += f"\n{cancellation_note}"
            else:
                ticket.remarks = cancellation_note

            # Save cancelled ticket
            ticket_storage.save_ticket(ticket, create_backup=True)

            # Create audit event
            audit_event = AuditEventModel(
                ticket_id=ticket.ticket_id,
                action=AuditAction.TICKET_CANCELLED,
                user_id="dashboard_user",
                details={
                    "action": "cancellation",
                    "reason": request.reason,
                    "original_status": original_status,
                    "cancelled_via": "manual_dashboard",
                },
            )
            audit_storage.save_audit_event(audit_event)

            logger.info(f"Ticket {ticket_id} cancelled (was {original_status})")

            return CancelTicketResponse(
                ticket_id=ticket_id,
                action="cancelled",
                reason=request.reason,
                cancelled_at=cancelled_at,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error cancelling/deleting ticket {ticket_id}: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel/delete ticket: {str(e)}",
        ) from e
