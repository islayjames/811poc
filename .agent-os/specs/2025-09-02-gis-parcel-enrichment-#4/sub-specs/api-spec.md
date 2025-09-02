# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-02-gis-parcel-enrichment-#4/spec.md

> Created: 2025-09-02
> Version: 1.0.0

## Internal API Changes

### Enhanced Validation Endpoint

#### POST /api/validation/enrich

**Purpose:** Modified to include GIS parcel enrichment after geocoding step

**Request Flow:**
1. Receive ticket data with address information
2. Perform address normalization
3. Execute Mapbox geocoding (existing)
4. **NEW: Execute parcel enrichment if county is supported**
5. Return enriched validation response

**Modified Response Structure:**
```json
{
  "status": "validated",
  "ticket": {
    "site": {
      "address": "123 Main St",
      "city": "Houston",
      "county": "Harris",
      "gps_lat": 29.7604,
      "gps_lng": -95.3698,
      "parcel_info": {  // NEW
        "subdivision": "RIVER OAKS",
        "lot": "15",
        "block": "A",
        "parcel_id": "1234567890",
        "feature_found": true,
        "matched_count": 1,
        "source_county": "Harris",
        "arcgis_url": "https://gis.hctx.net/..."
      }
    }
  }
}
```

### Backend Service Functions

#### enrichParcelFromGIS(input)

**Purpose:** Core function to query county ArcGIS systems

**Parameters:**
```typescript
{
  lat: number;      // WGS84 latitude
  lng: number;      // WGS84 longitude
  county: string;   // Normalized county name
}
```

**Response:**
```typescript
{
  subdivision: string | null;
  lot: string | null;
  block: string | null;
  parcel_id: string | null;
  feature_found: boolean;
  matched_count: number;
  raw_feature?: any;  // Only in debug mode
  arcgis_url: string;
  source_county: string;
}
```

**Errors:**
- Returns object with feature_found: false for any failure
- Never throws exceptions that would break the validation pipeline

#### fetchParcelFeature(county, lat, lng)

**Purpose:** Low-level ArcGIS query function

**Parameters:**
- county: string - Must match CAD_RESOLVERS key
- lat: number - WGS84 latitude
- lng: number - WGS84 longitude

**Response:** Raw ArcGIS feature or null

**Errors:**
- Throws for network errors (caught by enrichParcelFromGIS)
- Returns null for no features found

## External API Integration

### County ArcGIS Endpoints

#### Harris County HCAD
- **URL:** `https://gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query`
- **Method:** GET
- **Authentication:** None (public)
- **Rate Limits:** Unknown, implement conservative retry

#### Fort Bend County FBCAD
- **URL:** `https://gisweb.fbcad.org/arcgis/rest/services/Hosted/FBCAD_Public_Data/FeatureServer/0/query`
- **Method:** GET
- **Authentication:** None (public)
- **Rate Limits:** Unknown, implement conservative retry

#### Galveston County
- **URL:** `https://www1.cityofwebster.com/arcgis/rest/services/Landbase/CountyGalveston/MapServer/0/query`
- **Method:** GET
- **Authentication:** None (public)
- **Rate Limits:** Unknown, implement conservative retry

#### Liberty County
- **URL:** `https://gis.ljaengineering.com/arcgis/rest/services/liberty/liberty_co/MapServer/0/query`
- **Method:** GET
- **Authentication:** None (public)
- **Rate Limits:** Unknown, implement conservative retry

### Query Parameters (All Counties)

```
geometry={lng},{lat}
geometryType=esriGeometryPoint
inSR=4326
spatialRel=esriSpatialRelIntersects
outFields={county_specific_fields}
returnGeometry=false
f=json
```

### Response Format

#### Success Response
```json
{
  "features": [
    {
      "attributes": {
        "SUBDIVNME": "RIVER OAKS",
        "LOT": "15",
        "BLOCK": "A",
        "ACCOUNT": "1234567890"
      }
    }
  ],
  "fields": [...],
  "spatialReference": {...}
}
```

#### No Features Response
```json
{
  "features": [],
  "fields": [...],
  "spatialReference": {...}
}
```

#### Error Response
```json
{
  "error": {
    "code": 400,
    "message": "Invalid parameters",
    "details": []
  }
}
```

## Integration Points

### Ticket Creation Flow
1. CustomGPT sends initial ticket data
2. Backend validates and geocodes address
3. **NEW: Backend enriches with parcel data**
4. Backend stores complete ticket with parcel_info
5. Backend returns enriched ticket to CustomGPT

### Ticket Update Flow
1. If address changes, re-geocode
2. **NEW: If county/coordinates change, re-enrich parcel**
3. Update ticket.site.parcel_info
4. Log parcel info changes in audit trail

### Dashboard Display
- Show parcel info in ticket detail view
- Display "Parcel: {subdivision} Lot {lot} Block {block}"
- Show parcel ID if available
- Indicate if parcel lookup failed

## Performance Considerations

- Cache parcel lookups to reduce external API calls
- Implement 5-second timeout for ArcGIS queries
- Process parcel enrichment asynchronously when possible
- Batch nearby lookups in same county when feasible
- Monitor and log response times for each county endpoint
