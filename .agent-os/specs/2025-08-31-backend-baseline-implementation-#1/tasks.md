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

- [ ] 3. Core Validation Engine Implementation
  - [ ] 3.1 Write tests for field validation logic and gap detection
  - [ ] 3.2 Implement Texas811 required field validation rules
  - [ ] 3.3 Create severity classification system (required vs recommended)
  - [ ] 3.4 Implement gap prompt generation with actionable suggestions
  - [ ] 3.5 Create progressive validation for partial updates
  - [ ] 3.6 Implement validation result caching in memory
  - [ ] 3.7 Verify all validation tests pass with sample work order data

- [ ] 4. GIS and Geocoding Integration
  - [ ] 4.1 Write tests for geocoding and geometry generation
  - [ ] 4.2 Integrate Mapbox geocoding API with error handling
  - [ ] 4.3 Implement geometry generation from GPS coordinates
  - [ ] 4.4 Create simple geofence builder (box/polyline buffer)
  - [ ] 4.5 Implement coordinate validation and Texas bounds checking
  - [ ] 4.6 Create confidence scoring for generated geometries
  - [ ] 4.7 Verify all GIS tests pass with real address and GPS data

- [ ] 5. Compliance Date Calculator Implementation
  - [ ] 5.1 Write tests for business day calculations and date logic
  - [ ] 5.2 Implement 2 business day minimum calculation
  - [ ] 5.3 Create simple hardcoded Texas holiday list for POC
  - [ ] 5.4 Implement 14-day validity window calculation
  - [ ] 5.5 Create ticket lifecycle status calculations
  - [ ] 5.6 Implement past date prevention for ticket confirmation
  - [ ] 5.7 Verify all compliance date tests pass

- [ ] 6. Session Management and Ticket State
  - [ ] 6.1 Write tests for Redis session management and state tracking
  - [ ] 6.2 Implement Redis session storage with TTL for CustomGPT workflows
  - [ ] 6.3 Create ticket state management (draft, validated, confirmed, submitted)
  - [ ] 6.4 Implement field locking for confirmed tickets
  - [ ] 6.5 Create simple audit trail logging to JSON files
  - [ ] 6.6 Implement ticket expiration status calculations
  - [ ] 6.7 Verify all session and state management tests pass

- [ ] 7. CustomGPT API Endpoints Implementation
  - [ ] 7.1 Write tests for CustomGPT API contract and responses
  - [ ] 7.2 Implement POST /tickets/create endpoint with validation
  - [ ] 7.3 Implement POST /tickets/{ticket_id}/update endpoint
  - [ ] 7.4 Implement POST /tickets/{ticket_id}/confirm endpoint
  - [ ] 7.5 Create comprehensive error handling and gap response formatting
  - [ ] 7.6 Implement request/response logging for debugging
  - [ ] 7.7 Verify all CustomGPT integration tests pass

- [ ] 8. Dashboard and Manual Operations
  - [ ] 8.1 Write tests for dashboard endpoints and ticket retrieval
  - [ ] 8.2 Implement GET /tickets endpoint with simple filtering
  - [ ] 8.3 Implement GET /tickets/{ticket_id} detailed view endpoint
  - [ ] 8.4 Implement manual state transition endpoints (mark-submitted, mark-responses-in)
  - [ ] 8.5 Create ticket cancellation and deletion endpoints
  - [ ] 8.6 Implement countdown calculations for dashboard display
  - [ ] 8.7 Verify all dashboard API tests pass

- [ ] 9. Texas811 Submission Packet Generator
  - [ ] 9.1 Write tests for submission packet generation and formatting
  - [ ] 9.2 Implement Texas811 portal-aligned packet structure
  - [ ] 9.3 Create section formatting (Caller/Excavator, Work, Location, etc.)
  - [ ] 9.4 Implement field validation for submission packets
  - [ ] 9.5 Create packet export in JSON format for manual portal entry
  - [ ] 9.6 Implement submission packet freezing on confirmation
  - [ ] 9.7 Verify submission packets match Texas811 portal requirements

- [ ] 10. Integration Testing and POC Validation
  - [ ] 10.1 Write end-to-end tests for complete ticket workflows
  - [ ] 10.2 Test CustomGPT integration with sample PDF work order data
  - [ ] 10.3 Validate complete draft-to-submission workflow with real data
  - [ ] 10.4 Test manual dashboard operations and lifecycle management
  - [ ] 10.5 Validate error handling and gap resolution workflows
  - [ ] 10.6 Test performance with target <500ms validation response
  - [ ] 10.7 Verify POC demo script executes successfully

- [ ] 11. Documentation and Deployment
  - [ ] 11.1 Write API documentation and update OpenAPI specs
  - [ ] 11.2 Create deployment configuration for Railway with JSON storage
  - [ ] 11.3 Set up environment variable management and Redis configuration
  - [ ] 11.4 Create data backup and recovery procedures for JSON files
  - [ ] 11.5 Implement health check endpoints for monitoring
  - [ ] 11.6 Create user documentation for dashboard operations
  - [ ] 11.7 Verify deployment configuration and POC readiness
