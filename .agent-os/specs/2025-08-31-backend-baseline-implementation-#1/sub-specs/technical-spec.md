# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-31-backend-baseline-implementation-#1/spec.md

> Created: 2025-08-31
> Version: 2.0.0

## Technical Requirements

### Validation Engine Requirements
- **Multi-field Validation**: Validate caller/excavator info, work details, location data, and GIS geometry
- **Severity Levels**: Distinguish between required fields (blocking) and recommended fields (warnings)
- **Gap Analysis**: Generate specific, actionable prompts for each validation failure
- **Stateful Sessions**: Maintain ticket state across multiple validation attempts using Redis
- **Progressive Enhancement**: Accept partial updates and re-validate incrementally

### GIS/Geofence Requirements
- **Coordinate System**: WGS-84 (EPSG:4326) for all geometries
- **Geometry Types**: Support Point, Polygon, and LineBuffer (buffered polyline)
- **Geocoding**: Convert addresses to GPS coordinates with confidence scoring
- **Instruction Parser**: Interpret natural language descriptions (e.g., "100 ft along front ROW")
- **Default Behaviors**: Apply configurable default box size (25x25 ft) when instructions unclear
- **Validation Rules**: Non-self-intersecting, non-zero area/length (except Points), bounds sanity checks

### Compliance Date Requirements
- **Business Day Calculation**: Skip weekends, optionally skip Texas holidays
- **Earliest Start**: Request timestamp + 2 business days
- **Validity Window**: 14 days from positive response date
- **Countdown Tracking**: Real-time countdown for both start date and expiration
- **Past Date Prevention**: Block confirmation if earliest start would be in the past

### Performance Requirements (POC-Optimized)
- **Response Time**: <500ms for validation responses
- **POC Scale**: Support ~20 simultaneous ticket sessions maximum
- **Turn Efficiency**: ≥95% of tickets valid within 2 update turns
- **Geometry Generation**: <2 seconds for complex geofence construction
- **File Operations**: <100ms for JSON read/write operations

## Approach - Simplified JSON Persistence

### Data Storage Approach

**Selected: JSON File Persistence with Redis Sessions**
- **Pros**: Simple deployment, no database migrations, easy debugging, perfect for POC scale
- **Cons**: Limited concurrent access, manual data management
- **POC Rationale**: With ~20 records maximum, JSON persistence provides simplicity and transparency needed for demonstration without database overhead

### Session Management Approach

**Option A: JSON-Only Sessions**
- Pros: Single storage system, simple implementation
- Cons: File I/O for every session update, potential conflicts

**Option B: Redis Sessions with JSON Persistence** (Selected)
- Pros: Fast updates, reduced file I/O, natural TTL support, easy CustomGPT integration
- Cons: Additional infrastructure requirement
- **POC Rationale**: Redis provides excellent multi-turn session support for CustomGPT interactions while JSON handles long-term storage

**Option C: In-Memory Sessions**
- Pros: Fastest performance, simple implementation  
- Cons: No persistence, lost on restart

### Geocoding Service Selection

**Option A: Google Maps Geocoding API**
- Pros: High accuracy, extensive coverage, address validation
- Cons: Cost at scale, usage limits

**Option B: Mapbox Geocoding** (Selected)
- Pros: Good accuracy, reasonable pricing, sufficient for Texas
- Cons: Less comprehensive than Google for rural areas

**Option C: OpenStreetMap Nominatim**
- Pros: Free, open source, no usage limits
- Cons: Lower accuracy, slower, less reliable

**Rationale:** Mapbox offers the best balance of accuracy, cost, and API features for POC needs. Can switch to Google for production if higher accuracy needed.

### Geometry Construction Approach

**Option A: PostGIS Database Functions**
- Pros: Powerful spatial operations, validated geometries
- Cons: Database dependency (eliminated in this architecture)

**Option B: Shapely Python Library** (Selected)
- Pros: Pure Python, extensive geometry operations, easy testing, no database required
- Cons: Additional dependency, coordinate system handling

**Option C: Custom Implementation**
- Pros: No dependencies, full control
- Cons: Complex to implement correctly, reinventing the wheel

**Rationale:** Shapely provides robust, well-tested geometry operations without any database dependency. Integrates perfectly with GeoJSON for API responses and JSON storage.

## External Dependencies

### Core Dependencies (Simplified)
- **FastAPI** (0.104.1) - High-performance web framework with automatic OpenAPI docs
- **Pydantic** (2.5.0) - Data validation using Python type hints
- **Redis** (5.0.1) - Session cache for multi-turn CustomGPT interactions

### GIS/Mapping Dependencies
- **Shapely** (2.0.2) - Geometric operations and validation
- **geopy** (2.4.1) - Geocoding service abstractions
- **mapbox** (0.18.1) - Mapbox API client for geocoding

### Utility Dependencies
- **python-dateutil** (2.8.2) - Business day calculations
- **holidays** (0.35) - Texas holiday calendar
- **python-multipart** (0.0.6) - File upload support
- **httpx** (0.25.2) - Async HTTP client for external APIs

### Development Dependencies
- **pytest** (7.4.3) - Testing framework
- **black** (23.11.0) - Code formatting
- **ruff** (0.1.6) - Fast Python linter
- **mypy** (1.7.1) - Static type checking

### Removed Dependencies
- **SQLAlchemy** - Eliminated with database removal
- **Alembic** - No migrations needed with JSON storage
- **pyproj** - Coordinate transformations handled by Shapely
- **pytest-asyncio** - Reduced async complexity

## Data Storage Patterns

### JSON File Structure
```json
{
  "tickets": {
    "ticket_123": {
      "id": "ticket_123",
      "status": "draft|submitted|completed",
      "created_at": "2025-08-31T10:00:00Z",
      "updated_at": "2025-08-31T10:30:00Z",
      "caller_info": { ... },
      "excavator_info": { ... },
      "work_details": { ... },
      "location_data": { ... },
      "gis_geometry": { ... },
      "compliance_dates": { ... },
      "validation_history": [ ... ],
      "submission_packet": { ... }
    }
  },
  "metadata": {
    "version": "1.0.0",
    "last_updated": "2025-08-31T10:30:00Z",
    "ticket_count": 1
  }
}
```

### File Management Strategy
- **Single JSON File**: `data/tickets.json` for all ticket storage
- **Atomic Updates**: Write to temporary file, then rename for consistency
- **Backup Strategy**: Daily snapshots for Railway container persistence
- **File Locking**: Simple file-based locking for concurrent access prevention

### Session Storage (Redis)
- **Key Pattern**: `session:{session_id}` for active CustomGPT sessions
- **TTL**: 24 hours for automatic cleanup
- **Data**: Current ticket draft and validation state
- **Persistence**: Flushed to JSON when session completes

## Configuration Management

### Environment Variables
```
# API Configuration
API_PORT=8000
API_KEY_HEADER=X-API-Key
ALLOWED_API_KEYS=comma,separated,keys

# Storage
DATA_DIR=./data
TICKETS_FILE=tickets.json
BACKUP_RETENTION_DAYS=7
REDIS_URL=redis://localhost:6379

# Geocoding
MAPBOX_ACCESS_TOKEN=your_token_here
GEOCODING_TIMEOUT=5
DEFAULT_CONFIDENCE_THRESHOLD=0.7

# GIS Defaults
DEFAULT_BOX_SIZE_FT=25
MAX_LINE_BUFFER_LENGTH_FT=5000
COORDINATE_PRECISION=6

# Compliance
BUSINESS_DAYS_WAIT=2
TICKET_VALIDITY_DAYS=14
ENABLE_TEXAS_HOLIDAYS=true
EXPIRING_THRESHOLD_DAYS=3

# Session Management
SESSION_TTL_HOURS=24
MAX_SESSION_SIZE_KB=100

# POC Limits
MAX_TICKETS=20
MAX_FILE_SIZE_MB=50
```

### Feature Flags
- `STRICT_VALIDATION_MODE`: Enforce all recommended fields as required
- `AUTO_GEOMETRY_GENERATION`: Automatically create geometry from instructions
- `ENABLE_AUDIT_LOGGING`: Track all field changes and state transitions
- `MOCK_GEOCODING`: Use mock geocoder for testing
- `ENABLE_FILE_BACKUPS`: Create daily JSON backups

## Railway Deployment Considerations

### Container Lifecycle
- **Startup**: Initialize data directory and load existing tickets.json
- **Runtime**: All changes persist to JSON file immediately
- **Shutdown**: Redis sessions saved to JSON before container stops
- **Restart**: Reload tickets from JSON, Redis sessions naturally expire

### Volume Strategy
- **Persistent Volume**: Mount `/app/data` for ticket storage
- **Backup Schedule**: Daily snapshot uploads to Railway volume
- **Recovery**: Simple JSON file restoration on new deployments

### Resource Optimization
- **Memory**: Minimal requirements with JSON storage (~50MB for 20 tickets)
- **CPU**: Low overhead without database operations
- **Storage**: <1GB for complete POC dataset including backups

## Security Considerations

### API Security
- API key authentication for CustomGPT endpoints
- Rate limiting per API key (100 requests/minute)
- Input sanitization for all text fields
- File system access controls for JSON storage

### Data Protection
- No PII in logs (phone numbers, emails masked)
- Audit trail includes actor but not sensitive data
- Geometry coordinates rounded to 6 decimal places
- Session data encrypted at rest in Redis
- JSON file permissions restricted to application user

### File System Security
- Data directory isolated from application code
- Atomic write operations prevent corruption
- File locking prevents concurrent modification conflicts
- Regular backup validation ensures data integrity

### POC Security Notes
- JSON file access limited to application container
- No external database connections to secure
- Simplified attack surface with fewer dependencies
- Easy to audit and debug with plain-text JSON storage