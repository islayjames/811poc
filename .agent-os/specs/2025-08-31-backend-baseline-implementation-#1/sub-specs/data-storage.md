# Data Storage Strategy

This is the data storage implementation for the spec detailed in @.agent-os/specs/2025-08-31-backend-baseline-implementation-#1/spec.md

> Created: 2025-08-31
> Version: 2.0.0

## Storage Overview

The POC uses JSON file persistence for simplicity and Railway deployment compatibility. Core data includes tickets, sessions, audit trails, and configuration. The storage strategy optimizes for ~20 tickets maximum with simple file operations, atomic writes, and basic backup strategies. Redis provides session management for CustomGPT multi-turn conversations.

## JSON Data Structure

### Core Data Models

#### Ticket Data Model
Complete ticket representation with all Texas811 fields and processing state:

```python
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid

class TicketStatus(str, Enum):
    DRAFT = "Draft"
    EXTRACTING = "Extracting" 
    VALIDATING_FIELDS = "ValidatingFields"
    VALID_PENDING_CONFIRM = "ValidPendingConfirm"
    READY = "Ready"
    SUBMITTED = "Submitted"
    RESPONSES_IN = "ResponsesIn"
    READY_TO_DIG = "ReadyToDig"
    EXPIRING = "Expiring"
    EXPIRED = "Expired"
    CANCELLED = "Cancelled"
    DAMAGED = "Damaged"

class TicketType(str, Enum):
    NORMAL = "Normal"
    EMERGENCY = "Emergency"
    NO_RESPONSE = "No Response"
    UPDATE = "Update"
    UPDATE_REMARK = "Update & Remark"
    DIG_UP = "Dig Up"
    DEMOLITION = "Demolition"

class GPSCoordinate(BaseModel):
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    source: Optional[str] = Field(None, description="geocoded, manual, extracted")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)

class Geometry(BaseModel):
    geometry_type: str = Field(..., description="Point, Polygon, LineBuffer, Circle")
    geojson: Dict[str, Any] = Field(..., description="GeoJSON geometry object")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    geometry_source: Optional[str] = Field(None, description="extracted, geocoded, manual, GPS")
    assumptions: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    area_square_feet: Optional[float] = None
    buffer_distance_feet: Optional[float] = None

class ValidationGap(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str = Field(..., description="required_field, validation_rule, business_rule, compliance_check")
    field: str = Field(..., description="Field name with the gap")
    problem: str = Field(..., description="Description of the problem")
    severity: str = Field(..., description="required, recommended, warning")
    suggested_prompt: Optional[str] = None
    suggested_values: List[str] = Field(default_factory=list)
    user_friendly_description: Optional[str] = None
    help_text: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None
    resolution_method: Optional[str] = None

class MemberResponse(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    member_code: str = Field(..., max_length=10)
    member_name: str = Field(..., max_length=200)
    response_type: str = Field(..., description="Positive, Negative, Standby, Clear, Damaged")
    response_date: datetime
    response_text: Optional[str] = None
    marking_color: Optional[str] = None
    marking_instructions: Optional[str] = None
    clearance_granted: bool = False
    requires_standby: bool = False
    standby_contact: Optional[str] = None
    standby_phone: Optional[str] = None
    special_instructions: Optional[str] = None
    received_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = None

class Ticket(BaseModel):
    # System Fields
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: TicketStatus = TicketStatus.DRAFT
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Work Order Source
    work_order_ref: Optional[str] = Field(None, max_length=100)
    work_order_filename: Optional[str] = Field(None, max_length=255)
    extraction_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    extraction_warnings: List[str] = Field(default_factory=list)
    
    # Ticket Classification
    ticket_type: TicketType = TicketType.NORMAL
    priority_level: str = Field(default="Standard", description="Standard, Rush, Emergency")
    
    # Critical Timestamps
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    earliest_lawful_start: Optional[datetime] = None
    positive_response_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    marking_expires_at: Optional[datetime] = None
    
    # Section A: Excavator Information
    company: str = Field(..., max_length=200, description="Required excavator company name")
    contact_name: str = Field(..., max_length=100, description="Required primary contact name")
    phone: str = Field(..., min_length=10, max_length=20, description="Required phone number")
    phone_extension: Optional[str] = Field(None, max_length=10)
    email: Optional[str] = Field(None, max_length=100)
    address_line_1: Optional[str] = Field(None, max_length=200)
    address_line_2: Optional[str] = Field(None, max_length=200)
    city_state_zip: Optional[str] = Field(None, max_length=200)
    
    # Section A: Onsite Contact (if different)
    onsite_contact_name: Optional[str] = Field(None, max_length=100)
    onsite_phone: Optional[str] = Field(None, max_length=20)
    onsite_phone_extension: Optional[str] = Field(None, max_length=10)
    
    # Section B: Work Information
    work_for: Optional[str] = Field(None, max_length=200)
    work_for_phone: Optional[str] = Field(None, max_length=20)
    type_of_work: str = Field(..., description="Required work description")
    work_category: Optional[str] = Field(None, max_length=50)
    is_trenchless: bool = False
    is_blasting: bool = False
    is_boring: bool = False
    depth_inches: Optional[int] = None
    depth_description: Optional[str] = Field(None, max_length=100)
    duration_days: Optional[int] = None
    duration_description: Optional[str] = Field(None, max_length=200)
    
    # Section C: Excavation Site Information
    county: str = Field(..., max_length=100, description="Required Texas county")
    city: str = Field(..., max_length=100, description="Required city name")
    address: Optional[str] = None
    cross_street: Optional[str] = Field(None, max_length=200)
    subdivision: Optional[str] = Field(None, max_length=200)
    lot_block: Optional[str] = Field(None, max_length=100)
    section_township_range: Optional[str] = Field(None, max_length=100)
    driving_directions: Optional[str] = None
    work_area_description: str = Field(..., description="Required work area description")
    nearest_intersection: Optional[str] = Field(None, max_length=200)
    
    # Section C: GPS and Location
    gps_coordinates: Optional[GPSCoordinate] = None
    geometry: Optional[Geometry] = None
    
    # Section C: Asset Information
    pole_id: Optional[str] = Field(None, max_length=50)
    transformer_id: Optional[str] = Field(None, max_length=50)
    meter_number: Optional[str] = Field(None, max_length=50)
    service_address: Optional[str] = None
    additional_references: Optional[str] = None
    
    # Section D: Geometry and Marking
    work_area_size_description: Optional[str] = Field(None, max_length=200)
    marking_instructions: Optional[str] = None
    white_lines_painted: bool = False
    
    # Section E: Special Conditions
    emergency_justification: Optional[str] = None
    damage_claim_number: Optional[str] = Field(None, max_length=50)
    previous_ticket_number: Optional[str] = Field(None, max_length=50)
    continuation_reference: Optional[str] = Field(None, max_length=100)
    
    # Validation State
    validation_status: str = Field(default="Invalid", description="Invalid, Valid, Warning")
    validation_gaps: List[ValidationGap] = Field(default_factory=list)
    gap_count: int = Field(default=0)
    last_validated_at: Optional[datetime] = None
    
    # Texas811 Response Tracking
    response_status: str = Field(default="Pending", description="Pending, Partial, Complete, No Response, Damaged")
    texas811_ticket_number: Optional[str] = Field(None, max_length=50)
    submission_confirmation: Optional[str] = Field(None, max_length=100)
    member_responses: List[MemberResponse] = Field(default_factory=list)
    
    @validator('phone', 'onsite_phone', 'work_for_phone')
    def validate_phone(cls, v):
        if v and len(v.replace('-', '').replace('(', '').replace(')', '').replace(' ', '')) < 10:
            raise ValueError('Phone number must be at least 10 digits')
        return v
    
    @validator('email')
    def validate_email(cls, v):
        if v and '@' not in v:
            raise ValueError('Invalid email format')
        return v
    
    @validator('emergency_justification')
    def validate_emergency_justification(cls, v, values):
        if values.get('ticket_type') == TicketType.EMERGENCY and not v:
            raise ValueError('Emergency justification required for emergency tickets')
        return v

    def update_timestamp(self):
        """Update the updated_at timestamp"""
        self.updated_at = datetime.utcnow()
        
    def calculate_gap_count(self):
        """Update gap_count based on current validation_gaps"""
        self.gap_count = len([gap for gap in self.validation_gaps if not gap.resolved_at])
```

#### Session Data Model
CustomGPT conversation state and context:

```python
class ConversationState(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused" 
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    ERROR = "error"

class TicketSession(BaseModel):
    session_key: str = Field(..., description="Unique session identifier")
    ticket_id: Optional[str] = None
    
    # Session Data
    session_data: Dict[str, Any] = Field(default_factory=dict, description="Custom session context")
    conversation_state: ConversationState = ConversationState.ACTIVE
    
    # Context Tracking
    current_step: Optional[str] = None
    completed_steps: List[str] = Field(default_factory=list)
    pending_validations: List[str] = Field(default_factory=list)
    
    # Conversation History
    messages: List[Dict[str, Any]] = Field(default_factory=list, description="Message history")
    extraction_results: Dict[str, Any] = Field(default_factory=dict, description="Last extraction results")
    
    # Timestamps
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity_at: datetime = Field(default_factory=datetime.utcnow)
    
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def is_expired(self) -> bool:
        """Check if session is expired"""
        return datetime.utcnow() > self.expires_at
```

#### Audit Trail Model
Comprehensive audit logging for compliance:

```python
class AuditEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket_id: Optional[str] = None
    
    # Event Details
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    actor: str = Field(..., description="CustomGPT, User, System, Texas811Portal")
    action: str = Field(..., description="Action performed")
    
    # State Changes
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    
    # Field Changes
    changed_fields: List[str] = Field(default_factory=list)
    field_changes: Dict[str, Any] = Field(default_factory=dict, description="Before/after values")
    
    # Context
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    notes: Optional[str] = None
    
    # Compliance
    compliance_relevant: bool = False
    legal_hold: bool = False
```

## File Storage Strategy

### Directory Structure

```
data/
├── tickets/
│   ├── ticket_001.json          # Individual ticket files
│   ├── ticket_002.json
│   └── index.json               # Ticket index for quick lookups
├── sessions/
│   ├── session_abc123.json      # Active session files
│   └── expired/                 # Expired sessions (for cleanup)
├── audit/
│   ├── 2025-08/                 # Monthly audit directories
│   │   ├── audit_20250831.json  # Daily audit logs
│   │   └── audit_20250830.json
│   └── index.json               # Audit index
├── config/
│   ├── system_config.json       # System configuration
│   ├── api_keys.json            # API key storage (hashed)
│   └── rate_limits.json         # Rate limiting data
└── backups/
    ├── daily/
    │   └── backup_20250831.tar.gz
    └── metadata.json            # Backup metadata
```

### File Organization Patterns

```python
class DataPaths:
    BASE_DIR = "data"
    TICKETS_DIR = f"{BASE_DIR}/tickets"
    SESSIONS_DIR = f"{BASE_DIR}/sessions"
    AUDIT_DIR = f"{BASE_DIR}/audit"
    CONFIG_DIR = f"{BASE_DIR}/config"
    BACKUPS_DIR = f"{BASE_DIR}/backups"
    
    @staticmethod
    def ticket_file(ticket_id: str) -> str:
        return f"{DataPaths.TICKETS_DIR}/ticket_{ticket_id}.json"
    
    @staticmethod
    def session_file(session_key: str) -> str:
        return f"{DataPaths.SESSIONS_DIR}/session_{session_key}.json"
    
    @staticmethod
    def audit_file(date: datetime) -> str:
        year_month = date.strftime("%Y-%m")
        day = date.strftime("%Y%m%d")
        return f"{DataPaths.AUDIT_DIR}/{year_month}/audit_{day}.json"
    
    @staticmethod
    def ensure_directories():
        """Create all necessary directories"""
        import os
        for directory in [
            DataPaths.TICKETS_DIR, DataPaths.SESSIONS_DIR,
            DataPaths.AUDIT_DIR, DataPaths.CONFIG_DIR, DataPaths.BACKUPS_DIR
        ]:
            os.makedirs(directory, exist_ok=True)
```

## Data Validation

### Pydantic Models for Type Safety

Complete validation without database constraints:

```python
from pydantic import BaseModel, validator, Field
from typing import List, Dict, Optional, Any
import re

class TicketValidator:
    """Comprehensive ticket validation without database dependencies"""
    
    @staticmethod
    def validate_required_fields(ticket: Ticket) -> List[ValidationGap]:
        """Validate all required fields for Texas811 compliance"""
        gaps = []
        
        # Required fields validation
        required_fields = [
            ('company', 'Excavator company name required'),
            ('contact_name', 'Primary contact name required'),
            ('phone', 'Phone number required'),
            ('type_of_work', 'Work description required'),
            ('county', 'Texas county required'),
            ('city', 'City name required'),
            ('work_area_description', 'Work area description required')
        ]
        
        for field, message in required_fields:
            value = getattr(ticket, field, None)
            if not value or (isinstance(value, str) and not value.strip()):
                gaps.append(ValidationGap(
                    category="required_field",
                    field=field,
                    problem="field_missing",
                    severity="required",
                    user_friendly_description=message
                ))
        
        return gaps
    
    @staticmethod
    def validate_business_rules(ticket: Ticket) -> List[ValidationGap]:
        """Validate business rules and compliance requirements"""
        gaps = []
        
        # Location requirement: address OR GPS required
        if not ticket.address and not ticket.gps_coordinates:
            gaps.append(ValidationGap(
                category="business_rule",
                field="location",
                problem="address_or_gps_required",
                severity="required",
                user_friendly_description="Either street address OR GPS coordinates required",
                suggested_prompt="Please provide either a street address or GPS coordinates for the work location."
            ))
        
        # Emergency justification
        if ticket.ticket_type == TicketType.EMERGENCY and not ticket.emergency_justification:
            gaps.append(ValidationGap(
                category="compliance_check",
                field="emergency_justification",
                problem="justification_required",
                severity="required",
                user_friendly_description="Emergency tickets require justification",
                suggested_prompt="Please provide justification for why this is an emergency ticket."
            ))
        
        # Phone number format
        if ticket.phone:
            digits = re.sub(r'[^0-9]', '', ticket.phone)
            if len(digits) < 10:
                gaps.append(ValidationGap(
                    category="validation_rule",
                    field="phone",
                    problem="invalid_format",
                    severity="required",
                    user_friendly_description="Phone number must be at least 10 digits"
                ))
        
        return gaps
    
    @staticmethod
    def validate_full_ticket(ticket: Ticket) -> List[ValidationGap]:
        """Complete ticket validation"""
        all_gaps = []
        all_gaps.extend(TicketValidator.validate_required_fields(ticket))
        all_gaps.extend(TicketValidator.validate_business_rules(ticket))
        
        return all_gaps

# Custom validators for common patterns
class TexasValidator:
    """Texas-specific validation rules"""
    
    TEXAS_COUNTIES = [
        "Anderson", "Andrews", "Angelina", "Aransas", "Archer", "Armstrong",
        "Atascosa", "Austin", "Bailey", "Bandera", "Bastrop", "Baylor",
        # ... (full list of 254 Texas counties)
        "Zavala"
    ]
    
    @staticmethod
    def validate_county(county: str) -> bool:
        """Validate Texas county name"""
        return county in TexasValidator.TEXAS_COUNTIES
    
    @staticmethod
    def validate_gps_in_texas(lat: float, lng: float) -> bool:
        """Validate GPS coordinates are within Texas boundaries"""
        # Texas rough bounding box
        return (25.8 <= lat <= 36.5) and (-106.6 <= lng <= -93.5)
```

## Session Management

### Redis Structure for Multi-Turn Conversations

Integration with Redis for CustomGPT session persistence:

```python
import redis
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

class SessionManager:
    """Redis-backed session management for CustomGPT integration"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        self.session_prefix = "texas811:session:"
        self.default_expiry = timedelta(hours=4)  # 4 hour sessions
    
    def create_session(self, session_key: str, ticket_id: Optional[str] = None) -> TicketSession:
        """Create new session with expiration"""
        session = TicketSession(
            session_key=session_key,
            ticket_id=ticket_id,
            expires_at=datetime.utcnow() + self.default_expiry
        )
        
        self._save_session(session)
        return session
    
    def get_session(self, session_key: str) -> Optional[TicketSession]:
        """Retrieve session from Redis with fallback to JSON file"""
        redis_key = f"{self.session_prefix}{session_key}"
        
        try:
            # Try Redis first
            session_data = self.redis_client.get(redis_key)
            if session_data:
                data = json.loads(session_data)
                session = TicketSession(**data)
                
                # Check expiration
                if session.is_expired():
                    self.delete_session(session_key)
                    return None
                
                return session
        except Exception as e:
            print(f"Redis error, falling back to file: {e}")
        
        # Fallback to JSON file
        return self._load_session_from_file(session_key)
    
    def update_session(self, session: TicketSession) -> bool:
        """Update session in both Redis and file backup"""
        session.update_activity()
        
        try:
            self._save_session(session)
            self._save_session_file(session)
            return True
        except Exception as e:
            print(f"Session update error: {e}")
            return False
    
    def delete_session(self, session_key: str) -> bool:
        """Remove session from Redis and move file to expired"""
        redis_key = f"{self.session_prefix}{session_key}"
        
        try:
            # Remove from Redis
            self.redis_client.delete(redis_key)
            
            # Move file to expired folder
            self._move_to_expired(session_key)
            return True
        except Exception as e:
            print(f"Session deletion error: {e}")
            return False
    
    def extend_session(self, session_key: str, additional_time: timedelta = None) -> bool:
        """Extend session expiration time"""
        session = self.get_session(session_key)
        if not session:
            return False
        
        extension = additional_time or self.default_expiry
        session.expires_at = datetime.utcnow() + extension
        
        return self.update_session(session)
    
    def cleanup_expired_sessions(self) -> int:
        """Remove expired sessions and return count"""
        # This would be called by a background task
        expired_count = 0
        
        try:
            # Get all session keys
            pattern = f"{self.session_prefix}*"
            session_keys = self.redis_client.keys(pattern)
            
            for key in session_keys:
                session_data = self.redis_client.get(key)
                if session_data:
                    data = json.loads(session_data)
                    session = TicketSession(**data)
                    
                    if session.is_expired():
                        session_key = key.replace(self.session_prefix, "")
                        self.delete_session(session_key)
                        expired_count += 1
        except Exception as e:
            print(f"Session cleanup error: {e}")
        
        return expired_count
    
    def _save_session(self, session: TicketSession):
        """Save session to Redis with TTL"""
        redis_key = f"{self.session_prefix}{session.session_key}"
        session_json = session.json()
        
        # Calculate TTL in seconds
        ttl_seconds = int((session.expires_at - datetime.utcnow()).total_seconds())
        if ttl_seconds > 0:
            self.redis_client.setex(redis_key, ttl_seconds, session_json)
    
    def _save_session_file(self, session: TicketSession):
        """Backup session to JSON file"""
        file_path = DataPaths.session_file(session.session_key)
        with open(file_path, 'w') as f:
            f.write(session.json(indent=2))
    
    def _load_session_from_file(self, session_key: str) -> Optional[TicketSession]:
        """Load session from JSON file backup"""
        file_path = DataPaths.session_file(session_key)
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
                session = TicketSession(**data)
                
                if session.is_expired():
                    self._move_to_expired(session_key)
                    return None
                
                return session
        except FileNotFoundError:
            return None
        except Exception as e:
            print(f"File session load error: {e}")
            return None
    
    def _move_to_expired(self, session_key: str):
        """Move expired session file to expired directory"""
        import os
        import shutil
        
        source = DataPaths.session_file(session_key)
        expired_dir = f"{DataPaths.SESSIONS_DIR}/expired"
        os.makedirs(expired_dir, exist_ok=True)
        
        if os.path.exists(source):
            dest = f"{expired_dir}/session_{session_key}.json"
            try:
                shutil.move(source, dest)
            except Exception as e:
                print(f"Error moving expired session: {e}")
```

## Persistence Patterns

### Load/Save Operations and Error Handling

Atomic file operations with comprehensive error handling:

```python
import json
import os
import tempfile
import shutil
from typing import Optional, List, Dict, Any
from datetime import datetime
import fcntl  # For file locking on Unix systems

class DataPersistence:
    """Atomic file operations for JSON data with comprehensive error handling"""
    
    @staticmethod
    def save_ticket(ticket: Ticket) -> bool:
        """Atomically save ticket to JSON file"""
        file_path = DataPaths.ticket_file(ticket.id)
        
        try:
            # Update timestamp
            ticket.update_timestamp()
            
            # Atomic write using temporary file
            return DataPersistence._atomic_write(file_path, ticket.dict())
        except Exception as e:
            print(f"Error saving ticket {ticket.id}: {e}")
            return False
    
    @staticmethod
    def load_ticket(ticket_id: str) -> Optional[Ticket]:
        """Load ticket from JSON file with error handling"""
        file_path = DataPaths.ticket_file(ticket_id)
        
        try:
            with open(file_path, 'r') as f:
                # Optional file locking for concurrent access
                fcntl.flock(f.fileno(), fcntl.LOCK_SH)  # Shared lock for reading
                data = json.load(f)
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)  # Unlock
                
            return Ticket(**data)
        except FileNotFoundError:
            return None
        except json.JSONDecodeError as e:
            print(f"JSON decode error for ticket {ticket_id}: {e}")
            return None
        except Exception as e:
            print(f"Error loading ticket {ticket_id}: {e}")
            return None
    
    @staticmethod
    def list_tickets() -> List[Dict[str, Any]]:
        """List all tickets with basic metadata"""
        tickets_dir = DataPaths.TICKETS_DIR
        ticket_list = []
        
        try:
            if not os.path.exists(tickets_dir):
                return []
            
            for filename in os.listdir(tickets_dir):
                if filename.startswith('ticket_') and filename.endswith('.json'):
                    ticket_id = filename.replace('ticket_', '').replace('.json', '')
                    file_path = os.path.join(tickets_dir, filename)
                    
                    try:
                        stat = os.stat(file_path)
                        
                        # Load minimal ticket data for listing
                        with open(file_path, 'r') as f:
                            data = json.load(f)
                        
                        ticket_list.append({
                            'id': ticket_id,
                            'status': data.get('status', 'Unknown'),
                            'company': data.get('company', 'Unknown'),
                            'county': data.get('county', 'Unknown'),
                            'updated_at': data.get('updated_at'),
                            'file_size': stat.st_size,
                            'modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
                        })
                    except Exception as e:
                        print(f"Error reading ticket {filename}: {e}")
                        continue
            
        except Exception as e:
            print(f"Error listing tickets: {e}")
        
        return sorted(ticket_list, key=lambda x: x['updated_at'], reverse=True)
    
    @staticmethod
    def save_audit_event(event: AuditEvent) -> bool:
        """Save audit event to daily log file"""
        file_path = DataPaths.audit_file(event.timestamp)
        
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            # Append to daily audit log
            return DataPersistence._append_to_json_array(file_path, event.dict())
        except Exception as e:
            print(f"Error saving audit event: {e}")
            return False
    
    @staticmethod
    def load_audit_events(date: datetime, ticket_id: Optional[str] = None) -> List[AuditEvent]:
        """Load audit events for a specific date, optionally filtered by ticket"""
        file_path = DataPaths.audit_file(date)
        events = []
        
        try:
            if not os.path.exists(file_path):
                return []
            
            with open(file_path, 'r') as f:
                data = json.load(f)
                
            for event_data in data:
                event = AuditEvent(**event_data)
                if not ticket_id or event.ticket_id == ticket_id:
                    events.append(event)
                    
        except Exception as e:
            print(f"Error loading audit events: {e}")
        
        return events
    
    @staticmethod
    def _atomic_write(file_path: str, data: Dict[str, Any]) -> bool:
        """Atomic write using temporary file and rename"""
        directory = os.path.dirname(file_path)
        os.makedirs(directory, exist_ok=True)
        
        try:
            # Create temporary file in same directory
            with tempfile.NamedTemporaryFile(
                mode='w', 
                dir=directory, 
                delete=False,
                suffix='.tmp'
            ) as temp_file:
                json.dump(data, temp_file, indent=2, default=str)
                temp_file.flush()
                os.fsync(temp_file.fileno())  # Force write to disk
                temp_path = temp_file.name
            
            # Atomic rename
            shutil.move(temp_path, file_path)
            return True
            
        except Exception as e:
            # Clean up temp file if it exists
            if 'temp_path' in locals() and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except:
                    pass
            print(f"Atomic write error: {e}")
            return False
    
    @staticmethod
    def _append_to_json_array(file_path: str, new_data: Dict[str, Any]) -> bool:
        """Safely append to JSON array file"""
        try:
            # Load existing data or create empty array
            if os.path.exists(file_path):
                with open(file_path, 'r') as f:
                    fcntl.flock(f.fileno(), fcntl.LOCK_EX)  # Exclusive lock
                    try:
                        existing_data = json.load(f)
                    except json.JSONDecodeError:
                        existing_data = []
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
            else:
                existing_data = []
            
            # Append new data
            existing_data.append(new_data)
            
            # Atomic write back
            return DataPersistence._atomic_write(file_path, existing_data)
            
        except Exception as e:
            print(f"Append to JSON array error: {e}")
            return False

# Utility functions for common operations
class TicketOperations:
    """High-level operations for ticket management"""
    
    @staticmethod
    def create_ticket(work_order_data: Dict[str, Any]) -> Optional[Ticket]:
        """Create new ticket from work order extraction"""
        try:
            ticket = Ticket(**work_order_data)
            
            # Run validation
            gaps = TicketValidator.validate_full_ticket(ticket)
            ticket.validation_gaps = gaps
            ticket.gap_count = len(gaps)
            ticket.validation_status = "Invalid" if gaps else "Valid"
            ticket.last_validated_at = datetime.utcnow()
            
            # Save ticket
            if DataPersistence.save_ticket(ticket):
                # Log audit event
                audit_event = AuditEvent(
                    ticket_id=ticket.id,
                    actor="CustomGPT",
                    action="ticket_created",
                    to_status=ticket.status.value,
                    notes=f"Created from work order: {ticket.work_order_filename}"
                )
                DataPersistence.save_audit_event(audit_event)
                
                return ticket
            else:
                return None
                
        except Exception as e:
            print(f"Error creating ticket: {e}")
            return None
    
    @staticmethod
    def update_ticket_status(ticket_id: str, new_status: TicketStatus, notes: Optional[str] = None) -> bool:
        """Update ticket status with audit logging"""
        ticket = DataPersistence.load_ticket(ticket_id)
        if not ticket:
            return False
        
        old_status = ticket.status
        ticket.status = new_status
        
        # Save updated ticket
        if DataPersistence.save_ticket(ticket):
            # Log audit event
            audit_event = AuditEvent(
                ticket_id=ticket_id,
                actor="System",
                action="status_changed",
                from_status=old_status.value,
                to_status=new_status.value,
                notes=notes
            )
            DataPersistence.save_audit_event(audit_event)
            return True
        
        return False
```

## Railway Deployment

### Container-Friendly File Storage

Optimizations for Railway's ephemeral container environment:

```python
import os
from typing import Dict, Any

class RailwayStorage:
    """Railway-specific storage configuration and handling"""
    
    @staticmethod
    def get_data_directory() -> str:
        """Get appropriate data directory for Railway deployment"""
        # Use Railway's persistent volume if available, otherwise /tmp
        railway_volume = os.environ.get('RAILWAY_VOLUME_MOUNT_PATH')
        if railway_volume and os.path.exists(railway_volume):
            return os.path.join(railway_volume, 'data')
        else:
            # Fallback to local data directory
            return './data'
    
    @staticmethod
    def setup_storage():
        """Initialize storage directories for Railway"""
        base_dir = RailwayStorage.get_data_directory()
        
        # Update DataPaths to use Railway directory
        DataPaths.BASE_DIR = base_dir
        DataPaths.TICKETS_DIR = f"{base_dir}/tickets"
        DataPaths.SESSIONS_DIR = f"{base_dir}/sessions"
        DataPaths.AUDIT_DIR = f"{base_dir}/audit"
        DataPaths.CONFIG_DIR = f"{base_dir}/config"
        DataPaths.BACKUPS_DIR = f"{base_dir}/backups"
        
        # Create all directories
        DataPaths.ensure_directories()
        
        print(f"Storage initialized at: {base_dir}")
    
    @staticmethod
    def get_storage_info() -> Dict[str, Any]:
        """Get storage utilization information"""
        base_dir = RailwayStorage.get_data_directory()
        
        try:
            # Get directory sizes
            def get_directory_size(path):
                total = 0
                if os.path.exists(path):
                    for dirpath, dirnames, filenames in os.walk(path):
                        for filename in filenames:
                            filepath = os.path.join(dirpath, filename)
                            if os.path.exists(filepath):
                                total += os.path.getsize(filepath)
                return total
            
            return {
                'base_directory': base_dir,
                'total_size_bytes': get_directory_size(base_dir),
                'tickets_size_bytes': get_directory_size(DataPaths.TICKETS_DIR),
                'sessions_size_bytes': get_directory_size(DataPaths.SESSIONS_DIR),
                'audit_size_bytes': get_directory_size(DataPaths.AUDIT_DIR),
                'config_size_bytes': get_directory_size(DataPaths.CONFIG_DIR),
                'backups_size_bytes': get_directory_size(DataPaths.BACKUPS_DIR),
                'ticket_count': len([f for f in os.listdir(DataPaths.TICKETS_DIR) 
                                   if f.startswith('ticket_') and f.endswith('.json')] 
                                  if os.path.exists(DataPaths.TICKETS_DIR) else []),
                'available': True
            }
        except Exception as e:
            return {
                'error': str(e),
                'available': False
            }

# Configuration for Railway environment
RAILWAY_CONFIG = {
    "redis_url": os.environ.get("REDIS_URL", "redis://localhost:6379"),
    "data_retention_days": int(os.environ.get("DATA_RETENTION_DAYS", "90")),
    "max_file_size_mb": int(os.environ.get("MAX_FILE_SIZE_MB", "10")),
    "backup_enabled": os.environ.get("BACKUP_ENABLED", "true").lower() == "true",
    "session_timeout_hours": int(os.environ.get("SESSION_TIMEOUT_HOURS", "4")),
    "audit_retention_months": int(os.environ.get("AUDIT_RETENTION_MONTHS", "12"))
}
```

## Backup and Recovery

### Simple Backup Strategies for POC

Lightweight backup and recovery for ~20 tickets:

```python
import tarfile
import gzip
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

class BackupManager:
    """Simple backup and recovery for POC data"""
    
    def __init__(self, retention_days: int = 30):
        self.retention_days = retention_days
        self.backup_dir = DataPaths.BACKUPS_DIR
    
    def create_daily_backup(self) -> Optional[str]:
        """Create compressed backup of all data"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"backup_{timestamp}.tar.gz"
        backup_path = os.path.join(self.backup_dir, "daily", backup_filename)
        
        try:
            # Ensure backup directory exists
            os.makedirs(os.path.dirname(backup_path), exist_ok=True)
            
            # Create compressed tar archive
            with tarfile.open(backup_path, "w:gz") as tar:
                # Add all data directories
                for directory in [
                    DataPaths.TICKETS_DIR,
                    DataPaths.SESSIONS_DIR,
                    DataPaths.AUDIT_DIR,
                    DataPaths.CONFIG_DIR
                ]:
                    if os.path.exists(directory):
                        tar.add(directory, arcname=os.path.basename(directory))
            
            # Update backup metadata
            self._update_backup_metadata(backup_filename, backup_path)
            
            print(f"Backup created: {backup_filename}")
            return backup_path
            
        except Exception as e:
            print(f"Backup creation failed: {e}")
            return None
    
    def restore_from_backup(self, backup_filename: str) -> bool:
        """Restore data from backup file"""
        backup_path = os.path.join(self.backup_dir, "daily", backup_filename)
        
        if not os.path.exists(backup_path):
            print(f"Backup file not found: {backup_filename}")
            return False
        
        try:
            # Create restore point before restoring
            restore_point = self.create_daily_backup()
            if restore_point:
                print(f"Restore point created: {os.path.basename(restore_point)}")
            
            # Extract backup to temporary location
            temp_restore_dir = f"{self.backup_dir}/temp_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            os.makedirs(temp_restore_dir, exist_ok=True)
            
            with tarfile.open(backup_path, "r:gz") as tar:
                tar.extractall(temp_restore_dir)
            
            # Move restored data to actual locations
            for directory in ["tickets", "sessions", "audit", "config"]:
                source = os.path.join(temp_restore_dir, directory)
                dest = getattr(DataPaths, f"{directory.upper()}_DIR")
                
                if os.path.exists(source):
                    # Remove existing directory
                    if os.path.exists(dest):
                        shutil.rmtree(dest)
                    
                    # Move restored directory
                    shutil.move(source, dest)
            
            # Clean up temporary directory
            shutil.rmtree(temp_restore_dir)
            
            print(f"Data restored from: {backup_filename}")
            return True
            
        except Exception as e:
            print(f"Restore failed: {e}")
            return False
    
    def list_backups(self) -> List[Dict[str, Any]]:
        """List available backups with metadata"""
        backups = []
        daily_backup_dir = os.path.join(self.backup_dir, "daily")
        
        if not os.path.exists(daily_backup_dir):
            return backups
        
        try:
            for filename in os.listdir(daily_backup_dir):
                if filename.startswith("backup_") and filename.endswith(".tar.gz"):
                    file_path = os.path.join(daily_backup_dir, filename)
                    stat = os.stat(file_path)
                    
                    # Extract timestamp from filename
                    timestamp_str = filename.replace("backup_", "").replace(".tar.gz", "")
                    try:
                        backup_time = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
                    except ValueError:
                        backup_time = datetime.fromtimestamp(stat.st_ctime)
                    
                    backups.append({
                        'filename': filename,
                        'size_bytes': stat.st_size,
                        'size_mb': round(stat.st_size / 1024 / 1024, 2),
                        'created': backup_time.isoformat(),
                        'age_days': (datetime.now() - backup_time).days
                    })
        except Exception as e:
            print(f"Error listing backups: {e}")
        
        return sorted(backups, key=lambda x: x['created'], reverse=True)
    
    def cleanup_old_backups(self) -> int:
        """Remove backups older than retention period"""
        removed_count = 0
        cutoff_date = datetime.now() - timedelta(days=self.retention_days)
        
        for backup in self.list_backups():
            backup_date = datetime.fromisoformat(backup['created'])
            if backup_date < cutoff_date:
                try:
                    file_path = os.path.join(self.backup_dir, "daily", backup['filename'])
                    os.remove(file_path)
                    removed_count += 1
                    print(f"Removed old backup: {backup['filename']}")
                except Exception as e:
                    print(f"Error removing backup {backup['filename']}: {e}")
        
        return removed_count
    
    def _update_backup_metadata(self, filename: str, file_path: str):
        """Update backup metadata file"""
        metadata_file = os.path.join(self.backup_dir, "metadata.json")
        
        try:
            # Load existing metadata
            if os.path.exists(metadata_file):
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
            else:
                metadata = {"backups": []}
            
            # Add new backup info
            stat = os.stat(file_path)
            backup_info = {
                "filename": filename,
                "created": datetime.now().isoformat(),
                "size_bytes": stat.st_size,
                "file_path": file_path
            }
            
            metadata["backups"].append(backup_info)
            metadata["last_backup"] = backup_info
            
            # Save updated metadata
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
                
        except Exception as e:
            print(f"Error updating backup metadata: {e}")

# Export/Import utilities for ticket data
class DataPortability:
    """Export and import utilities for ticket data"""
    
    @staticmethod
    def export_tickets_csv() -> str:
        """Export all tickets to CSV format"""
        import csv
        from io import StringIO
        
        output = StringIO()
        tickets = DataPersistence.list_tickets()
        
        if not tickets:
            return ""
        
        fieldnames = [
            'id', 'status', 'company', 'contact_name', 'phone', 
            'county', 'city', 'type_of_work', 'created_at', 'updated_at'
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for ticket_info in tickets:
            # Load full ticket for additional fields
            ticket = DataPersistence.load_ticket(ticket_info['id'])
            if ticket:
                row = {
                    'id': ticket.id,
                    'status': ticket.status.value,
                    'company': ticket.company,
                    'contact_name': ticket.contact_name,
                    'phone': ticket.phone,
                    'county': ticket.county,
                    'city': ticket.city,
                    'type_of_work': ticket.type_of_work,
                    'created_at': ticket.created_at.isoformat(),
                    'updated_at': ticket.updated_at.isoformat()
                }
                writer.writerow(row)
        
        return output.getvalue()
    
    @staticmethod
    def export_single_ticket_json(ticket_id: str) -> Optional[str]:
        """Export single ticket as formatted JSON"""
        ticket = DataPersistence.load_ticket(ticket_id)
        if ticket:
            return ticket.json(indent=2)
        return None
```

## Performance Considerations

### JSON File Operation Optimizations

Performance optimizations for small-scale operations:

```python
import json
import os
from typing import Dict, List, Any, Optional
from functools import lru_cache
from threading import RLock
import time

class PerformanceOptimizer:
    """Performance optimizations for JSON file operations"""
    
    def __init__(self):
        self.cache_lock = RLock()
        self.file_locks = {}
    
    @lru_cache(maxsize=50)
    def cached_ticket_load(self, ticket_id: str, cache_time: float) -> Optional[Ticket]:
        """Cache frequently accessed tickets with time-based invalidation"""
        # Cache is invalidated by including cache_time which changes periodically
        return DataPersistence.load_ticket(ticket_id)
    
    def invalidate_ticket_cache(self, ticket_id: str = None):
        """Invalidate cached ticket data"""
        if ticket_id:
            # Clear specific ticket from cache
            cache_keys_to_clear = [
                key for key in self.cached_ticket_load.cache_info()
                if key[0] == ticket_id
            ]
            for key in cache_keys_to_clear:
                self.cached_ticket_load.cache_clear()
        else:
            # Clear entire cache
            self.cached_ticket_load.cache_clear()
    
    def get_cached_ticket(self, ticket_id: str, cache_duration_seconds: int = 60) -> Optional[Ticket]:
        """Get ticket with time-based caching"""
        cache_time = int(time.time() / cache_duration_seconds)
        return self.cached_ticket_load(ticket_id, cache_time)
    
    def batch_load_tickets(self, ticket_ids: List[str]) -> Dict[str, Optional[Ticket]]:
        """Load multiple tickets efficiently"""
        results = {}
        
        # Use cached loading where possible
        for ticket_id in ticket_ids:
            try:
                results[ticket_id] = self.get_cached_ticket(ticket_id)
            except Exception as e:
                print(f"Error loading ticket {ticket_id}: {e}")
                results[ticket_id] = None
        
        return results
    
    def get_file_lock(self, file_path: str) -> RLock:
        """Get or create file-specific lock for concurrent access"""
        with self.cache_lock:
            if file_path not in self.file_locks:
                self.file_locks[file_path] = RLock()
            return self.file_locks[file_path]
    
    def optimized_ticket_search(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Optimized search through tickets without loading full data"""
        results = []
        tickets_dir = DataPaths.TICKETS_DIR
        
        if not os.path.exists(tickets_dir):
            return results
        
        try:
            for filename in os.listdir(tickets_dir):
                if not (filename.startswith('ticket_') and filename.endswith('.json')):
                    continue
                
                file_path = os.path.join(tickets_dir, filename)
                
                try:
                    # Quick metadata check first
                    stat = os.stat(file_path)
                    
                    # Skip files that are too old or too large for our filters
                    if 'max_age_days' in filters:
                        file_age_days = (time.time() - stat.st_mtime) / 86400
                        if file_age_days > filters['max_age_days']:
                            continue
                    
                    # Load and check specific fields
                    with open(file_path, 'r') as f:
                        # Read only the first part of the file for basic fields
                        partial_data = f.read(1024)  # First 1KB should contain basic fields
                        
                        # Try to parse partial JSON for quick filtering
                        try:
                            # This is a hack - in production, consider using streaming JSON parser
                            if 'status' in filters:
                                if f'"status": "{filters["status"]}"' not in partial_data:
                                    continue
                            
                            if 'county' in filters:
                                if f'"county": "{filters["county"]}"' not in partial_data:
                                    continue
                        except:
                            pass
                    
                    # If passed quick filters, load full ticket
                    ticket = DataPersistence.load_ticket(
                        filename.replace('ticket_', '').replace('.json', '')
                    )
                    
                    if ticket and self._matches_filters(ticket, filters):
                        results.append({
                            'id': ticket.id,
                            'status': ticket.status.value,
                            'company': ticket.company,
                            'county': ticket.county,
                            'city': ticket.city,
                            'updated_at': ticket.updated_at.isoformat()
                        })
                
                except Exception as e:
                    print(f"Error processing ticket {filename}: {e}")
                    continue
        
        except Exception as e:
            print(f"Error in ticket search: {e}")
        
        return results
    
    def _matches_filters(self, ticket: Ticket, filters: Dict[str, Any]) -> bool:
        """Check if ticket matches search filters"""
        for key, value in filters.items():
            if key == 'max_age_days':
                continue  # Already handled
            
            ticket_value = getattr(ticket, key, None)
            if ticket_value != value:
                return False
        
        return True

# Index management for faster lookups
class IndexManager:
    """Maintain indexes for faster ticket lookups"""
    
    def __init__(self):
        self.index_file = os.path.join(DataPaths.TICKETS_DIR, 'index.json')
        self.indexes = {
            'by_status': {},
            'by_county': {},
            'by_company': {},
            'by_updated_date': {}
        }
        self.load_indexes()
    
    def load_indexes(self):
        """Load existing indexes from file"""
        if os.path.exists(self.index_file):
            try:
                with open(self.index_file, 'r') as f:
                    self.indexes = json.load(f)
            except Exception as e:
                print(f"Error loading indexes: {e}")
                self.rebuild_indexes()
        else:
            self.rebuild_indexes()
    
    def rebuild_indexes(self):
        """Rebuild all indexes from ticket files"""
        self.indexes = {
            'by_status': {},
            'by_county': {},
            'by_company': {},
            'by_updated_date': {}
        }
        
        tickets_list = DataPersistence.list_tickets()
        
        for ticket_info in tickets_list:
            self.add_to_indexes(ticket_info)
        
        self.save_indexes()
    
    def add_to_indexes(self, ticket_info: Dict[str, Any]):
        """Add ticket to all relevant indexes"""
        ticket_id = ticket_info['id']
        
        # Status index
        status = ticket_info.get('status', 'Unknown')
        if status not in self.indexes['by_status']:
            self.indexes['by_status'][status] = []
        self.indexes['by_status'][status].append(ticket_id)
        
        # County index
        county = ticket_info.get('county', 'Unknown')
        if county not in self.indexes['by_county']:
            self.indexes['by_county'][county] = []
        self.indexes['by_county'][county].append(ticket_id)
        
        # Company index
        company = ticket_info.get('company', 'Unknown')
        if company not in self.indexes['by_company']:
            self.indexes['by_company'][company] = []
        self.indexes['by_company'][company].append(ticket_id)
        
        # Date index (by month)
        updated_at = ticket_info.get('updated_at')
        if updated_at:
            month_key = updated_at[:7]  # YYYY-MM format
            if month_key not in self.indexes['by_updated_date']:
                self.indexes['by_updated_date'][month_key] = []
            self.indexes['by_updated_date'][month_key].append(ticket_id)
    
    def remove_from_indexes(self, ticket_id: str):
        """Remove ticket from all indexes"""
        for index_name, index_data in self.indexes.items():
            for key, ticket_list in index_data.items():
                if ticket_id in ticket_list:
                    ticket_list.remove(ticket_id)
    
    def save_indexes(self):
        """Save indexes to file"""
        try:
            DataPersistence._atomic_write(self.index_file, self.indexes)
        except Exception as e:
            print(f"Error saving indexes: {e}")
    
    def find_tickets_by_status(self, status: str) -> List[str]:
        """Quick lookup of tickets by status"""
        return self.indexes['by_status'].get(status, [])
    
    def find_tickets_by_county(self, county: str) -> List[str]:
        """Quick lookup of tickets by county"""
        return self.indexes['by_county'].get(county, [])

# Global performance optimizer instance
performance_optimizer = PerformanceOptimizer()
index_manager = IndexManager()

# Configuration for performance tuning
PERFORMANCE_CONFIG = {
    "cache_duration_seconds": 60,
    "max_cached_tickets": 50,
    "batch_size_limit": 20,
    "file_size_warning_mb": 1,
    "index_rebuild_interval_hours": 24,
    "concurrent_file_limit": 10
}
```

---

This comprehensive data storage strategy provides:

1. **Simple JSON persistence** optimized for POC scale (~20 tickets)
2. **Robust validation** using Pydantic models without database dependencies  
3. **Redis session management** for CustomGPT multi-turn conversations
4. **Atomic file operations** with comprehensive error handling
5. **Railway deployment compatibility** with container-aware storage paths
6. **Basic backup/recovery** suitable for POC requirements
7. **Performance optimizations** including caching and indexing for small datasets

The design eliminates all database complexity while maintaining data integrity, compliance audit trails, and production-ready patterns that can scale if the POC succeeds.