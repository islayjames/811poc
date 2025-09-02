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
