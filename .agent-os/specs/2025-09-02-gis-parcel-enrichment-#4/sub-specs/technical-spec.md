# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-02-gis-parcel-enrichment-#4/spec.md

> Created: 2025-09-02
> Version: 1.0.0

## Technical Requirements

### Core Functionality
- Query county-specific ArcGIS REST endpoints using lat/lng coordinates
- Support esriGeometryPoint spatial queries with WGS84 (EPSG:4326) projection
- Parse and normalize ArcGIS JSON responses to extract parcel attributes
- Handle multiple feature matches by selecting the first result
- Implement timeout protection (5 second default) for external API calls
- Support optional result caching with 6-decimal precision lat/lng keys

### Data Flow Integration
- Must execute AFTER Mapbox geocoding completes (requires lat/lng)
- Must execute AFTER county determination from address normalization
- Results stored in ticket.site.parcel_info structure
- Failures must not block ticket processing pipeline

### Configuration Management
- CAD_RESOLVERS stored as TypeScript const export for type safety
- Each resolver entry contains: name, arcgis_url, out_fields mapping
- Field mappings translate county-specific field names to normalized keys
- Configuration changes should not require code modifications

### Performance Requirements
- API response time < 2 seconds per lookup (excluding network latency)
- Cache hit ratio target > 80% for repeat locations
- Support concurrent lookups for different counties
- Implement exponential backoff for failed requests

## Approach Options

### Option A: Direct HTTP Client Implementation
- Pros: Simple, no external dependencies, full control over request handling
- Cons: Need to implement retry logic, caching, and error handling from scratch

### Option B: ArcGIS REST JS Library (Selected)
- Pros: Built-in retry logic, standardized error handling, TypeScript support, maintained by Esri
- Cons: Additional dependency, potential version conflicts

### Option C: Generic GIS Library (e.g., Turf.js + fetch)
- Pros: Broader GIS capabilities, could support other spatial operations
- Cons: Overkill for simple point queries, larger bundle size

**Rationale:** Option B selected for robustness and maintainability. The @esri/arcgis-rest-request library provides battle-tested ArcGIS integration with proper error handling and TypeScript types.

## Implementation Architecture

### Module Structure
```
src/lib/gis/
├── cad_resolvers.ts       # CAD_RESOLVERS configuration
├── parcel_enrichment.ts   # Main enrichParcelFromGIS function
├── arcgis_client.ts       # ArcGIS query wrapper
├── cache.ts               # LRU cache implementation
└── types.ts               # TypeScript interfaces
```

### Key Interfaces
```typescript
interface CADResolver {
  name: string;
  arcgis_url: string;
  out_fields: {
    subdivision: string;
    lot: string;
    block: string;
    parcel_id: string;
  };
}

interface ParcelInfo {
  subdivision: string | null;
  lot: string | null;
  block: string | null;
  parcel_id: string | null;
  feature_found: boolean;
  matched_count: number;
  raw_feature?: any;
  arcgis_url: string;
  source_county: string;
}
```

### Query Construction
```typescript
const queryParams = {
  geometry: `${lng},${lat}`,
  geometryType: 'esriGeometryPoint',
  inSR: '4326',
  spatialRel: 'esriSpatialRelIntersects',
  outFields: Object.values(resolver.out_fields).join(','),
  returnGeometry: false,
  f: 'json'
};
```

## External Dependencies

### @esri/arcgis-rest-request (^4.0.0)
- **Purpose:** Standardized ArcGIS REST API client
- **Justification:** Official Esri library with proper error handling, retry logic, and TypeScript support

### lru-cache (^10.0.0)
- **Purpose:** In-memory caching of parcel lookup results
- **Justification:** Reduces API calls, improves performance, configurable TTL and size limits

### Python Backend Equivalent
For the Python backend implementation:
- **requests** - HTTP client (already in requirements)
- **cachetools** - LRU cache implementation
- **typing** - Type hints for interfaces

## Error Handling Strategy

### Graceful Degradation
1. County not in CAD_RESOLVERS → Return feature_found: false
2. Network timeout → Log warning, return nulls
3. Invalid response format → Log error with response, return nulls
4. No features found → Return feature_found: false
5. Multiple features → Use first, log matched_count

### Logging Requirements
- SUCCESS: County, parcel_id, matched_count, response time
- FAILURE: County, lat/lng, error type, error message
- CACHE_HIT: County, lat/lng (rounded)
- CONFIG_ERROR: Missing county in resolver

## Cache Strategy

### Cache Key Generation
```typescript
const cacheKey = `${county}:${lat.toFixed(6)}:${lng.toFixed(6)}`;
```

### Cache Configuration
- TTL: 24 hours (configurable via environment)
- Max Size: 10,000 entries
- Eviction: LRU (Least Recently Used)
- Storage: In-memory only for v1.1

## Security Considerations

- No authentication required for public ArcGIS endpoints
- Implement rate limiting to prevent abuse
- Sanitize county input to prevent injection attacks
- Never log sensitive parcel owner information
- Validate lat/lng bounds (-90 to 90, -180 to 180)
