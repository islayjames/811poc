# API Endpoints Documentation

## Overview

The Texas 811 POC backend provides RESTful API endpoints for ticket validation, parcel enrichment, and lifecycle management. All endpoints return standardized JSON responses with comprehensive error handling.

## Base URL

- **Development**: `http://localhost:8000`
- **Production**: `https://[your-railway-domain].railway.app`

## Authentication

All API endpoints require API key authentication via the `Authorization` header:

```bash
Authorization: Bearer YOUR_API_KEY
```

## Core API Response Format

All successful responses follow this structure:

```json
{
  "success": true,
  "timestamp": "2025-09-02T10:35:00Z",
  "request_id": "uuid-v4-string",
  "data": { /* endpoint-specific data */ }
}
```

Error responses:

```json
{
  "success": false,
  "timestamp": "2025-09-02T10:35:00Z",
  "request_id": "uuid-v4-string",
  "error": "Error description",
  "details": { /* additional error context */ }
}
```

## Ticket Management Endpoints

### POST /tickets/create

Create a new ticket with automatic validation and parcel enrichment.

**Request Body:**
```json
{
  "session_id": "string",
  "county": "string",
  "city": "string",
  "address": "string",
  "work_description": "string",
  "gps_lat": 29.7604,  // optional
  "gps_lng": -95.3698  // optional
}
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-09-02T10:35:00Z",
  "request_id": "uuid",
  "ticket_id": "generated-uuid",
  "validation_status": "valid|invalid|needs_review",
  "missing_fields": ["field1", "field2"],
  "suggestions": {
    "field_name": "suggested_value"
  },
  "parcel_info": {
    "subdivision": "DOWNTOWN HOUSTON",
    "lot": "12",
    "block": "A",
    "parcel_id": "ABC123456789",
    "owner": "Property Owner Name",
    "address": "1234 Main St, Houston, TX 77002",
    "feature_found": true,
    "matched_count": 1,
    "enrichment_attempted": true,
    "enrichment_timestamp": "2025-09-02T10:35:00Z",
    "source_county": "Harris",
    "arcgis_url": "https://reportall-usa-api.com/..."
  },
  "geocoded_location": {
    "lat": 29.7604,
    "lng": -95.3698,
    "confidence": 0.95
  }
}
```

### POST /tickets/update

Update an existing ticket with re-validation and parcel enrichment.

**Request Body:**
```json
{
  "ticket_id": "uuid",
  "session_id": "string",
  "county": "string",
  "city": "string",
  "address": "string",
  "work_description": "string",
  "gps_lat": 29.7604,
  "gps_lng": -95.3698
}
```

**Response:** Same structure as `/tickets/create`

### POST /tickets/confirm

Confirm a ticket for submission after validation is complete.

**Request Body:**
```json
{
  "ticket_id": "uuid",
  "session_id": "string"
}
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-09-02T10:35:00Z",
  "request_id": "uuid",
  "ticket_id": "uuid",
  "status": "confirmed",
  "submission_ready": true,
  "lawful_start_date": "2025-09-04T08:00:00Z",
  "marking_deadline": "2025-09-18T17:00:00Z"
}
```


## Response Tracking Endpoints

The response tracking endpoints allow utility members to submit their responses (clear/not clear) to locate tickets and retrieve comprehensive response information.

**Key Features**:
- Supports multiple utility member responses per ticket
- Automatic status progression: submitted → in_progress → responses_in
- Dynamic member addition when unknown utilities respond
- Case-insensitive member code handling
- Upsert behavior for response updates

### POST /tickets/{ticket_id}/responses/{member_code}

Submit or update a utility member response to a ticket.

**Purpose**: Allows utility members to submit their responses (clear/not clear) to locate tickets. Supports upsert behavior and automatic member management.

**Path Parameters:**
- `ticket_id` (string, required): Unique ticket identifier
- `member_code` (string, required): Short code identifying the utility member (case-insensitive)

**Request Body:**
```json
{
  "member_name": "Texas Gas Service",
  "status": "clear",
  "user_name": "john.doe@texasgas.com",
  "facilities": "No facilities in work area",
  "comment": "All clear for excavation"
}
```

**Request Fields:**
- `member_name` (string, required): Name of utility member providing response
- `status` (string, required): Response status - either "clear" or "not_clear"
- `user_name` (string, required): Name/email of user submitting response
- `facilities` (string, optional): Description of facilities in work area
- `comment` (string, optional): Additional comments or instructions

**Response (201 Created or 200 OK):**
```json
{
  "success": true,
  "timestamp": "2025-09-02T10:35:00Z",
  "request_id": "uuid-v4-string",
  "data": {
    "response_id": "generated-uuid",
    "ticket_id": "original-ticket-id",
    "member_code": "TGS",
    "member_name": "Texas Gas Service",
    "status": "clear",
    "user_name": "john.doe@texasgas.com",
    "facilities": "No facilities in work area",
    "comment": "All clear for excavation",
    "created_at": "2025-09-02T10:35:00Z",
    "updated_at": "2025-09-02T10:35:00Z",
    "ticket_status_updated": true,
    "new_ticket_status": "responses_in"
  }
}
```

**Status Progression Logic:**
- When first response is submitted: ticket status changes from "submitted" to "in_progress"
- When all expected members have responded: ticket status changes to "responses_in"
- Unknown members are automatically added to expected_members list

**Error Responses:**
- `404 Not Found`: Ticket not found
- `400 Bad Request`: Invalid request data
- `422 Unprocessable Entity`: Validation error (invalid status value, etc.)

### GET /tickets/{ticket_id}/responses

Retrieve all member responses for a ticket with summary statistics.

**Purpose**: Get comprehensive response information including expected members, received responses, and summary statistics.

**Path Parameters:**
- `ticket_id` (string, required): Unique ticket identifier

**Response (200 OK):**
```json
{
  "success": true,
  "timestamp": "2025-09-02T10:35:00Z",
  "request_id": "uuid-v4-string",
  "data": {
    "ticket_id": "original-ticket-id",
    "expected_members": [
      {
        "code": "TGS",
        "name": "Texas Gas Service",
        "contact": "811@texasgas.com"
      },
      {
        "code": "CEP",
        "name": "CenterPoint Energy",
        "contact": "locates@centerpointenergy.com"
      }
    ],
    "responses": [
      {
        "response_id": "response-uuid-1",
        "member_code": "TGS",
        "member_name": "Texas Gas Service",
        "status": "clear",
        "user_name": "john.doe@texasgas.com",
        "facilities": "No facilities in work area",
        "comment": "All clear for excavation",
        "created_at": "2025-09-02T10:35:00Z",
        "updated_at": "2025-09-02T10:35:00Z"
      },
      {
        "response_id": "response-uuid-2",
        "member_code": "CEP",
        "member_name": "CenterPoint Energy",
        "status": "not_clear",
        "user_name": "jane.smith@centerpointenergy.com",
        "facilities": "Underground electric lines present",
        "comment": "Call before digging - lines marked",
        "created_at": "2025-09-02T11:15:00Z",
        "updated_at": "2025-09-02T11:15:00Z"
      }
    ],
    "summary": {
      "ticket_id": "original-ticket-id",
      "total_expected": 2,
      "total_received": 2,
      "clear_count": 1,
      "not_clear_count": 1,
      "pending_members": [],
      "is_complete": true,
      "all_clear": false,
      "completion_percentage": 100.0
    }
  }
}
```

**Response Fields:**
- `expected_members`: List of utility members expected to respond based on ticket location
- `responses`: All responses received, sorted by response date (most recent first)
- `summary`: Aggregate statistics and completion status
  - `total_expected`: Number of expected responses
  - `total_received`: Number of responses actually received
  - `clear_count`: Number of "clear" responses
  - `not_clear_count`: Number of "not clear" responses
  - `pending_members`: List of members who haven't responded yet
  - `is_complete`: Whether all expected members have responded
  - `all_clear`: Whether all responses are "clear" status
  - `completion_percentage`: Percentage of expected responses received

**Error Responses:**
- `404 Not Found`: Ticket not found

**Notes:**
- Member codes are normalized to uppercase for consistency
- Unknown members submitting responses are automatically added to expected_members
- Response timestamps use UTC timezone
- Responses support upsert behavior - submitting for same member_code updates existing response

## Dashboard Endpoints

The dashboard endpoints provide ticket management and tracking functionality for compliance officers and field managers.

### GET /dashboard/tickets

Get list of tickets with filtering and pagination.

**Purpose**: Retrieve tickets with various filters for dashboard display.

**Query Parameters:**
- `status` (string, optional): Filter by ticket status
- `county` (string, optional): Filter by county
- `city` (string, optional): Filter by city
- `created_since` (string, optional): Filter by creation date (ISO format)
- `updated_since` (string, optional): Filter by update date (ISO format)
- `limit` (integer, optional): Maximum number of tickets to return (1-100, default: 50)
- `offset` (integer, optional): Number of tickets to skip for pagination (default: 0)

**Response (200 OK):**
```json
{
  "tickets": [
    {
      "ticket_id": "5C7T",
      "session_id": "2574458426",
      "status": "responses_in",
      "county": "MONTGOMERY",
      "city": "NEW CANEY",
      "address": "CROSS PINES DR",
      "cross_street": "THE TRAILS DR",
      "work_description": "Replace-Pole",
      "caller_name": "TRAVIS PARTEN",
      "caller_phone": "(979) 997-2171",
      "excavator_company": "BRIGHT STAR SOLUTIONS",
      "work_start_date": "2025-09-04",
      "lawful_start_date": "2025-09-04",
      "ticket_expires_date": "2025-09-18",
      "expected_members": [
        {
          "member_code": "TGC",
          "member_name": "Kinder Morgan",
          "is_active": true
        }
      ],
      "created_at": "2025-09-03T17:59:28.747349Z",
      "updated_at": "2025-09-03T17:59:28.775903Z"
    }
  ],
  "total_count": 17,
  "page": 1,
  "page_size": 50
}
```

### GET /dashboard/tickets/{ticket_id}

Get detailed ticket information with audit history and countdown info.

**Path Parameters:**
- `ticket_id` (string, required): Unique ticket identifier

**Response (200 OK):**
```json
{
  "ticket_id": "5C7T",
  "session_id": "2574458426",
  "status": "responses_in",
  "county": "MONTGOMERY",
  "city": "NEW CANEY",
  "address": "CROSS PINES DR",
  "work_description": "Replace-Pole",
  "audit_history": [
    {
      "timestamp": "2025-09-03T17:59:28.747349Z",
      "action": "ticket_created",
      "user": "sync-import",
      "details": {}
    },
    {
      "timestamp": "2025-09-03T19:43:17.126283Z",
      "action": "responses_received",
      "user": "system",
      "details": {"member_code": "TGC"}
    }
  ],
  "countdown_info": {
    "days_until_start": 1,
    "days_until_expiry": 15,
    "days_until_marking_expiry": 14,
    "can_start_today": false,
    "can_start_work": false,
    "markings_valid": true,
    "is_expired": false,
    "is_urgent": true,
    "requires_action": false,
    "action_required": null,
    "status_description": "Responses received - markings valid (15 days remaining)"
  },
  "responses": [
    {
      "response_id": "uuid",
      "member_code": "TGC",
      "member_name": "Kinder Morgan - Tennessee Gas Pipeline",
      "status": "not_clear",
      "user_name": "kindermorgan.pr",
      "facilities": "Gas",
      "comment": "In Conflict",
      "created_at": "2025-09-02T14:54:00Z"
    }
  ]
}
```

### POST /dashboard/tickets/{ticket_id}/mark-submitted

Mark a ticket as submitted to Texas 811.

**Path Parameters:**
- `ticket_id` (string, required): Unique ticket identifier

**Request Body:**
```json
{
  "submission_ticket_number": "2024123456",  // optional
  "notes": "Submitted via portal"           // optional
}
```

**Response (200 OK):**
```json
{
  "ticket_id": "5C7T",
  "status": "submitted",
  "submitted_at": "2025-09-03T10:35:00Z",
  "submission_ticket_number": "2024123456",
  "message": "Ticket marked as submitted successfully"
}
```

### POST /dashboard/tickets/{ticket_id}/mark-responses-in

Mark that all expected responses have been received.

**Path Parameters:**
- `ticket_id` (string, required): Unique ticket identifier

**Request Body:**
```json
{
  "notes": "All utilities have responded"  // optional
}
```

**Response (200 OK):**
```json
{
  "ticket_id": "5C7T",
  "status": "responses_in",
  "responses_marked_at": "2025-09-03T10:35:00Z",
  "message": "Ticket marked as responses received"
}
```

### DELETE /dashboard/tickets/{ticket_id}

Cancel or delete a ticket.

**Path Parameters:**
- `ticket_id` (string, required): Unique ticket identifier

**Response (200 OK):**
```json
{
  "ticket_id": "5C7T",
  "status": "cancelled",
  "message": "Ticket cancelled successfully"
}
```

### GET /dashboard/tickets/{ticket_id}/responses

Get all responses for a specific ticket.

**Path Parameters:**
- `ticket_id` (string, required): Unique ticket identifier

**Response (200 OK):**
```json
{
  "ticket_id": "5C7T",
  "responses": [
    {
      "response_id": "uuid",
      "member_code": "TGC",
      "member_name": "Kinder Morgan - Tennessee Gas Pipeline",
      "status": "not_clear",
      "user_name": "kindermorgan.pr",
      "facilities": "Gas",
      "comment": "In Conflict",
      "created_at": "2025-09-02T14:54:00Z",
      "updated_at": "2025-09-02T14:54:00Z"
    },
    {
      "response_id": "uuid",
      "member_code": "ETX01",
      "member_name": "Entergy Texas Inc",
      "status": "clear",
      "user_name": "digtix.pr",
      "facilities": "Electric",
      "comment": "Bradley Moore: clear",
      "created_at": "2025-09-02T19:05:00Z",
      "updated_at": "2025-09-02T19:05:00Z"
    }
  ],
  "total_responses": 2,
  "clear_count": 1,
  "not_clear_count": 1
}
```

## Parcel Enrichment Endpoint

### POST /parcels/enrich

**Purpose**: Enrich location data with detailed parcel information and detect discrepancies between address and GPS coordinates.

**Key Features**:
- Accepts address, GPS coordinates, or both
- Provides comprehensive comparison analysis when both inputs are provided
- Returns property owner information and legal descriptions
- Calculates distance metrics for discrepancy detection
- Works with all US counties via ReportAll USA API

**Request Body:**
```json
{
  "address": "1234 Main St, Houston, TX 77002",  // optional if GPS provided
  "gps_lat": 29.7604,                           // optional if address provided
  "gps_lng": -95.3698,                          // optional if address provided
  "county": "Harris"                            // optional, helps with geocoding
}
```

**Validation Rules:**
- Must provide either `address` OR both `gps_lat` and `gps_lng`
- Can provide both address and GPS coordinates for comparison
- GPS coordinates must be valid latitude/longitude values
- County is optional but recommended for better geocoding accuracy

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-09-02T10:35:00Z",
  "request_id": "uuid",
  "address_provided": "1234 Main St, Houston, TX 77002",
  "gps_provided": {
    "lat": 29.7604,
    "lng": -95.3698
  },
  "address_enrichment": {
    "geocoded_location": {
      "lat": 29.7598,
      "lng": -95.3702
    },
    "geocoding_confidence": 0.92,
    "coordinates_used": {
      "lat": 29.7598,
      "lng": -95.3702
    },
    "parcel_info": {
      "subdivision": "DOWNTOWN HOUSTON",
      "lot": "12",
      "block": "A",
      "parcel_id": "123-456-789-001",
      "owner": "ABC PROPERTY MANAGEMENT LLC",
      "address": "1234 MAIN ST, HOUSTON, TX 77002",
      "feature_found": true,
      "matched_count": 1,
      "enrichment_attempted": true,
      "enrichment_timestamp": "2025-09-02T10:35:00Z",
      "source_county": "Harris",
      "arcgis_url": "https://reportall-usa-api.com/..."
    }
  },
  "gps_enrichment": {
    "geocoded_location": null,
    "geocoding_confidence": null,
    "coordinates_used": {
      "lat": 29.7604,
      "lng": -95.3698
    },
    "parcel_info": {
      "subdivision": "DOWNTOWN HOUSTON",
      "lot": "12",
      "block": "A",
      "parcel_id": "123-456-789-001",
      "owner": "ABC PROPERTY MANAGEMENT LLC",
      "address": "1234 MAIN ST, HOUSTON, TX 77002",
      "feature_found": true,
      "matched_count": 1,
      "enrichment_attempted": true,
      "enrichment_timestamp": "2025-09-02T10:35:00Z",
      "source_county": "Harris",
      "arcgis_url": "https://reportall-usa-api.com/..."
    }
  },
  "comparison": {
    "both_provided": true,
    "parcel_id_match": true,
    "owner_match": true,
    "address_match": true,
    "distance_meters": 65.8,
    "same_parcel": true
  }
}
```

**Comparison Analysis Fields:**

- **both_provided**: Boolean indicating if both address and GPS were provided
- **parcel_id_match**: Whether parcel IDs match between address and GPS results
- **owner_match**: Whether property owners match between results
- **address_match**: Whether property addresses match between results
- **distance_meters**: Physical distance between geocoded address and GPS coordinates
- **same_parcel**: Overall assessment of whether results represent the same parcel

**Use Cases:**

1. **Address Validation**: Verify that a work order address is accurate
   ```json
   {"address": "123 Main St, Houston, TX"}
   ```

2. **GPS Validation**: Enrich GPS coordinates with property information
   ```json
   {"gps_lat": 29.7604, "gps_lng": -95.3698}
   ```

3. **Discrepancy Detection**: Compare address vs GPS coordinates for consistency
   ```json
   {
     "address": "123 Main St, Houston, TX",
     "gps_lat": 29.7604,
     "gps_lng": -95.3698
   }
   ```

**Error Scenarios:**

- **Invalid coordinates**: GPS coordinates outside valid ranges
- **Geocoding failure**: Address cannot be geocoded to coordinates
- **No parcel data**: No parcel information found at location
- **Service unavailable**: ReportAll USA API temporarily unavailable

All error scenarios return appropriate HTTP status codes with descriptive error messages.

## ReportAll USA Integration

### Data Quality and Coverage

**Nationwide Coverage**: ReportAll USA provides parcel data for all US counties through a single API endpoint, replacing the need for county-specific integrations.

**Data Fields Available**:
- **Property Identification**: Parcel ID, subdivision, lot, block
- **Owner Information**: Property owner name and contact details
- **Location Data**: Property address, legal descriptions
- **GIS Metadata**: Data source, confidence scores, timestamps

**Reliability Features**:
- **Automatic Retries**: 3 retry attempts with exponential backoff
- **Timeout Handling**: 5-second request timeout prevents hanging
- **Graceful Degradation**: System continues if GIS service is unavailable
- **Comprehensive Logging**: All requests and responses logged for debugging

### Performance Characteristics

- **Response Time**: < 100ms typical response time
- **Availability**: 99.9% uptime through robust error handling
- **Scalability**: Async implementation supports concurrent requests
- **Caching**: Session-based caching reduces redundant API calls

## Error Handling

### HTTP Status Codes

- **200 OK**: Successful request with data
- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Missing or invalid API key
- **404 Not Found**: Requested resource not found
- **422 Unprocessable Entity**: Valid request format but invalid data
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side error
- **503 Service Unavailable**: External service (ReportAll USA) unavailable

### Error Response Format

```json
{
  "success": false,
  "timestamp": "2025-09-02T10:35:00Z",
  "request_id": "uuid",
  "error": "Brief error description",
  "details": {
    "field_name": ["Specific validation error"],
    "error_code": "VALIDATION_ERROR",
    "retry_after": 60  // seconds, for rate limiting
  }
}
```

### Common Error Scenarios

**Validation Errors (422)**:
```json
{
  "error": "Validation failed",
  "details": {
    "address": ["Address is required when GPS coordinates not provided"],
    "gps_lat": ["Must be between -90.0 and 90.0"]
  }
}
```

**Service Unavailable (503)**:
```json
{
  "error": "GIS service temporarily unavailable",
  "details": {
    "service": "ReportAll USA API",
    "retry_after": 30,
    "fallback_available": false
  }
}
```

## Rate Limiting

- **Default Limit**: 100 requests per minute per API key
- **Burst Allowance**: Up to 10 requests in 10-second window
- **Headers**: Rate limit status included in response headers
- **Exceeded Response**: 429 status with retry-after header

## Development and Testing

### Local Development

Start the development server:
```bash
uvicorn texas811_poc.api_endpoints:app --reload --port 8000
```

Access interactive API documentation at `http://localhost:8000/docs`

### Testing Examples

**Create Ticket with cURL**:
```bash
curl -X POST "http://localhost:8000/tickets/create" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session",
    "county": "Harris",
    "city": "Houston",
    "address": "1234 Main St, Houston, TX 77002",
    "work_description": "Fiber optic cable installation"
  }'
```

**Parcel Enrichment with cURL**:
```bash
curl -X POST "http://localhost:8000/parcels/enrich" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "1234 Main St, Houston, TX 77002",
    "gps_lat": 29.7604,
    "gps_lng": -95.3698,
    "county": "Harris"
  }'
```

### API Client Libraries

The API is compatible with standard HTTP clients in all programming languages. OpenAPI/Swagger specification available at `/docs` endpoint for automatic client generation.

---

**Last Updated**: September 2, 2025
**API Version**: 1.0.0
**ReportAll USA Integration**: Production Ready
