# API Specification

This document defines the API endpoints and contracts for the expanded response tracking system.

> Created: 2025-09-02
> Version: 1.0.0

## New Endpoints

### Submit Member Response

**Endpoint:** `POST /tickets/{ticket_id}/responses/{member_code}`

**Purpose:** Submit or update a response from a specific utility member for a ticket.

**Request:**
```json
{
  "member_name": "AT&T",
  "status": "clear",
  "facilities": "2 telecommunication lines running east-west",
  "comment": "Lines marked with white paint. Safe to dig 5 feet from marks.",
  "user_name": "John Smith"
}
```

**Response (201 Created / 200 OK):**
```json
{
  "success": true,
  "response": {
    "id": 123,
    "ticket_id": 456,
    "member_code": "ATT",
    "member_name": "AT&T",
    "response_date": "2025-09-02T14:30:00Z",
    "status": "clear",
    "facilities": "2 telecommunication lines running east-west",
    "comment": "Lines marked with white paint. Safe to dig 5 feet from marks.",
    "user_name": "John Smith"
  },
  "ticket_status": "in_progress",
  "response_summary": {
    "expected_count": 5,
    "received_count": 3,
    "pending_members": ["ONCOR", "ATMOS"]
  }
}
```

**Error Responses:**
- `404 Not Found` - Ticket does not exist
- `400 Bad Request` - Invalid status value or missing required fields
- `422 Unprocessable Entity` - Data validation errors

### Get Ticket Responses

**Endpoint:** `GET /tickets/{ticket_id}/responses`

**Purpose:** Retrieve all member responses for a specific ticket.

**Response (200 OK):**
```json
{
  "ticket_id": 456,
  "expected_members": [
    {"code": "ATT", "name": "AT&T", "added_at": "2025-09-02T10:00:00Z"},
    {"code": "ONCOR", "name": "Oncor Electric", "added_at": "2025-09-02T10:00:00Z"},
    {"code": "ATMOS", "name": "Atmos Energy", "added_at": "2025-09-02T10:00:00Z"}
  ],
  "responses": [
    {
      "id": 123,
      "member_code": "ATT",
      "member_name": "AT&T",
      "response_date": "2025-09-02T14:30:00Z",
      "status": "clear",
      "facilities": "2 telecommunication lines running east-west",
      "comment": "Lines marked with white paint.",
      "user_name": "John Smith"
    },
    {
      "id": 124,
      "member_code": "ONCOR",
      "member_name": "Oncor Electric",
      "response_date": "2025-09-02T15:45:00Z",
      "status": "not_clear",
      "facilities": "Underground primary electric 15kV",
      "comment": "High voltage lines present. Do not dig.",
      "user_name": "Jane Doe"
    }
  ],
  "summary": {
    "total_expected": 3,
    "total_received": 2,
    "pending_members": [
      {"code": "ATMOS", "name": "Atmos Energy"}
    ],
    "clear_count": 1,
    "not_clear_count": 1
  }
}
```

## Modified Endpoints

### Get Dashboard Tickets

**Endpoint:** `GET /dashboard/tickets`

**Modified Response Fields:**
```json
{
  "tickets": [
    {
      // ... existing fields ...
      "response_status": "in_progress",  // New value option
      "response_summary": {               // New field
        "expected_count": 5,
        "received_count": 3,
        "has_not_clear": true
      }
    }
  ]
}
```

### Get Ticket Detail

**Endpoint:** `GET /dashboard/tickets/{ticket_id}`

**Modified Response Fields:**
```json
{
  // ... existing fields ...
  "expected_members": [
    {"code": "ATT", "name": "AT&T", "added_at": "2025-09-02T10:00:00Z"}
  ],
  "member_responses": [  // New field replacing single response
    {
      "member_code": "ATT",
      "member_name": "AT&T",
      "response_date": "2025-09-02T14:30:00Z",
      "status": "clear",
      "facilities": "2 telecommunication lines",
      "comment": "Marked with white paint",
      "user_name": "John Smith"
    }
  ],
  "response_summary": {  // New field
    "expected_count": 5,
    "received_count": 3,
    "pending_members": ["ONCOR", "ATMOS"],
    "all_clear": false
  }
}
```

## Request/Response Models (Pydantic)

### Request Models

```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum

class ResponseStatus(str, Enum):
    clear = "clear"
    not_clear = "not_clear"

class MemberResponseRequest(BaseModel):
    member_name: str = Field(..., min_length=1, max_length=255)
    status: ResponseStatus
    facilities: Optional[str] = Field(None, max_length=1000)
    comment: Optional[str] = Field(None, max_length=2000)
    user_name: str = Field(..., min_length=1, max_length=255)
```

### Response Models

```python
class MemberInfo(BaseModel):
    code: str
    name: str
    added_at: datetime

class MemberResponseDetail(BaseModel):
    id: int
    member_code: str
    member_name: str
    response_date: datetime
    status: ResponseStatus
    facilities: Optional[str]
    comment: Optional[str]
    user_name: str

class ResponseSummary(BaseModel):
    expected_count: int
    received_count: int
    pending_members: List[str]
    clear_count: int = 0
    not_clear_count: int = 0
    all_clear: bool = False

class TicketResponsesResponse(BaseModel):
    ticket_id: int
    expected_members: List[MemberInfo]
    responses: List[MemberResponseDetail]
    summary: ResponseSummary

class MemberResponseSubmitResponse(BaseModel):
    success: bool
    response: MemberResponseDetail
    ticket_status: str
    response_summary: ResponseSummary
```

## Status Transition Rules

### Ticket Status Updates

The ticket status automatically updates based on response completeness:

```python
def calculate_ticket_status(ticket, responses):
    if not ticket.expected_members:
        # No members list - use legacy logic
        return "responses_in" if responses else ticket.status

    if len(responses) == 0:
        return ticket.status  # Keep current status

    if len(responses) < len(ticket.expected_members):
        return "in_progress"  # Partial responses

    return "responses_in"  # All members responded
```

### Member List Management

When a response is submitted for an unknown member:

```python
def handle_unknown_member(ticket, member_code, member_name):
    if member_code not in [m['code'] for m in ticket.expected_members]:
        ticket.expected_members.append({
            'code': member_code,
            'name': member_name,
            'added_at': datetime.utcnow().isoformat()
        })
```

## Error Handling

### Standard Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid status value",
    "details": {
      "field": "status",
      "value": "maybe",
      "allowed": ["clear", "not_clear"]
    }
  }
}
```

### Error Codes

- `TICKET_NOT_FOUND` - Ticket ID does not exist
- `VALIDATION_ERROR` - Request data validation failed
- `DUPLICATE_RESPONSE` - Response already exists (for upsert logic)
- `DATABASE_ERROR` - Database operation failed

## OpenAPI Documentation

### Tags
- Add new tag: `"Member Responses"` for response-related endpoints

### x-openai-isConsequential Flags
- `POST /tickets/{ticket_id}/responses/{member_code}`: `true` (modifies data)
- `GET /tickets/{ticket_id}/responses`: `false` (read-only)

## Backward Compatibility

### Legacy Response Fields
Continue to populate legacy fields in tickets table for backward compatibility:
- When first response received: Update legacy `response_date`
- When all responses are "clear": Set legacy `response_status` to "positive"
- When any response is "not_clear": Set legacy `response_status` to "conditional"

### API Version Header
Support version header for clients to opt into new response format:
- `X-API-Version: 2` - Use new multi-response format
- No header or `X-API-Version: 1` - Use legacy single response format
