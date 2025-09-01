# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-31-backend-baseline-implementation-#1/spec.md

> Created: 2025-08-31
> Status: Ready for Implementation

## Tasks

- [x] 1. Project Foundation and Environment Setup
  - [x] 1.1 Set up Python project structure with uv package manager
  - [x] 1.2 Configure FastAPI application with OpenAPI documentation
  - [x] 1.3 Configure Redis for session management only
  - [x] 1.4 Set up testing framework with pytest
  - [x] 1.5 Set up code quality tools (black, ruff, mypy)
  - [x] 1.6 Create basic project structure for JSON persistence
  - [x] 1.7 Configure environment variables and settings

- [x] 2. JSON Data Models and Storage Layer
  - [x] 2.1 Write tests for Pydantic models and JSON serialization
  - [x] 2.2 Create Pydantic models for tickets, validation_gaps, and geometry
  - [x] 2.3 Implement JSON file storage with atomic writes and backups
  - [x] 2.4 Create data loading and query utilities for ticket search
  - [x] 2.5 Implement audit event logging to JSON files
  - [x] 2.6 Create data migration utilities for schema changes
  - [x] 2.7 Verify all data persistence tests pass

- [x] 3. Core Validation Engine Implementation
  - [x] 3.1 Write tests for field validation logic and gap detection
  - [x] 3.2 Implement Texas811 required field validation rules
  - [x] 3.3 Create severity classification system (required vs recommended)
  - [x] 3.4 Implement gap prompt generation with actionable suggestions
  - [x] 3.5 Create progressive validation for partial updates
  - [x] 3.6 Implement validation result caching in memory
  - [x] 3.7 Verify all validation tests pass with sample work order data

- [x] 4. GIS and Geocoding Integration
  - [x] 4.1 Write tests for geocoding and geometry generation
  - [x] 4.2 Integrate Mapbox geocoding API with error handling
  - [x] 4.3 Implement geometry generation from GPS coordinates
  - [x] 4.4 Create simple geofence builder (box/polyline buffer)
  - [x] 4.5 Implement coordinate validation and Texas bounds checking
  - [x] 4.6 Create confidence scoring for generated geometries
  - [x] 4.7 Verify all GIS tests pass with real address and GPS data

- [x] 5. Compliance Date Calculator Implementation
  - [x] 5.1 Write tests for business day calculations and date logic
  - [x] 5.2 Implement 2 business day minimum calculation
  - [x] 5.3 Create simple hardcoded Texas holiday list for POC
  - [x] 5.4 Implement 14-day validity window calculation
  - [x] 5.5 Create ticket lifecycle status calculations
  - [x] 5.6 Implement past date prevention for ticket confirmation
  - [x] 5.7 Verify all compliance date tests pass

- [x] 6. Session Management and Ticket State
  - [x] 6.1 Write tests for Redis session management and state tracking
  - [x] 6.2 Implement Redis session storage with TTL for CustomGPT workflows
  - [x] 6.3 Create ticket state management (draft, validated, confirmed, submitted)
  - [x] 6.4 Implement field locking for confirmed tickets
  - [x] 6.5 Create simple audit trail logging to JSON files
  - [x] 6.6 Implement ticket expiration status calculations
  - [x] 6.7 Verify all session and state management tests pass

- [x] 7. CustomGPT API Endpoints Implementation
  - [x] 7.1 Write tests for CustomGPT API contract and responses
  - [x] 7.2 Implement POST /tickets/create endpoint with validation
  - [x] 7.3 Implement POST /tickets/{ticket_id}/update endpoint
  - [x] 7.4 Implement POST /tickets/{ticket_id}/confirm endpoint
  - [x] 7.5 Create comprehensive error handling and gap response formatting
  - [x] 7.6 Implement request/response logging for debugging
  - [x] 7.7 Verify all CustomGPT integration tests pass

- [x] 8. Dashboard and Manual Operations
  - [x] 8.1 Write tests for dashboard endpoints and ticket retrieval
  - [x] 8.2 Implement GET /tickets endpoint with simple filtering
  - [x] 8.3 Implement GET /tickets/{ticket_id} detailed view endpoint
  - [x] 8.4 Implement manual state transition endpoints (mark-submitted, mark-responses-in)
  - [x] 8.5 Create ticket cancellation and deletion endpoints
  - [x] 8.6 Implement countdown calculations for dashboard display
  - [x] 8.7 Verify all dashboard API tests pass

- [x] 9. Texas811 Submission Packet Generator
  - [x] 9.1 Write tests for submission packet generation and formatting
  - [x] 9.2 Implement Texas811 portal-aligned packet structure
  - [x] 9.3 Create section formatting (Caller/Excavator, Work, Location, etc.)
  - [x] 9.4 Implement field validation for submission packets
  - [x] 9.5 Create packet export in JSON format for manual portal entry
  - [x] 9.6 Implement submission packet freezing on confirmation
  - [x] 9.7 Verify submission packets match Texas811 portal requirements

- [x] 10. Integration Testing and POC Validation
  - [x] 10.1 Write end-to-end tests for complete ticket workflows
  - [x] 10.2 Test CustomGPT integration with sample PDF work order data
  - [x] 10.3 Validate complete draft-to-submission workflow with real data
  - [x] 10.4 Test manual dashboard operations and lifecycle management
  - [x] 10.5 Validate error handling and gap resolution workflows
  - [x] 10.6 Test performance with target <500ms validation response
  - [x] 10.7 Verify POC demo script executes successfully

- [ ] 11. Documentation and Deployment
  - [ ] 11.1 Write API documentation and update OpenAPI specs
  - [ ] 11.2 Create deployment configuration for Railway with JSON storage
  - [ ] 11.3 Set up environment variable management and Redis configuration
  - [ ] 11.4 Create data backup and recovery procedures for JSON files
  - [ ] 11.5 Implement health check endpoints for monitoring
  - [ ] 11.6 Create user documentation for dashboard operations
  - [ ] 11.7 Verify deployment configuration and POC readiness
