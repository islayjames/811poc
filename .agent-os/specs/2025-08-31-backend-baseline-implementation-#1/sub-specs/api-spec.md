# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-31-backend-baseline-implementation-#1/spec.md

> Created: 2025-08-31
> Version: 1.0.0

## CustomGPT Integration Endpoints

### POST /tickets/create

**Purpose:** Create a draft ticket from initial CustomGPT field extraction
**Authentication:** API key required
**Parameters:** JSON body with extracted ticket fields (partial data accepted)
**Response:** Ticket ID, validation status, gaps array, warnings, submit packet preview

**Request Body:**
```json
{
  "work_order_ref": "WO-2024-001",
  "company": "ABC Excavation",
  "contact_name": "John Smith", 
  "phone": "512-555-0100",
  "email": "john@abcexcavation.com",
  "type_of_work": "Install utility lines",
  "county": "Travis",
  "city": "Austin",
  "address": "123 Main St, Austin, TX 78701",
  "work_area_description": "Front yard along ROW, 100 ft section"
}
```

**Response Format:**
```json
{
  "ticket_id": "uuid-string",
  "status": "Draft",
  "validation": {
    "status": "Invalid",
    "gaps": [
      {
        "field": "gps",
        "problem": "missing_address_or_gps", 
        "severity": "required",
        "suggested_prompt": "I need GPS coordinates or a more specific address. Can you provide the exact GPS location or street address with house number?"
      }
    ],
    "warnings": []
  },
  "geometry": {
    "type": "Point",
    "coordinates": [-97.7431, 30.2672],
    "confidence": 0.85,
    "assumptions": ["Used address geocoding", "Applied default 25ft box"]
  },
  "dates": {
    "requested_at": "2025-08-31T10:00:00Z",
    "earliest_lawful_start": "2025-09-04T00:00:00Z"
  },
  "submit_packet_preview": {
    "caller_excavator": {...},
    "work": {...},
    "location": {...}
  }
}
```

**Errors:**
- 400: Invalid input data or malformed request
- 401: Invalid or missing API key
- 422: Validation errors in request body
- 500: Internal server error

### POST /tickets/{ticket_id}/update

**Purpose:** Apply partial updates to existing ticket and re-validate
**Authentication:** API key required
**Parameters:** ticket_id (path), JSON body with field updates
**Response:** Updated validation status, gaps, warnings, geometry, dates

**Request Body:**
```json
{
  "gps": {
    "lat": 30.2672,
    "lng": -97.7431  
  },
  "cross_street": "Oak Ave",
  "is_trenchless": false
}
```

**Response Format:** Same as `/tickets/create` with updated data

**Errors:**
- 404: Ticket not found
- 409: Ticket already confirmed (locked)
- Other errors same as create endpoint

### POST /tickets/{ticket_id}/confirm

**Purpose:** Lock validated ticket and transition to Ready state
**Authentication:** API key required
**Parameters:** ticket_id (path)
**Response:** Frozen submit packet and computed dates

**Response Format:**
```json
{
  "ticket_id": "uuid-string",
  "status": "Ready",
  "submit_packet": {
    "caller_excavator": {
      "company": "ABC Excavation",
      "contact_name": "John Smith",
      "phone": "512-555-0100",
      "email": "john@abcexcavation.com"
    },
    "work": {
      "type_of_work": "Install utility lines",
      "is_trenchless": false,
      "is_blasting": false,
      "ticket_type_hint": "Normal"
    },
    "location": {
      "county": "Travis",
      "city": "Austin", 
      "address": "123 Main St, Austin, TX 78701",
      "cross_street": "Oak Ave",
      "gps": {"lat": 30.2672, "lng": -97.7431}
    },
    "map_description": {
      "geometry": {...},
      "work_area_description": "Front yard along ROW, 100 ft section"
    },
    "dates": {
      "requested_at": "2025-08-31T10:00:00Z",
      "earliest_lawful_start": "2025-09-04T00:00:00Z"
    }
  }
}
```

**Errors:**
- 404: Ticket not found
- 400: Ticket validation still has required gaps
- 409: Ticket already confirmed

## Dashboard/Manual Operation Endpoints

### GET /tickets

**Purpose:** List all tickets for dashboard display
**Authentication:** API key required
**Parameters:** Query parameters for filtering and pagination
**Response:** Array of ticket summaries

**Query Parameters:**
- `status`: Filter by ticket status
- `county`: Filter by county
- `limit`: Number of results (default 50, max 200)
- `offset`: Pagination offset

**Response Format:**
```json
{
  "tickets": [
    {
      "id": "uuid-string",
      "work_order_ref": "WO-2024-001",
      "company": "ABC Excavation",
      "city": "Austin",
      "county": "Travis", 
      "status": "ReadyToDig",
      "earliest_lawful_start": "2025-09-04T00:00:00Z",
      "expires_at": "2025-09-18T23:59:59Z",
      "days_until_start": 4,
      "days_until_expiry": 18,
      "gap_count": 0,
      "updated_at": "2025-08-31T10:30:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### GET /tickets/{ticket_id}

**Purpose:** Get detailed ticket information including audit history
**Authentication:** API key required
**Parameters:** ticket_id (path)
**Response:** Complete ticket data with submit packet, geometry, and audit trail

**Response Format:**
```json
{
  "ticket": {
    "id": "uuid-string",
    "status": "ReadyToDig",
    "submit_packet": {...},
    "geometry": {...},
    "dates": {...},
    "validation": {...},
    "audit_history": [
      {
        "timestamp": "2025-08-31T10:00:00Z",
        "actor": "CustomGPT",
        "action": "created",
        "from_status": null,
        "to_status": "Draft",
        "changed_fields": ["company", "contact_name", "address"]
      }
    ],
    "attachments": []
  }
}
```

### POST /tickets/{ticket_id}/mark-submitted

**Purpose:** Manually mark ticket as submitted to Texas 811
**Authentication:** API key required
**Parameters:** ticket_id (path)
**Response:** Updated ticket status

**Response Format:**
```json
{
  "ticket_id": "uuid-string",
  "status": "Submitted",
  "updated_at": "2025-08-31T11:00:00Z"
}
```

### POST /tickets/{ticket_id}/mark-responses-in

**Purpose:** Mark positive responses received, compute expiration date
**Authentication:** API key required
**Parameters:** ticket_id (path), optional response_date
**Response:** Updated ticket with expiration date

**Request Body (optional):**
```json
{
  "positive_response_date": "2025-09-05T14:30:00Z"
}
```

**Response Format:**
```json
{
  "ticket_id": "uuid-string", 
  "status": "ReadyToDig",
  "positive_response_at": "2025-09-05T14:30:00Z",
  "expires_at": "2025-09-19T23:59:59Z",
  "days_until_expiry": 14
}
```

### POST /tickets/{ticket_id}/cancel

**Purpose:** Cancel ticket at any stage
**Authentication:** API key required
**Parameters:** ticket_id (path), optional reason
**Response:** Updated ticket status

## Common Response Formats

### Error Response
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Ticket has required validation gaps",
    "details": {
      "gaps": [...]
    }
  }
}
```

### Validation Gap Format
```json
{
  "field": "work_area_description",
  "problem": "missing_required",
  "severity": "required",
  "suggested_prompt": "I need a description of the work area. Can you describe where exactly the work will take place (e.g., 'front yard near driveway', 'backyard along fence line')?"
}
```

### Geometry Format
```json
{
  "type": "Polygon",
  "coordinates": [[[lng, lat], [lng, lat], [lng, lat], [lng, lat]]],
  "confidence": 0.9,
  "assumptions": ["Applied 25ft buffer to line", "Assumed ROW placement"],
  "warnings": ["Low confidence on exact boundary placement"]
}
```

## Authentication

All endpoints require API key authentication via header:
```
X-API-Key: your-api-key-here
```

Rate limiting: 100 requests per minute per API key.

## OpenAPI Documentation

FastAPI will auto-generate OpenAPI/Swagger documentation at `/docs` endpoint with interactive testing interface.