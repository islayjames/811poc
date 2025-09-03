# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-03-ticket-sync-script/spec.md

> Created: 2025-09-03
> Version: 1.0.0

## Technical Requirements

- Parse JSON file from scraper output at `scrape/texas811-all-tickets-2025-09-03.json`
- Transform data fields to match API schema requirements
- Handle date/time parsing from various formats (e.g., "September 02, 2025, 4:20 PM")
- Convert work duration strings to integer days (e.g., "1 Day" → 1, "3 MONTHS" → 90)
- Generate unique session IDs for API tracking
- Implement retry logic for failed API calls
- Provide detailed logging of sync operations

## Approach Options

**Option A:** Simple Sequential Processing (Selected)
- Pros: Easy to implement, clear error tracking, simple debugging, lightweight
- Cons: Slower for large datasets, no parallelization

**Option B:** Batch Processing with Async
- Pros: Faster processing, efficient API usage, better performance
- Cons: More complex error handling, harder to debug, overkill for tool

**Rationale:** Simple sequential processing is sufficient for this lightweight sync tool. The scraper output typically contains 20-50 tickets, which processes quickly sequentially without the complexity of async operations.

## External Dependencies

- **requests** - Simple HTTP client for API calls
- **Justification:** Simpler than httpx for sequential processing, already likely installed
- **python-dateutil** - Flexible date parsing
- **Justification:** Handles various date formats from scraper

## Implementation Details

### Data Transformations

1. **Date Parsing:**
   - Use dateutil.parser for flexible parsing
   - Handle formats like "September 02, 2025, 4:20 PM"
   - Convert to ISO format for API

2. **Duration Conversion:**
   - Parse strings like "1 Day", "3 weeks", "2 MONTHS"
   - Convert to integer days
   - Default to 14 days if unparseable

3. **Field Mappings:**
   - Map scraper fields directly where names match
   - Store original ticket_id as external_ref or in remarks
   - Generate session_id as f"sync_{timestamp}_{ticket_id}"

4. **GPS Coordinate Handling:**
   - Skip invalid coordinates (lat: 2, lng: 2025)
   - Only include if values are within valid ranges

### API Integration

1. **Check Ticket Existence:**
   - GET /tickets with query by external_ref
   - Cache results to avoid duplicate checks

2. **Create/Update Logic:**
   - If not exists: POST /tickets/create
   - If exists: POST /tickets/{id}/update with full data

3. **Response Sync:**
   - Extract responses from ticket data
   - POST /tickets/{id}/responses/{member} for each

### Error Handling

1. **Validation Errors:**
   - Log error and continue
   - Count failures for summary

2. **API Errors:**
   - Single retry on timeout
   - Log failure and continue
   - Don't halt on individual failures

3. **Data Errors:**
   - Skip malformed tickets
   - Log and continue
