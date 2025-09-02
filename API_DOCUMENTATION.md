# Texas 811 POC Backend API Documentation

## Overview

The Texas 811 POC Backend provides a RESTful API for processing utility locate request tickets. It validates work order data extracted from PDFs, enriches it with geocoding and compliance calculations, and generates Texas 811-compliant submission packets.

**Base URL:** `https://texas811-poc-production.up.railway.app`
**API Version:** 0.1.0
**OpenAPI Spec:** Available at `/docs` (Swagger UI) and `/openapi.json` (raw spec)

## Authentication

Currently, the POC API does not require authentication. In production, API key authentication will be implemented for CustomGPT integration.

## Core Concepts

### Ticket Lifecycle

Tickets progress through the following states:
1. **Draft** - Initial creation, partial data allowed
2. **Validated** - All required fields present and valid
3. **Confirmed** - Ready for submission, fields locked
4. **Submitted** - Manually marked as submitted to Texas 811
5. **Active** - Responses received, work can begin
6. **Expired** - Past 14-day validity window

### Session Management

Sessions track validation state across multiple API calls, enabling iterative data completion:
- Sessions expire after 1 hour of inactivity
- Each session can manage multiple tickets
- Session ID is returned on ticket creation

### Validation Gaps

The API returns detailed validation feedback:
- **Required** - Must be fixed before submission
- **Recommended** - Should be fixed for completeness
- **Optional** - Nice to have but not critical

## API Endpoints

### Health Check Endpoints

#### GET /health
Check if the API is running and healthy.

**Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "environment": "production",
  "timestamp": "2025-09-02T01:30:00Z"
}
```

#### GET /ready
Check if the API is ready to handle requests (all dependencies connected).

**Response:**
```json
{
  "ready": true,
  "database": "connected",
  "redis": "connected",
  "timestamp": "2025-09-02T01:30:00Z"
}
```

### Ticket Management Endpoints

#### POST /tickets/create
Create a new ticket with partial or complete data. Returns validation gaps for iterative completion.

**Request Body:**
```json
{
  "caller_name": "John Smith",
  "caller_phone": "512-555-0100",
  "caller_email": "john@example.com",
  "excavator_name": "ABC Construction",
  "excavator_address": "123 Main St, Austin, TX 78701",
  "excavator_phone": "512-555-0200",
  "work_type": "New Water Line Installation",
  "work_duration": "2 days",
  "work_description": "Installing 100ft of 2-inch water line",
  "location_address": "456 Oak Street, Austin, TX 78702",
  "location_cross_street": "Pine Ave",
  "location_subdivision": "Riverside",
  "location_notes": "Work area extends 50ft north from address"
}
```

**Response (200 OK):**
```json
{
  "ticket_id": "tkt_20250902_a1b2c3",
  "session_id": "ses_xyz789",
  "status": "draft",
  "validation_status": "incomplete",
  "validation_gaps": [
    {
      "field": "planned_start_date",
      "severity": "required",
      "message": "Planned start date is required",
      "suggestion": "Please provide the date you plan to begin excavation (must be at least 2 business days from today)"
    },
    {
      "field": "location_county",
      "severity": "recommended",
      "message": "County helps ensure proper utility member notification",
      "suggestion": "Based on the address, this appears to be Travis County"
    }
  ],
  "progress": {
    "required_fields_complete": 14,
    "required_fields_total": 16,
    "percentage": 87.5
  },
  "next_action": "Please provide the 2 missing required fields to complete validation"
}
```

#### POST /tickets/{ticket_id}/update
Update an existing ticket with additional or corrected data.

**Request Body:**
```json
{
  "planned_start_date": "2025-09-05",
  "location_county": "Travis"
}
```

**Response (200 OK):**
```json
{
  "ticket_id": "tkt_20250902_a1b2c3",
  "status": "validated",
  "validation_status": "complete",
  "validation_gaps": [],
  "enrichments": {
    "geocoding": {
      "latitude": 30.2672,
      "longitude": -97.7431,
      "confidence": 0.95
    },
    "compliance": {
      "earliest_start_date": "2025-09-05",
      "ticket_expiration_date": "2025-09-19",
      "business_days_notice": 2
    },
    "geometry": {
      "type": "box",
      "coordinates": [
        [-97.7432, 30.2671],
        [-97.7430, 30.2671],
        [-97.7430, 30.2673],
        [-97.7432, 30.2673]
      ]
    }
  },
  "next_action": "Ticket is fully validated. Call /confirm to lock fields and prepare submission packet."
}
```

#### POST /tickets/{ticket_id}/confirm
Confirm a validated ticket, locking fields and generating the submission packet.

**Response (200 OK):**
```json
{
  "ticket_id": "tkt_20250902_a1b2c3",
  "status": "confirmed",
  "submission_packet": {
    "reference_number": "tkt_20250902_a1b2c3",
    "caller_section": {
      "name": "John Smith",
      "phone": "512-555-0100",
      "email": "john@example.com"
    },
    "excavator_section": {
      "company": "ABC Construction",
      "address": "123 Main St, Austin, TX 78701",
      "phone": "512-555-0200"
    },
    "work_section": {
      "type": "New Water Line Installation",
      "duration": "2 days",
      "description": "Installing 100ft of 2-inch water line",
      "planned_start": "09/05/2025",
      "expiration": "09/19/2025"
    },
    "location_section": {
      "address": "456 Oak Street, Austin, TX 78702",
      "city": "Austin",
      "county": "Travis",
      "cross_street": "Pine Ave",
      "subdivision": "Riverside",
      "gps_latitude": "30.2672",
      "gps_longitude": "-97.7431",
      "notes": "Work area extends 50ft north from address"
    }
  },
  "portal_ready": true,
  "next_action": "Submission packet ready. Submit to Texas 811 portal and call /mark-submitted."
}
```

#### GET /tickets/{ticket_id}
Retrieve detailed information about a specific ticket.

**Response (200 OK):**
```json
{
  "ticket_id": "tkt_20250902_a1b2c3",
  "created_at": "2025-09-02T01:00:00Z",
  "updated_at": "2025-09-02T01:15:00Z",
  "status": "confirmed",
  "validation_status": "complete",
  "data": {
    "caller_name": "John Smith",
    "caller_phone": "512-555-0100",
    "...": "... all ticket fields ..."
  },
  "enrichments": {
    "geocoding": { "...": "..." },
    "compliance": { "...": "..." },
    "geometry": { "...": "..." }
  },
  "audit_trail": [
    {
      "timestamp": "2025-09-02T01:00:00Z",
      "action": "created",
      "changes": {}
    },
    {
      "timestamp": "2025-09-02T01:10:00Z",
      "action": "updated",
      "changes": {
        "planned_start_date": "2025-09-05",
        "location_county": "Travis"
      }
    }
  ]
}
```

### Dashboard Endpoints

#### GET /dashboard/tickets
List all tickets with filtering and pagination.

**Query Parameters:**
- `status` - Filter by ticket status (draft, validated, confirmed, submitted, active, expired)
- `created_after` - ISO date to filter tickets created after
- `created_before` - ISO date to filter tickets created before
- `limit` - Number of results per page (default: 20, max: 100)
- `offset` - Pagination offset (default: 0)

**Response (200 OK):**
```json
{
  "tickets": [
    {
      "ticket_id": "tkt_20250902_a1b2c3",
      "created_at": "2025-09-02T01:00:00Z",
      "status": "confirmed",
      "excavator_name": "ABC Construction",
      "location_address": "456 Oak Street, Austin, TX 78702",
      "planned_start_date": "2025-09-05",
      "days_until_start": 3,
      "days_until_expiration": 17
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

#### GET /dashboard/tickets/{ticket_id}
Get detailed dashboard view of a specific ticket.

**Response (200 OK):**
```json
{
  "ticket_id": "tkt_20250902_a1b2c3",
  "status": "confirmed",
  "timeline": {
    "created": "2025-09-02T01:00:00Z",
    "validated": "2025-09-02T01:10:00Z",
    "confirmed": "2025-09-02T01:15:00Z",
    "submitted": null,
    "responses_received": null
  },
  "compliance_status": {
    "can_start_work": false,
    "earliest_start": "2025-09-05T00:00:00Z",
    "days_until_start": 3,
    "expiration_date": "2025-09-19T23:59:59Z",
    "days_until_expiration": 17,
    "is_expired": false
  },
  "submission_packet": { "...": "..." },
  "validation_summary": {
    "total_fields": 20,
    "completed_fields": 20,
    "validation_gaps": []
  }
}
```

#### POST /dashboard/tickets/{ticket_id}/mark-submitted
Manually mark a ticket as submitted to Texas 811.

**Request Body:**
```json
{
  "texas811_ticket_number": "2025090212345",
  "submitted_at": "2025-09-02T14:30:00Z"
}
```

**Response (200 OK):**
```json
{
  "ticket_id": "tkt_20250902_a1b2c3",
  "status": "submitted",
  "texas811_ticket_number": "2025090212345",
  "submitted_at": "2025-09-02T14:30:00Z",
  "waiting_period_ends": "2025-09-05T00:00:00Z",
  "message": "Ticket marked as submitted. Waiting period ends in 2 business days."
}
```

#### POST /dashboard/tickets/{ticket_id}/mark-responses-in
Mark that positive responses have been received from utility members.

**Request Body:**
```json
{
  "all_clear": true,
  "responses_received_at": "2025-09-04T10:00:00Z",
  "notes": "All utilities marked. Gas line 10ft west of work area."
}
```

**Response (200 OK):**
```json
{
  "ticket_id": "tkt_20250902_a1b2c3",
  "status": "active",
  "can_start_work": true,
  "responses_received_at": "2025-09-04T10:00:00Z",
  "marking_valid_until": "2025-09-18T23:59:59Z",
  "days_remaining": 14,
  "message": "All clear received. Work can begin on 2025-09-05."
}
```

### Session Endpoints

#### GET /tickets/session/{session_id}/tickets
List all tickets associated with a session.

**Response (200 OK):**
```json
{
  "session_id": "ses_xyz789",
  "created_at": "2025-09-02T01:00:00Z",
  "expires_at": "2025-09-02T02:00:00Z",
  "tickets": [
    {
      "ticket_id": "tkt_20250902_a1b2c3",
      "status": "confirmed",
      "created_at": "2025-09-02T01:00:00Z"
    }
  ],
  "total_tickets": 1
}
```

## Error Responses

The API uses standard HTTP status codes and returns detailed error information:

### 400 Bad Request
Invalid input data or business rule violation.

```json
{
  "error": "validation_error",
  "message": "Invalid input data",
  "details": [
    {
      "field": "planned_start_date",
      "error": "Date cannot be in the past"
    }
  ]
}
```

### 404 Not Found
Requested resource does not exist.

```json
{
  "error": "not_found",
  "message": "Ticket not found",
  "ticket_id": "tkt_invalid_id"
}
```

### 409 Conflict
Operation conflicts with current resource state.

```json
{
  "error": "conflict",
  "message": "Cannot update confirmed ticket",
  "current_status": "confirmed",
  "allowed_actions": ["mark-submitted"]
}
```

### 422 Unprocessable Entity
Request is well-formed but contains semantic errors.

```json
{
  "error": "unprocessable_entity",
  "message": "Ticket not ready for confirmation",
  "validation_gaps": [
    {
      "field": "location_county",
      "severity": "required",
      "message": "County is required for submission"
    }
  ]
}
```

### 500 Internal Server Error
Unexpected server error.

```json
{
  "error": "internal_error",
  "message": "An unexpected error occurred",
  "request_id": "req_abc123"
}
```

## Integration Guide for CustomGPT

### Typical Workflow

1. **Initial Creation**
   - CustomGPT extracts data from PDF
   - POST to `/tickets/create` with available fields
   - Receive validation gaps and session ID

2. **Iterative Completion**
   - CustomGPT prompts user for missing fields
   - POST to `/tickets/{ticket_id}/update` with new data
   - Repeat until validation_status is "complete"

3. **Confirmation**
   - POST to `/tickets/{ticket_id}/confirm`
   - Receive submission packet
   - Display packet to user for Texas 811 portal entry

4. **Post-Submission**
   - User manually submits to Texas 811
   - Dashboard used to mark submitted and track status

### Best Practices

1. **Session Management**
   - Store session_id for multi-turn conversations
   - Sessions expire after 1 hour of inactivity

2. **Error Handling**
   - Check validation_gaps array in responses
   - Use severity field to prioritize user prompts
   - Display suggestions to guide users

3. **Field Validation**
   - Send all available fields, even if incomplete
   - API will validate and enrich incrementally
   - Don't retry geocoding if confidence is already high

4. **Compliance Dates**
   - Always respect earliest_start_date
   - Monitor expiration_date for active tickets
   - Account for Texas holidays in date calculations

## Performance Considerations

- **Response Time:** Target <500ms for validation endpoints
- **Geocoding Cache:** Results cached for 24 hours
- **Session TTL:** 1 hour sliding window
- **Rate Limits:** None in POC, production will have 100 req/min

## Deployment Information

- **Environment:** Production on Railway
- **Health Check:** `GET /health`
- **OpenAPI Spec:** `GET /openapi.json`
- **Interactive Docs:** `GET /docs` (Swagger UI)
- **Alternative Docs:** `GET /redoc` (ReDoc)

## Support

For issues or questions about the API:
- Check the OpenAPI specification at `/docs`
- Review validation gap messages for field-specific guidance
- Ensure dates account for Texas business days and holidays
