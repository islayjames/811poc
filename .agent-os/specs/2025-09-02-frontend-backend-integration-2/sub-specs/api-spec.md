# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-02-frontend-backend-integration-2/spec.md

> Created: 2025-09-02
> Version: 1.0.0

## Endpoints

### GET /api/tickets
**Purpose:** Retrieve list of all tickets for dashboard display
**Frontend Usage:** Replace mock data in tickets list page
**Request:** No parameters
**Response:** Array of ticket objects with id, status, address, created_at, lawful_start_date

### GET /api/tickets/{id}
**Purpose:** Retrieve single ticket details
**Frontend Usage:** Replace mock data in ticket detail page
**Request:** Path parameter - ticket ID
**Response:** Full ticket object with all fields

### POST /api/tickets
**Purpose:** Create new ticket from form submission
**Frontend Usage:** Replace mock ticket creation in form submission
**Request Body:** Ticket data from form inputs
**Response:** Created ticket object with generated ID

### POST /api/tickets/{id}/validate
**Purpose:** Validate ticket data and get enrichment feedback
**Frontend Usage:** Replace mock validation in form validation workflow
**Request:** Path parameter - ticket ID, Body - partial ticket data
**Response:** Validation result with errors/suggestions/enriched data

### PATCH /api/tickets/{id}
**Purpose:** Update ticket status or fields
**Frontend Usage:** Replace mock status updates in status change components
**Request:** Path parameter - ticket ID, Body - fields to update
**Response:** Updated ticket object

## Controllers

### TicketsController
- Handles all ticket CRUD operations
- Provides validation and enrichment services
- Manages ticket lifecycle state transitions
- Returns standardized JSON responses matching frontend expectations

### ValidationController
- Processes validation requests with detailed feedback
- Provides field-specific error messages and suggestions
- Handles iterative validation workflow
- Returns structured validation results for UI display

## Response Format Standards

### Success Responses
All successful API responses follow existing frontend data structure expectations:
- Consistent field naming (snake_case from API, camelCase in frontend)
- Standard timestamp formats (ISO 8601)
- Predictable nested object structures

### Error Responses
Error responses match existing frontend error handling patterns:
- HTTP status codes (400, 404, 422, 500)
- JSON error objects with message and details fields
- Field-specific validation errors in predictable format

## API Client Configuration

### Base Configuration
- Base URL: `http://localhost:8000`
- Content-Type: `application/json`
- Accept: `application/json`
- Timeout: 30 seconds

### Error Handling
- Network errors mapped to user-friendly messages
- HTTP error codes handled by existing UI error states
- Retry logic for transient failures (optional, if existing)
