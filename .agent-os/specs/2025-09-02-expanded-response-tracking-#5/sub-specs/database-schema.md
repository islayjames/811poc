# Database Schema Specification

This document defines the database schema changes required for the expanded response tracking system.

> Created: 2025-09-02
> Version: 1.0.0

## Schema Changes Overview

### Modified Tables
- `tickets` - Add expected_members JSONB field

### New Tables
- `member_responses` - Store individual utility member responses

## Detailed Schema

### tickets (modifications)

Add new column to existing tickets table:

```sql
ALTER TABLE tickets ADD COLUMN expected_members JSONB;
```

**expected_members JSONB Structure:**
```json
[
  {
    "code": "ATT",
    "name": "AT&T",
    "added_at": "2025-09-02T10:00:00Z"
  },
  {
    "code": "ONCOR",
    "name": "Oncor Electric",
    "added_at": "2025-09-02T10:00:00Z"
  }
]
```

### member_responses (new table)

```sql
CREATE TABLE member_responses (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    member_code VARCHAR(50) NOT NULL,
    member_name VARCHAR(255) NOT NULL,
    response_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('clear', 'not_clear')),
    facilities TEXT,
    comment TEXT,
    user_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(ticket_id, member_code)
);

CREATE INDEX idx_member_responses_ticket_id ON member_responses(ticket_id);
CREATE INDEX idx_member_responses_member_code ON member_responses(member_code);
CREATE INDEX idx_member_responses_response_date ON member_responses(response_date);
```

## Data Relationships

### One-to-Many: Ticket to Responses
- One ticket can have multiple member_responses
- Each response is uniquely identified by (ticket_id, member_code)
- Cascade delete ensures responses are removed when ticket is deleted

### Member Management
- Members are stored per-ticket in the expected_members JSONB field
- No global member list table (future enhancement)
- Dynamic member addition supported when unexpected utilities respond

## Migration Strategy

### Step 1: Add expected_members to tickets
```sql
ALTER TABLE tickets
ADD COLUMN expected_members JSONB DEFAULT '[]'::jsonb;
```

### Step 2: Create member_responses table
```sql
CREATE TABLE member_responses (
    -- table definition as above
);
```

### Step 3: Migrate existing response data (if applicable)
```sql
-- If there's existing response data in tickets table, migrate it
INSERT INTO member_responses (ticket_id, member_code, member_name, response_date, status, comment, user_name)
SELECT
    id,
    'LEGACY',
    'Legacy Response',
    response_date,
    CASE
        WHEN response_status = 'positive' THEN 'clear'
        ELSE 'not_clear'
    END,
    response_comments,
    'System Migration'
FROM tickets
WHERE response_date IS NOT NULL;
```

## Indexes and Performance

### Recommended Indexes
- `ticket_id` - For fast response retrieval by ticket
- `member_code` - For searching responses by utility
- `response_date` - For chronological sorting and filtering
- Unique constraint on (ticket_id, member_code) prevents duplicates

### Query Patterns
1. **Get all responses for a ticket:**
```sql
SELECT * FROM member_responses
WHERE ticket_id = $1
ORDER BY response_date;
```

2. **Check if member has responded:**
```sql
SELECT EXISTS(
    SELECT 1 FROM member_responses
    WHERE ticket_id = $1 AND member_code = $2
);
```

3. **Count responses vs expected:**
```sql
SELECT
    t.id,
    jsonb_array_length(t.expected_members) as expected_count,
    COUNT(r.id) as response_count
FROM tickets t
LEFT JOIN member_responses r ON t.id = r.ticket_id
WHERE t.id = $1
GROUP BY t.id;
```

## Data Integrity Rules

### Constraints
- `member_code` cannot be null or empty
- `status` must be either 'clear' or 'not_clear'
- `response_date` automatically set to current timestamp
- Unique constraint prevents duplicate responses from same member

### Business Rules (Application Layer)
- When a response is submitted for an unknown member, add to expected_members
- Update ticket status based on response completeness
- Maintain audit log of all response submissions
- Allow updates to existing responses (upsert pattern)

## Backward Compatibility

### Existing Systems
- Legacy single-response fields remain in tickets table
- Dashboard can display both old and new response formats
- API maintains backward compatibility for single response updates

### Migration Path
1. Deploy schema changes without removing old fields
2. Update application to write to both old and new structures
3. Migrate historical data to new structure
4. Deprecate old fields in future release

## Future Enhancements

### Potential Schema Extensions
- Global members table with county-based defaults
- Response attachments table for supporting documents
- Response history table for audit trail
- Member contact information storage
