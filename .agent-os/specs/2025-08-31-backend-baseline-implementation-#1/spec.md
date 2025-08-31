# Spec Requirements Document

> Spec: Backend Baseline Implementation  
> Created: 2025-08-31
> GitHub Issue: #1
> Status: Planning

## Overview

Implement a backend service that validates Texas 811 ticket inputs through a stateful, multi-turn loop with CustomGPT, produces Texas811-aligned submission packets, computes compliance dates, and tracks lifecycle states. The system will provide iterative validation with GIS/geofence assistance, enabling CustomGPT to guide users through gap resolution until tickets are fully valid and ready for submission.

## User Stories

### Field Operations Manager Story

As a Field Operations Manager, I want to submit work order data from CustomGPT and receive clear validation feedback, so that I can quickly resolve any missing or invalid information and generate compliant Texas 811 tickets.

The workflow begins when CustomGPT extracts data from a PDF work order and sends it to the backend. The backend validates all fields, identifies gaps, and returns specific guidance that CustomGPT uses to prompt me for clarifications. After 1-2 rounds of updates, the ticket becomes valid and I can confirm it for submission. The system generates a Texas811-aligned packet and calculates the earliest lawful start date, ensuring compliance with the 2 business day wait period.

### Compliance Officer Story

As a Compliance Officer, I want to track ticket lifecycle states and validity windows, so that I can ensure all excavation work follows Texas 811 legal requirements and avoid compliance violations.

After tickets are confirmed as ready, I can manually update their status through the dashboard as they progress through submission and response phases. The system automatically calculates the 14-day validity window once positive responses are received, showing countdown timers for both the lawful start date and expiration. All state transitions are recorded in an audit trail for compliance documentation.

### CustomGPT Integration Story

As the CustomGPT system, I want to iteratively validate ticket data with the backend API, so that I can guide users through a conversational gap resolution process and ensure complete, valid submissions.

I send initial extracted fields to create a draft ticket, receive validation results with specific gaps and suggested prompts, then collect user clarifications and re-submit updates using the ticket_id. This loop continues until validation passes, at which point I obtain user confirmation before finalizing the ticket. The backend maintains session state across all my API calls, allowing progressive enhancement of the ticket data.

## Spec Scope

1. **Stateful Validation API** - Create and update tickets with iterative validation, maintaining state across multiple API calls from CustomGPT
2. **GIS Assist & Geofence Builder** - Generate valid geometries from GPS/address with instructions, including confidence scores and assumptions
3. **Compliance Date Calculator** - Compute earliest lawful start (2 business days) and validity windows (14 days), with countdown tracking
4. **Texas811 Submit Packet Generator** - Format validated data into portal-aligned sections ready for manual submission
5. **Lifecycle State Machine** - Track tickets through states from Draft to Expired with manual transitions and audit logging

## Out of Scope

- Texas811 portal automation (no Playwright integration)
- Email ingestion or automated member response processing
- Parcel/ROW overlays or advanced GIS features
- Computer vision or Street View detection
- Bulk locate request processing
- Automated submission to Texas811 (remains manual)

## Expected Deliverable

1. Working API endpoints that CustomGPT can call to create, validate, update, and confirm tickets with <5 average turns to completion
2. Dashboard showing all tickets with status, countdown timers, gap counts, and manual state transition buttons
3. Texas811-compliant submission packets that are obviously hand-keyable into the portal with all required fields populated

## Spec Documentation

- Tasks: @.agent-os/specs/2025-08-31-backend-baseline-implementation-#1/tasks.md
- Technical Specification: @.agent-os/specs/2025-08-31-backend-baseline-implementation-#1/sub-specs/technical-spec.md
- API Specification: @.agent-os/specs/2025-08-31-backend-baseline-implementation-#1/sub-specs/api-spec.md
- Database Schema: @.agent-os/specs/2025-08-31-backend-baseline-implementation-#1/sub-specs/database-schema.md
- Tests Specification: @.agent-os/specs/2025-08-31-backend-baseline-implementation-#1/sub-specs/tests.md