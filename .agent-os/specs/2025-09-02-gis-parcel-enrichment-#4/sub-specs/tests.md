# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-09-02-gis-parcel-enrichment-#4/spec.md

> Created: 2025-09-02
> Version: 1.0.0

## Test Coverage

### Unit Tests

**CADResolvers Configuration**
- Verify all required counties are present in CAD_RESOLVERS
- Validate each resolver has required fields (name, arcgis_url, out_fields)
- Ensure out_fields contains all four required mappings
- Test county name normalization (e.g., "harris" → "Harris")

**enrichParcelFromGIS Function**
- Test successful parcel retrieval for each supported county
- Test handling of unsupported county (returns feature_found: false)
- Test handling of invalid coordinates (out of bounds)
- Test null/undefined input handling
- Test response when no features found
- Test selection of first feature when multiple matches
- Verify raw_feature excluded in production mode

**fetchParcelFeature Function**
- Test query parameter construction for each county
- Test timeout handling (mock delayed response)
- Test network error handling
- Test malformed response handling
- Test empty features array handling

**Cache Implementation**
- Test cache key generation with coordinate rounding
- Test cache hit for repeated lookups
- Test cache miss and subsequent storage
- Test cache TTL expiration
- Test LRU eviction when cache full

**Field Mapping**
- Test correct field extraction for Harris County format
- Test correct field extraction for Fort Bend format
- Test correct field extraction for Galveston format
- Test correct field extraction for Liberty format
- Test handling of missing fields in response
- Test handling of null values in response

### Integration Tests

**Validation Pipeline Integration**
- Test full flow: address → geocode → parcel enrichment
- Test parcel enrichment skipped when geocoding fails
- Test parcel enrichment skipped when county missing
- Test validation continues when parcel lookup fails
- Test parcel info correctly attached to ticket model

**External API Integration**
- Test actual Harris County endpoint with known coordinates
- Test actual Fort Bend endpoint with known coordinates
- Test actual Galveston endpoint with known coordinates
- Test actual Liberty endpoint with known coordinates
- Test retry logic for transient failures
- Test circuit breaker for persistent failures

**Performance Tests**
- Verify lookup completes within 5-second timeout
- Test concurrent lookups for different counties
- Test cache performance with 1000+ entries
- Measure cache hit ratio after warm-up period

### Feature Tests

**End-to-End Ticket Creation**
```gherkin
Given a ticket with address "123 Main St, Houston, TX 77002"
When the ticket is validated
Then geocoding returns lat: 29.7604, lng: -95.3698
And county is determined as "Harris"
And parcel lookup is performed
And parcel_info contains subdivision, lot, block, parcel_id
And ticket is saved with complete parcel information
```

**County Not Supported**
```gherkin
Given a ticket with address in "Brazoria" county
When the ticket is validated
Then geocoding completes successfully
And parcel enrichment returns feature_found: false
And ticket.site.parcel_info contains null values
And validation continues without error
```

**ArcGIS Service Unavailable**
```gherkin
Given Harris County ArcGIS is unavailable
When a Houston ticket is validated
Then geocoding completes successfully
And parcel lookup times out after 5 seconds
And error is logged with context
And ticket.site.parcel_info contains null values
And validation continues without error
```

### Mocking Requirements

**ArcGIS Response Mocks**
- Mock successful responses for each county with realistic data
- Mock empty features response
- Mock error response with ArcGIS error format
- Mock timeout scenarios

**Network Mocks**
- Mock fetch/requests library for unit tests
- Mock network delays for timeout testing
- Mock network errors for resilience testing

**Cache Mocks**
- Mock cache storage for unit tests
- Mock cache TTL timer for expiration testing
- Mock memory limits for eviction testing

## Test Data

### Known Test Coordinates

**Harris County**
- Downtown Houston: 29.7604, -95.3698
- Expected: River Oaks subdivision data

**Fort Bend County**
- Sugar Land: 29.6197, -95.6349
- Expected: First Colony subdivision data

**Galveston County**
- League City: 29.5072, -95.0947
- Expected: Clear Creek subdivision data

**Liberty County**
- Liberty: 30.0579, -94.7952
- Expected: City limits parcel data

### Mock Response Templates

**Successful Response**
```json
{
  "features": [{
    "attributes": {
      "SUBDIVNME": "TEST_SUBDIVISION",
      "LOT": "99",
      "BLOCK": "Z",
      "ACCOUNT": "TEST123456"
    }
  }],
  "spatialReference": {"wkid": 4326}
}
```

**No Features Response**
```json
{
  "features": [],
  "spatialReference": {"wkid": 4326}
}
```

**Error Response**
```json
{
  "error": {
    "code": 400,
    "message": "Invalid parameters",
    "details": ["Geometry parameter invalid"]
  }
}
```

## Test Execution Strategy

### Development Phase
1. Run unit tests in watch mode during development
2. Mock all external dependencies
3. Focus on edge cases and error handling

### Integration Phase
1. Run integration tests against real endpoints
2. Use known test coordinates for repeatability
3. Verify actual response formats match expectations

### Pre-Deployment
1. Run full test suite including performance tests
2. Verify cache hit ratio meets targets
3. Confirm all counties return expected data
4. Load test with concurrent requests

### Post-Deployment
1. Monitor error rates for each county
2. Track cache hit ratios in production
3. Alert on timeout rates exceeding threshold
4. Periodic smoke tests of all endpoints
