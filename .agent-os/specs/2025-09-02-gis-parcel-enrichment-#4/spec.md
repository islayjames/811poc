# Spec Requirements Document

> Spec: GIS Parcel Enrichment via County CAD ArcGIS
> Created: 2025-09-02
> GitHub Issue: #4
> Status: Planning

## Overview

Enhance the existing geocoding pipeline to query county-specific ArcGIS GIS systems and retrieve detailed parcel information including subdivision, lot, block, and parcel ID. This feature extends the address geocoding capability by adding property-level data enrichment from authoritative county sources, enabling more precise location identification and improved Texas 811 ticket accuracy.

## User Stories

### Ticket Processor Parcel Enrichment

As a ticket processor, I want the system to automatically retrieve parcel information after geocoding, so that I have complete property details without manual lookup.

When a ticket is submitted with an address, the system will:
1. First normalize the address and geocode it via Mapbox to get lat/lng and county
2. Then query the appropriate county's ArcGIS system using the coordinates
3. Retrieve and attach subdivision, lot, block, and parcel ID to the ticket
4. Handle unsupported counties gracefully by returning null values
5. Cache results to minimize repeated API calls for the same location

### County Support Administrator

As an administrator, I want to easily add support for new counties, so that we can expand coverage incrementally without code changes.

The administrator workflow involves:
1. Obtaining the county's ArcGIS REST endpoint URL
2. Identifying the field mappings for subdivision, lot, block, and parcel ID
3. Adding a new entry to the CAD_RESOLVERS configuration
4. Testing with known parcel coordinates to verify the mapping
5. Deploying the configuration update without application changes

### System Resilience

As a system operator, I want the GIS enrichment to fail gracefully, so that ticket processing continues even when county systems are unavailable.

The system will:
1. Attempt the parcel lookup with a reasonable timeout
2. Log any failures with context (county, coordinates, error)
3. Return null values for parcel fields if lookup fails
4. Continue with ticket processing using available data
5. Optionally retry failed lookups in background processing

## Spec Scope

1. **CAD Resolver Configuration** - Static configuration map supporting Harris, Fort Bend, Galveston, and Liberty counties
2. **Parcel Enrichment Function** - Async function to query ArcGIS endpoints and normalize response data
3. **Result Caching** - Optional caching layer keyed by rounded lat/lng to reduce API calls
4. **Error Handling** - Graceful fallback for unsupported counties and failed API calls
5. **Logging Integration** - Comprehensive logging of success, failure, and performance metrics

## Out of Scope

- Direct integration with county tax assessor databases
- Shapefile processing or local GIS data storage
- Property ownership or valuation information
- Historical parcel data or change tracking
- Brazoria County support (pending shapefile availability)
- User interface for manual parcel lookup
- Batch processing of existing tickets

## Expected Deliverable

1. Working parcel enrichment for tickets in Harris, Fort Bend, Galveston, and Liberty counties
2. Easy configuration system allowing new counties to be added via config changes
3. Comprehensive test coverage including mock ArcGIS responses for all supported counties

## Spec Documentation

- Tasks: @.agent-os/specs/2025-09-02-gis-parcel-enrichment-#4/tasks.md
- Technical Specification: @.agent-os/specs/2025-09-02-gis-parcel-enrichment-#4/sub-specs/technical-spec.md
- API Specification: @.agent-os/specs/2025-09-02-gis-parcel-enrichment-#4/sub-specs/api-spec.md
- Tests Specification: @.agent-os/specs/2025-09-02-gis-parcel-enrichment-#4/sub-specs/tests.md
