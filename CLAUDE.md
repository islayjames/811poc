# CLAUDE.md - Texas811 POC Project Configuration

**Project**: Texas811 POC - Backend-First One-Call Ticket Automation  
**Extends**: ~/.CLAUDE.md (Global AI-Augmented Development Configuration)

## Project Context

This configuration extends the global AI-augmented development process defined in ~/.CLAUDE.md. All global rules, agent hierarchies, approval strategies, and workflows from ~/.CLAUDE.md apply without modification. This document provides only project-specific context and information.

## Project Overview

### Mission
Build a backend-first POC that transforms PDF work orders into Texas811-ready submission packets with minimal user intervention.

### Core Design Principles
- **Backend-First POC**: Focus on backend foundation before UI polish
- **Data-First Output**: Produce Texas811-ready submission packets as primary deliverable
- **Clear Integration Points**: Standardized JSON contracts between CustomGPT and backend
- **Compliance Focus**: Lawful timing calculations and ticket lifecycle management
- **Real-Data Testing**: Every component must be validated against sample work orders

## POC Architecture

### Component Overview
1. **PDF Extraction Interface** (CustomGPT) - Vision-based OCR to JSON
2. **Backend Enrichment Service** - Validation, geocoding, date calculations
3. **Gap Resolution Wizard** - Interactive field completion
4. **Submission Packet Generator** - Texas811-compliant output
5. **Status Tracking Dashboard** - Lightweight lifecycle management

### Data Flow
```yaml
PDF Upload → CustomGPT Extraction → JSON → Backend Enrichment
→ Gap Resolution (if needed) → Submission Packet → Status Tracking
```

## Project-Specific Information

### File Locations
```yaml
Test Data: ~/dev/texas811-poc/test-data/
  - Sample PDF work orders
  - Expected extraction results
  - Edge cases and validation tests

AgentOS Project Files:
  - Roadmap: @.agent-os/product/roadmap.md
  - Tech Stack: @.agent-os/product/tech-stack.md
  - Decisions: @.agent-os/product/decisions.md
  - Active Specs: @.agent-os/specs/
  - Current Tasks: @.agent-os/specs/[current-spec]/tasks.md
```

### Texas811 Compliance Requirements
```yaml
Required Fields:
  - County, city, address OR GPS coordinates
  - Cross street references
  - Work description and scope

Timing Rules:
  - 2 business days wait period (excluding weekends/holidays)
  - 14-day ticket lifecycle
  - 14-day marking validity from positive response

Ticket Types:
  - Normal, Emergency, No Response
  - Update, Update & Remark, Dig Up
```

### Component Success Criteria
Each component must meet ALL criteria before marking complete:
- Input validation implemented
- Core processing logic functional
- Output schema documented
- Error handling comprehensive
- Unit tests passing
- **CRITICAL**: Tested successfully against real PDF work orders
- Integration points validated
- Documentation complete

### Demo Script Requirements
The POC must execute this flow successfully:
1. Upload sample work order PDF → auto-extraction
2. One quick clarification → submit-ready packet
3. Mark Submitted → display earliest lawful start
4. Positive Responses → show "Ready to Dig" with countdown

## Phase Implementation

### Phase A: Backend Foundation (Current)
**Focus**: Core functionality without UI polish
- JSON extraction from PDFs via CustomGPT
- Backend enrichment service
- Gap resolution wizard logic
- Submission packet generator
- Minimal status tracking

**Success Metrics**:
- < 5 minutes from PDF to submission packet
- ≥ 95% required field population
- Accurate lawful start calculations
- ≤ 2 clarification prompts needed

### Phase B: Nice-to-Have Polish
- Static Texas holiday calendar
- "No Response" reminders
- Print-ready formatting
- Enhanced geofence visualization

### Phase C: Post-POC Runway
- Portal automation (Playwright)
- Email/portal callbacks
- Multi-state support
- Advanced GIS features

## Known Constraints & Non-Goals

### POC Constraints
- No portal automation (manual submission)
- No email ingestion (manual status updates)
- Simple geofencing only (box or polyline buffer)
- CustomGPT for UI (not custom frontend)
- Python backend for all processing

### Non-Goals for POC
- NOT automating Texas811 portal submission
- NOT integrating with utility member systems
- NOT processing email responses automatically
- NOT supporting multi-state operations
- NOT implementing complex GIS features

## Testing Requirements

### Testing Strategy
1. **PDF Extraction**: Validate OCR accuracy and field mapping
2. **Enrichment**: Verify geocoding and date calculations
3. **Gap Resolution**: Ensure wizard handles all missing fields
4. **Compliance**: Confirm lawful timing calculations
5. **Integration**: End-to-end flow validation
6. **Dashboard**: Verify status tracking accuracy

### Critical Testing Note
**No component can be marked complete without successful testing against real work order PDFs from the test-data directory.**

## Agent Utilization Guidance

Follow the agent hierarchy and triggers defined in ~/.CLAUDE.md with these project-specific focus areas:

```yaml
Component Development:
  - PDF Extraction: backend-developer with vision API integration
  - Enrichment Service: backend-developer for validation/geocoding
  - Gap Wizard: backend-developer for conversational logic
  - Packet Generator: backend-developer for formatting
  - Dashboard: frontend-developer for status display

Quality & Testing:
  - test-runner: Validate all Texas811 compliance rules
  - deep-debugger: Investigate PDF parsing edge cases
  - code-reviewer: Ensure compliance calculations correct

Documentation:
  - documentation-specialist: API schemas and user workflows
```

## Project Status Tracking

Always check these locations for current status:
- **Active Specification**: @.agent-os/specs/
- **Current Phase**: Phase A - Backend Foundation
- **Task Progress**: Review tasks.md in active spec folder
- **Roadmap**: @.agent-os/product/roadmap.md

## Important Reminders

### Follow ~/.CLAUDE.md for All Process
- **Agent Delegation**: Use the complete hierarchy and triggers from ~/.CLAUDE.md
- **Approval Strategy**: Follow approval rules from ~/.CLAUDE.md (ask for major decisions only)
- **MCP Tools**: Use claude-context and memory as specified in ~/.CLAUDE.md
- **Workflow**: Follow PRD → TRD → Implementation flow from ~/.CLAUDE.md
- **Quality Gates**: Apply Definition of Done from ~/.CLAUDE.md

### Project-Specific Context Only
This document provides ONLY:
- Texas811 compliance requirements
- Test data locations
- Component architecture
- Phase planning
- Success metrics

All process, methodology, and agent usage follows ~/.CLAUDE.md without modification.

---

*Texas811 POC - Project-Specific Extension to ~/.CLAUDE.md*  
*Version: 1.0 - Backend-First POC Configuration*  
*All process rules defer to ~/.CLAUDE.md*