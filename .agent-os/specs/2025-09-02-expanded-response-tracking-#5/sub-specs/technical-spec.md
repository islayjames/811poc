# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-02-expanded-response-tracking-#5/spec.md

> Created: 2025-09-02
> Version: 1.0.0

## Technical Requirements

### Data Model Requirements
- Support multiple utility members per ticket (1:N relationship)
- Support one response per member per ticket (1:1 relationship between member and response)
- Track response metadata including user, timestamp, and status
- Maintain audit trail of all response submissions
- Enable dynamic member addition when unknown utilities respond

### UI/UX Requirements
- Display response checklist/table in ticket detail view
- Show member code, name, and facilities in response table
- Visual indicators for Clear/Not Clear status (green/red badges)
- Sort responses by date received
- Show count of responses received vs expected (e.g., "3 of 5 responses received")

### Integration Requirements
- New REST endpoint for individual response submission
- Update existing dashboard endpoints to include response data
- Modify ticket status logic to support "in_progress" state
- Ensure backward compatibility with existing single response system

### Performance Requirements
- Response submission < 500ms
- Response list retrieval < 200ms for up to 20 members
- Real-time status updates without page refresh

## Approach Options

**Option A: Separate Members and Responses Tables**
- Pros:
  - Clean separation of concerns
  - Easy to track expected vs received
  - Supports member reuse across tickets
- Cons:
  - More complex queries
  - Additional joins required

**Option B: Single Responses Table with Member Data** (Selected)
- Pros:
  - Simpler schema
  - Fewer joins needed
  - Direct member-response relationship
- Cons:
  - Some data duplication
  - Member info repeated per response

**Rationale:** Option B selected for simplicity and performance. Since members are per-ticket and we're not maintaining a global member list, embedding member data in responses is more straightforward.

## External Dependencies

None required - this feature uses existing technology stack:
- FastAPI for new endpoints
- PostgreSQL for data storage
- React for UI components
- Existing authentication/authorization

## Implementation Considerations

### Status Transition Logic
```python
def calculate_ticket_status(ticket, responses):
    if not ticket.expected_members:
        # No members list - use old logic
        return "responses_in" if responses else ticket.status

    if len(responses) == 0:
        return ticket.status  # Keep current status

    if len(responses) < len(ticket.expected_members):
        return "in_progress"  # Partial responses

    return "responses_in"  # All responded
```

### Response Uniqueness
- Enforce unique constraint on (ticket_id, member_code)
- Allow updates to existing responses
- Track response history in audit log

### Member Management
- Members stored as JSONB array on ticket
- Each member has: code, name, added_at timestamp
- Dynamic addition when new utility responds
