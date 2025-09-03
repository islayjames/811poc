# Spec Requirements Document

> Spec: Expanded Response Tracking System
> Created: 2025-09-02
> GitHub Issue: #5
> Status: Planning

## Overview

Implement a comprehensive utility response tracking system that allows multiple responses per ticket, with each response tied to a specific utility member. This feature will provide detailed tracking of which utilities have responded, their response status, and enable proper status progression based on response completeness.

## User Stories

### Compliance Officer Response Management

As a compliance officer, I want to track individual utility company responses, so that I can ensure all required utilities have marked their facilities before excavation begins.

When a utility company responds to a locate request, I need to record their specific response details including whether their facilities are clear or not clear, any comments they provide, and which facilities are affected. The system should automatically track which utilities have responded and update the ticket status appropriately - setting it to "in_progress" when we have partial responses and "responses_in" only when all expected utilities have responded.

### Field Supervisor Response Visibility

As a field supervisor, I want to see a clear checklist of utility responses, so that I know which utilities have cleared the work area and which are still pending.

The dashboard should display a table showing each expected utility member with their response status, including the utility code, name, response date, clear/not clear status, and any facilities they've identified. This allows me to quickly assess whether it's safe to begin work based on which utilities have responded and their clearance status.

## Spec Scope

1. **Member List Management** - Per-ticket tracking of expected utility companies with code and name fields
2. **Multiple Response Handling** - Support for one response per utility member per ticket
3. **Dynamic Member Addition** - Automatically add new members when unexpected utilities respond
4. **Status Progression Logic** - Automatic status updates based on response completeness (in_progress for partial, responses_in for complete)
5. **Response Data Model** - Comprehensive response fields including Code, Name, Date, Status, Comment, User, and Facilities

## Out of Scope

- Global member list management (future enhancement)
- County-based member defaults
- Automated response import from email or API
- Response timeout handling
- Bulk response operations

## Expected Deliverable

1. Database tables for members and responses with proper relationships to tickets
2. API endpoint `/tickets/{id}/responses/{member_code}` for submitting individual utility responses
3. Dashboard response table showing all utility responses with their status and details

## Spec Documentation

- Tasks: @.agent-os/specs/2025-09-02-expanded-response-tracking-#5/tasks.md
- Technical Specification: @.agent-os/specs/2025-09-02-expanded-response-tracking-#5/sub-specs/technical-spec.md
- Database Schema: @.agent-os/specs/2025-09-02-expanded-response-tracking-#5/sub-specs/database-schema.md
- API Specification: @.agent-os/specs/2025-09-02-expanded-response-tracking-#5/sub-specs/api-spec.md
- Tests Specification: @.agent-os/specs/2025-09-02-expanded-response-tracking-#5/sub-specs/tests.md
