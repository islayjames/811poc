# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-31-backend-baseline-implementation-#1/spec.md

> Created: 2025-08-31
> Version: 1.0.0

## Test Coverage Strategy

### Testing Philosophy
- **Test-Driven Development**: Write tests before implementation for all core validation logic
- **Real Data Validation**: All tests must work with actual Texas811 requirements and sample work orders
- **Compliance-First**: Every test ensures legal compliance with Texas811 regulations
- **Integration-Heavy**: Focus on API contract testing to ensure CustomGPT integration works seamlessly

## Unit Tests

### ValidationEngine
- **test_required_fields_validation**: Verify all required fields are properly identified and validated
- **test_field_specific_validation**: Test phone number format, email validation, GPS coordinate bounds
- **test_severity_classification**: Ensure gaps are properly classified as required vs recommended
- **test_gap_prompt_generation**: Verify suggested prompts are actionable and specific
- **test_progressive_validation**: Test that partial updates don't break existing valid fields

### GISAssist
- **test_point_geocoding**: Verify address to GPS conversion with confidence scoring
- **test_geometry_generation**: Test box, polygon, and line buffer generation from instructions
- **test_coordinate_validation**: Ensure WGS-84 compliance and Texas bounds checking
- **test_geofence_construction**: Verify simple geofences from natural language instructions
- **test_confidence_calculation**: Test confidence scoring for various input qualities

### ComplianceDates
- **test_business_day_calculation**: Verify 2 business day minimum with weekend/holiday skipping
- **test_texas_holidays**: Test holiday calendar integration for compliance dates
- **test_validity_window_calculation**: Verify 14-day validity period after positive responses
- **test_past_date_prevention**: Ensure tickets can't be confirmed with past earliest start dates
- **test_emergency_ticket_dates**: Test immediate start for emergency ticket types

### TicketStateMachine
- **test_state_transitions**: Verify all valid state transitions and blocked invalid ones
- **test_field_locking**: Ensure confirmed tickets lock relevant fields from further changes
- **test_expiration_logic**: Test automatic transitions to Expiring and Expired states
- **test_audit_trail_generation**: Verify all state changes generate proper audit events

### SessionManager
- **test_session_creation**: Verify Redis session creation with proper TTL
- **test_session_retrieval**: Test session data persistence across API calls
- **test_session_cleanup**: Verify expired session cleanup and memory management
- **test_concurrent_sessions**: Test multiple simultaneous ticket sessions

## Integration Tests

### CustomGPT API Contract
- **test_create_ticket_flow**: Full workflow from initial fields to validation response
- **test_iterative_update_flow**: Multiple update rounds with gap resolution
- **test_confirm_ticket_flow**: Final confirmation and packet generation
- **test_error_handling**: Proper error responses for invalid API usage
- **test_session_consistency**: Verify session state maintained across API calls

### Database Operations
- **test_ticket_crud_operations**: Create, read, update operations on tickets table
- **test_geometry_storage**: Verify GeoJSON storage and retrieval with PostGIS integration
- **test_audit_logging**: Ensure all changes generate proper audit records
- **test_concurrent_updates**: Test database consistency under concurrent ticket updates
- **test_migration_integrity**: Verify database migrations maintain data integrity

### External Service Integration
- **test_geocoding_service**: Integration with Mapbox/Google geocoding APIs
- **test_geocoding_fallback**: Verify fallback behavior when geocoding fails
- **test_rate_limit_handling**: Test external API rate limit compliance
- **test_service_timeout_handling**: Verify graceful degradation when services timeout

### Validation Engine Integration
- **test_real_work_order_validation**: Use actual work order data to test validation completeness
- **test_gap_resolution_workflow**: End-to-end gap identification and resolution
- **test_geometry_validation_pipeline**: Full pipeline from address/GPS to valid geometry
- **test_compliance_rule_enforcement**: Verify all Texas811 requirements are enforced

## Feature Tests (End-to-End)

### Complete Ticket Lifecycle
**test_draft_to_ready_workflow**
- Create ticket with minimal data → receive gaps
- Update with gap resolution data → achieve valid status  
- Confirm ticket → receive submission packet
- Verify all required Texas811 fields present in final packet

**test_submission_tracking_workflow**
- Confirm ticket → manual mark as submitted
- Manual mark responses received → automatic expiration calculation
- Verify countdown timers and expiration tracking
- Test manual cancellation at any stage

**test_emergency_ticket_workflow**
- Create emergency ticket → verify immediate start date
- Confirm emergency priority handling throughout workflow
- Verify proper emergency ticket submission packet format

### Dashboard Operations
**test_ticket_listing_and_filtering**
- Create multiple tickets in various states
- Test filtering by status, county, expiration dates
- Verify pagination and sorting functionality
- Test search by company name and work order reference

**test_manual_state_transitions**
- Test all manual state transition buttons work correctly
- Verify audit trail captures manual state changes
- Test business rule enforcement (can't mark submitted before ready)

### Data Quality Assurance
**test_texas811_compliance_validation**
- Verify all required fields match official Texas811 requirements
- Test submission packet format matches portal expectations
- Ensure date calculations follow legal requirements
- Validate geometry requirements for portal submission

## Mocking Requirements

### External Services
- **Mapbox Geocoding API**: Mock geocoding responses with various confidence levels and failure scenarios
- **Google Maps Geocoding**: Alternative geocoding service mock for fallback testing
- **Texas Holiday API**: Mock holiday calendar service for business day calculations

### Time-Based Mocking
- **System Clock**: Mock current time for testing date calculations and expiration logic
- **Business Day Calculator**: Mock weekend/holiday detection for consistent testing
- **Session TTL**: Mock Redis TTL behavior for session management testing

### Database Mocking
- **PostgreSQL**: Use in-memory database for fast unit tests, real database for integration tests
- **Redis**: Use fakeredis for unit tests, real Redis for integration tests
- **File System**: Mock file uploads and storage for attachment testing

## Test Data Sets

### Sample Work Orders
- **Complete Work Order**: All fields populated, no gaps expected
- **Minimal Work Order**: Only required fields, multiple gaps expected
- **Address-Only Work Order**: No GPS, test geocoding workflow
- **GPS-Only Work Order**: No address, test driving directions requirement
- **Emergency Work Order**: Test emergency workflow and date calculations
- **Ambiguous Location Work Order**: Test low-confidence geometry generation

### Texas811 Portal Data
- **Sample Submission Packets**: Known-good packets from Texas811 documentation
- **County/City Reference Data**: Complete Texas county and city lists
- **Holiday Calendar**: Texas state holidays for multiple years
- **Utility Response Formats**: Sample positive response data structures

### Edge Cases
- **Boundary GPS Coordinates**: Test Texas state boundaries and validation
- **Holiday Edge Cases**: Test tickets created near holidays/weekends
- **Long Field Values**: Test field length limits and truncation
- **Unicode/Special Characters**: Test field handling with various character encodings
- **Malformed GeoJSON**: Test geometry validation with invalid/malformed data

## Performance Tests

### Load Testing
- **Concurrent API Calls**: 100+ simultaneous validation requests
- **Large Geometry Processing**: Test performance with complex polygons
- **Database Query Performance**: Test dashboard queries with large datasets
- **Memory Usage**: Monitor memory consumption during heavy processing

### Response Time Requirements
- **Validation Response**: <500ms for standard validation requests
- **Geocoding Operations**: <2 seconds including external API calls
- **Database Operations**: <100ms for typical CRUD operations
- **Dashboard Loading**: <1 second for ticket list with filtering

## Test Environment Configuration

### Local Development
```python
# pytest configuration
[tool:pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = --strict-markers --strict-config --cov=app --cov-report=html --cov-report=term
markers =
    unit: Unit tests
    integration: Integration tests  
    e2e: End-to-end tests
    slow: Tests that take >1 second
    external: Tests requiring external services
```

### CI/CD Pipeline
- **Fast Test Suite**: Unit tests only, runs on every commit (<30 seconds)
- **Full Test Suite**: All tests including integration, runs on PRs (<5 minutes)
- **E2E Test Suite**: Complete workflows with real services, runs on main branch updates
- **Performance Tests**: Load testing, runs nightly

### Test Database Setup
- **Test Database**: Separate PostgreSQL instance with sample data
- **Redis Test Instance**: Isolated Redis for session testing
- **Migration Testing**: Verify all migrations work cleanly on test data

## Acceptance Criteria

### Test Coverage Metrics
- **Line Coverage**: >95% for core business logic
- **Branch Coverage**: >90% for validation and state machine logic
- **Integration Coverage**: 100% of API endpoints tested
- **E2E Coverage**: All critical user workflows tested

### Quality Gates
- **All Tests Pass**: Zero failing tests before any deployment
- **Performance SLA**: All performance tests must meet requirements
- **Real Data Validation**: At least 10 different work order formats successfully processed
- **Compliance Verification**: All Texas811 requirements validated through tests

### Mock Validation
- **External Service Mocks**: Comprehensive coverage of all external API scenarios
- **Time-based Logic**: All date calculations thoroughly tested with mocked time
- **Error Scenarios**: All failure modes tested with appropriate mocks