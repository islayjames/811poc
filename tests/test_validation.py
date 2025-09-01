"""
Tests for Task 3: Core Validation Engine.

Following TDD approach for Task 3.1: Validation engine with gap detection,
iterative validation support, and conversational prompt generation.
"""

from datetime import UTC, datetime

import pytest

from texas811_poc.models import (
    TicketModel,
    TicketStatus,
    ValidationGapModel,
    ValidationSeverity,
)
from texas811_poc.validation import (
    FieldValidator,
    GapDetector,
    Texas811FieldValidator,
    ValidationCache,
    ValidationEngine,
    ValidationError,
    ValidationResult,
)


class TestValidationResult:
    """Test ValidationResult data structure."""

    def test_validation_result_creation(self):
        """Should create ValidationResult with required fields."""
        result = ValidationResult(
            is_valid=False, gaps=[], validated_fields=[], score=0.8
        )
        assert result.is_valid is False
        assert result.gaps == []
        assert result.validated_fields == []
        assert result.score == 0.8

    def test_validation_result_with_gaps(self):
        """Should create ValidationResult with validation gaps."""
        gaps = [
            ValidationGapModel(
                field_name="county",
                severity=ValidationSeverity.REQUIRED,
                message="County is required for Texas811 submission",
                prompt_text="What county will the work be performed in?",
            )
        ]
        result = ValidationResult(
            is_valid=False, gaps=gaps, validated_fields=["city", "address"], score=0.6
        )
        assert len(result.gaps) == 1
        assert result.gaps[0].field_name == "county"
        assert result.gaps[0].severity == ValidationSeverity.REQUIRED


class TestFieldValidator:
    """Test FieldValidator base class."""

    def test_field_validator_is_abstract(self):
        """Should not be able to instantiate abstract base class."""
        with pytest.raises(TypeError):
            FieldValidator()

    def test_field_validator_subclass(self):
        """Should be able to subclass FieldValidator."""

        class TestFieldValidator(FieldValidator):
            def validate_field(
                self, field_name: str, value: any
            ) -> list[ValidationGapModel]:
                return []

            def get_validation_rules(self) -> dict[str, dict]:
                return {}

        validator = TestFieldValidator()
        assert isinstance(validator, FieldValidator)


class TestTexas811FieldValidator:
    """Test Texas811FieldValidator implementation."""

    @pytest.fixture
    def validator(self):
        """Create Texas811FieldValidator instance."""
        return Texas811FieldValidator()

    def test_validator_creation(self, validator):
        """Should create Texas811FieldValidator instance."""
        assert isinstance(validator, Texas811FieldValidator)
        assert isinstance(validator, FieldValidator)

    def test_get_validation_rules(self, validator):
        """Should return Texas811 validation rules."""
        rules = validator.get_validation_rules()
        assert isinstance(rules, dict)
        assert "county" in rules
        assert "city" in rules
        assert "address" in rules
        assert "work_description" in rules

        # Check required field rules
        assert rules["county"]["required"] is True
        assert rules["city"]["required"] is True

    def test_validate_required_field_missing(self, validator):
        """Should detect missing required field."""
        gaps = validator.validate_field("county", None)
        assert len(gaps) == 1
        assert gaps[0].field_name == "county"
        assert gaps[0].severity == ValidationSeverity.REQUIRED
        assert "required" in gaps[0].message.lower()

    def test_validate_required_field_empty(self, validator):
        """Should detect empty required field."""
        gaps = validator.validate_field("county", "")
        assert len(gaps) == 1
        assert gaps[0].field_name == "county"
        assert gaps[0].severity == ValidationSeverity.REQUIRED

    def test_validate_required_field_valid(self, validator):
        """Should pass validation for valid required field."""
        gaps = validator.validate_field("county", "Travis")
        assert len(gaps) == 0

    def test_validate_phone_format(self, validator):
        """Should validate phone number format."""
        # Valid phone formats
        assert len(validator.validate_field("caller_phone", "512-555-1234")) == 0
        assert len(validator.validate_field("caller_phone", "(512) 555-1234")) == 0
        assert len(validator.validate_field("caller_phone", "5125551234")) == 0

        # Invalid phone format
        gaps = validator.validate_field("caller_phone", "invalid-phone")
        assert len(gaps) == 1
        assert gaps[0].severity == ValidationSeverity.WARNING

    def test_validate_email_format(self, validator):
        """Should validate email format."""
        # Valid email
        assert len(validator.validate_field("caller_email", "test@example.com")) == 0

        # Invalid email
        gaps = validator.validate_field("caller_email", "invalid-email")
        assert len(gaps) == 1
        assert gaps[0].severity == ValidationSeverity.WARNING

    def test_validate_gps_coordinates(self, validator):
        """Should validate GPS coordinates for Texas bounds."""
        # Valid Texas GPS coordinates
        assert len(validator.validate_field("gps_lat", 30.2672)) == 0  # Austin
        assert len(validator.validate_field("gps_lng", -97.7431)) == 0  # Austin

        # Invalid GPS coordinates (outside Texas)
        gaps = validator.validate_field("gps_lat", 50.0)  # Too far north
        assert len(gaps) == 1
        assert gaps[0].severity == ValidationSeverity.WARNING


class TestGapDetector:
    """Test GapDetector for gap analysis and prompt generation."""

    @pytest.fixture
    def gap_detector(self):
        """Create GapDetector instance."""
        return GapDetector()

    @pytest.fixture
    def sample_ticket(self):
        """Create sample ticket for testing."""
        return TicketModel(
            ticket_id="TEST-001",
            session_id="test-session-001",
            status=TicketStatus.DRAFT,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Install fiber cable",
        )

    def test_gap_detector_creation(self, gap_detector):
        """Should create GapDetector instance."""
        assert isinstance(gap_detector, GapDetector)

    def test_analyze_gaps_complete_ticket(self, gap_detector, sample_ticket):
        """Should find no gaps for complete ticket."""
        gaps = gap_detector.analyze_gaps(sample_ticket)
        required_gaps = [g for g in gaps if g.severity == ValidationSeverity.REQUIRED]
        assert len(required_gaps) == 0

    def test_analyze_gaps_missing_required_fields(self, gap_detector):
        """Should detect missing required fields."""
        incomplete_ticket = TicketModel(
            ticket_id="TEST-002",
            session_id="test-session-002",
            status=TicketStatus.DRAFT,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            county="Temporary",  # Provide valid values to bypass Pydantic validation
            city="Austin",
            address="Temporary",  # We'll test validation logic separately
            work_description="Temporary",
        )

        # Simulate empty fields for validation testing
        incomplete_ticket.county = ""
        incomplete_ticket.address = ""
        incomplete_ticket.work_description = ""

        gaps = gap_detector.analyze_gaps(incomplete_ticket)
        required_gaps = [g for g in gaps if g.severity == ValidationSeverity.REQUIRED]
        assert len(required_gaps) >= 3  # county, address, work_description

    def test_analyze_gaps_missing_recommended_fields(self, gap_detector, sample_ticket):
        """Should detect missing recommended fields."""
        gaps = gap_detector.analyze_gaps(sample_ticket)
        recommended_gaps = [
            g for g in gaps if g.severity == ValidationSeverity.RECOMMENDED
        ]
        # Should recommend caller information, cross_street, etc.
        assert len(recommended_gaps) > 0

    def test_generate_conversational_prompts(self, gap_detector, sample_ticket):
        """Should generate user-friendly prompts for gaps."""
        # Create ticket with missing caller info
        gaps = gap_detector.analyze_gaps(sample_ticket)

        for gap in gaps:
            assert gap.prompt_text is not None
            assert len(gap.prompt_text) > 0
            assert "?" in gap.prompt_text  # Should be a question

    def test_classify_gap_severity(self, gap_detector):
        """Should classify gaps by severity correctly."""
        # Required field
        severity = gap_detector._classify_field_severity("county")
        assert severity == ValidationSeverity.REQUIRED

        # Recommended field
        severity = gap_detector._classify_field_severity("caller_name")
        assert severity == ValidationSeverity.RECOMMENDED

        # Optional field
        severity = gap_detector._classify_field_severity("caller_email")
        assert severity in [ValidationSeverity.WARNING, ValidationSeverity.INFO]

    def test_prioritize_gaps(self, gap_detector):
        """Should prioritize gaps by severity."""
        gaps = [
            ValidationGapModel(
                field_name="caller_email",
                severity=ValidationSeverity.INFO,
                message="Email would be helpful",
                prompt_text="What's your email?",
            ),
            ValidationGapModel(
                field_name="county",
                severity=ValidationSeverity.REQUIRED,
                message="County is required",
                prompt_text="What county?",
            ),
            ValidationGapModel(
                field_name="caller_name",
                severity=ValidationSeverity.RECOMMENDED,
                message="Caller name is recommended",
                prompt_text="What's your name?",
            ),
        ]

        prioritized = gap_detector.prioritize_gaps(gaps)
        assert prioritized[0].severity == ValidationSeverity.REQUIRED
        assert prioritized[1].severity == ValidationSeverity.RECOMMENDED
        assert prioritized[2].severity == ValidationSeverity.INFO


class TestValidationCache:
    """Test ValidationCache for performance optimization."""

    @pytest.fixture
    def cache(self):
        """Create ValidationCache instance."""
        return ValidationCache(max_size=100, ttl_seconds=300)

    def test_cache_creation(self, cache):
        """Should create ValidationCache instance."""
        assert isinstance(cache, ValidationCache)
        assert cache.max_size == 100
        assert cache.ttl_seconds == 300

    def test_cache_store_and_retrieve(self, cache):
        """Should store and retrieve validation results."""
        result = ValidationResult(
            is_valid=True, gaps=[], validated_fields=["county", "city"], score=1.0
        )

        cache_key = "ticket_123_hash_abc"
        cache.store(cache_key, result)

        retrieved = cache.get(cache_key)
        assert retrieved is not None
        assert retrieved.is_valid is True
        assert retrieved.score == 1.0

    def test_cache_miss(self, cache):
        """Should return None for cache miss."""
        result = cache.get("nonexistent_key")
        assert result is None

    def test_cache_expiration(self, cache):
        """Should respect TTL for cache expiration."""
        cache.ttl_seconds = 0  # Immediate expiration
        result = ValidationResult(
            is_valid=True, gaps=[], validated_fields=[], score=1.0
        )

        cache.store("test_key", result)
        # Should be expired immediately
        retrieved = cache.get("test_key")
        assert retrieved is None

    def test_cache_size_limit(self, cache):
        """Should respect max_size limit."""
        cache.max_size = 2

        # Add items up to limit
        for i in range(3):
            result = ValidationResult(
                is_valid=True, gaps=[], validated_fields=[], score=1.0
            )
            cache.store(f"key_{i}", result)

        # Should only keep 2 items (LRU eviction)
        assert len(cache._cache) <= 2

    def test_cache_clear(self, cache):
        """Should clear all cache entries."""
        result = ValidationResult(
            is_valid=True, gaps=[], validated_fields=[], score=1.0
        )
        cache.store("test_key", result)

        cache.clear()
        assert len(cache._cache) == 0


class TestValidationEngine:
    """Test ValidationEngine orchestrator."""

    @pytest.fixture
    def engine(self):
        """Create ValidationEngine instance."""
        return ValidationEngine()

    @pytest.fixture
    def sample_ticket(self):
        """Create sample ticket for testing."""
        return TicketModel(
            ticket_id="TEST-001",
            session_id="test-session-001",
            status=TicketStatus.DRAFT,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            county="Travis",
            city="Austin",
            address="123 Main St",
            work_description="Install fiber cable",
        )

    def test_engine_creation(self, engine):
        """Should create ValidationEngine instance."""
        assert isinstance(engine, ValidationEngine)
        assert hasattr(engine, "field_validator")
        assert hasattr(engine, "gap_detector")
        assert hasattr(engine, "cache")

    def test_validate_ticket_complete(self, engine, sample_ticket):
        """Should validate complete ticket successfully."""
        result = engine.validate_ticket(sample_ticket)

        assert isinstance(result, ValidationResult)
        assert (
            result.score > 0.4
        )  # Should have decent score (some recommended fields missing)
        assert len(result.validated_fields) > 0

    def test_validate_ticket_incomplete(self, engine):
        """Should detect gaps in incomplete ticket."""
        incomplete_ticket = TicketModel(
            ticket_id="TEST-002",
            session_id="test-session-002",
            status=TicketStatus.DRAFT,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            county="Temporary",  # Provide valid values to bypass Pydantic validation
            city="Austin",
            address="Temporary",  # We'll test validation logic separately
            work_description="Temporary",
        )

        # Simulate empty fields for validation testing
        incomplete_ticket.county = ""
        incomplete_ticket.address = ""
        incomplete_ticket.work_description = ""

        result = engine.validate_ticket(incomplete_ticket)
        assert result.is_valid is False
        assert len(result.gaps) > 0

        # Should have required field gaps
        required_gaps = [
            g for g in result.gaps if g.severity == ValidationSeverity.REQUIRED
        ]
        assert len(required_gaps) > 0

    def test_validate_ticket_with_cache(self, engine, sample_ticket):
        """Should use cache for repeated validations."""
        # First validation
        result1 = engine.validate_ticket(sample_ticket)

        # Second validation should use cache
        result2 = engine.validate_ticket(sample_ticket)

        assert result1.score == result2.score
        assert len(result1.gaps) == len(result2.gaps)

    def test_validate_fields_partial(self, engine):
        """Should support partial field validation for iterative workflow."""
        fields = {
            "county": "Travis",
            "city": "Austin",
            "address": "",  # Missing
            "work_description": "Install cable",
        }

        result = engine.validate_fields(fields)
        assert isinstance(result, ValidationResult)

        # Should detect missing address
        address_gaps = [g for g in result.gaps if g.field_name == "address"]
        assert len(address_gaps) > 0

    def test_get_next_prompt(self, engine):
        """Should get next conversational prompt for CustomGPT."""
        incomplete_ticket = TicketModel(
            ticket_id="TEST-003",
            session_id="test-session-003",
            status=TicketStatus.DRAFT,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            county="Temporary",  # Will test validation logic after creation
            city="Austin",
            address="123 Main St",
            work_description="Install cable",
        )

        # Simulate missing required field
        incomplete_ticket.county = ""

        prompt = engine.get_next_prompt(incomplete_ticket)
        assert prompt is not None
        assert isinstance(prompt, str)
        assert len(prompt) > 0
        assert "?" in prompt  # Should be a question

    def test_validation_performance(self, engine, sample_ticket):
        """Should validate within performance requirements (<500ms)."""
        import time

        start_time = time.time()
        result = engine.validate_ticket(sample_ticket)
        end_time = time.time()

        validation_time = (end_time - start_time) * 1000  # Convert to ms
        assert validation_time < 500  # Must be under 500ms
        assert isinstance(result, ValidationResult)

    def test_progressive_validation(self, engine):
        """Should support progressive validation as fields are filled."""
        # Start with minimal ticket
        partial_data = {"county": "Travis"}
        result1 = engine.validate_fields(partial_data)
        initial_gaps = len(result1.gaps)

        # Add more fields
        partial_data.update({"city": "Austin", "address": "123 Main St"})
        result2 = engine.validate_fields(partial_data)

        # Should have fewer gaps
        assert len(result2.gaps) < initial_gaps
        assert result2.score > result1.score

    def test_error_handling(self, engine):
        """Should handle validation errors gracefully."""
        # Test with invalid ticket data
        invalid_ticket = None

        with pytest.raises(ValidationError):
            engine.validate_ticket(invalid_ticket)

    def test_custom_validation_rules(self, engine):
        """Should support custom validation rules."""
        # Test location validation (address OR GPS required)
        ticket_no_location = TicketModel(
            ticket_id="TEST-004",
            session_id="test-session-004",
            status=TicketStatus.DRAFT,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            county="Travis",
            city="Austin",
            address="Temporary",  # Will be tested as empty in validation logic
            gps_lat=None,  # No GPS
            gps_lng=None,
            work_description="Install cable",
        )

        # Simulate no location data
        ticket_no_location.address = ""

        result = engine.validate_ticket(ticket_no_location)

        # Should require either address or GPS
        location_gaps = [
            g
            for g in result.gaps
            if "location" in g.message.lower()
            or "address" in g.message.lower()
            or "gps" in g.message.lower()
        ]
        assert len(location_gaps) > 0
