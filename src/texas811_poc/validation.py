"""
Core validation engine for Texas811 POC.

This module implements comprehensive validation for Texas811 ticket data,
including field validation, gap detection, and conversational prompt generation
for the CustomGPT interface.

Key features:
- Iterative validation for multi-turn CustomGPT workflow
- Texas811-specific field validation rules
- Gap analysis with severity classification
- Conversational prompt generation
- Performance caching (<500ms response time)
- Progressive validation support
"""

import hashlib
import re
import time
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any

from texas811_poc.models import (
    TicketModel,
    ValidationGapModel,
    ValidationSeverity,
)


class ValidationError(Exception):
    """Exception raised for validation-related errors."""

    pass


class ValidationResult:
    """Result of ticket validation with gaps and scoring."""

    def __init__(
        self,
        is_valid: bool,
        gaps: list[ValidationGapModel],
        validated_fields: list[str],
        score: float,
        validation_time_ms: float | None = None,
    ):
        """Initialize validation result.

        Args:
            is_valid: Whether ticket passes all required validations
            gaps: List of validation gaps found
            validated_fields: List of fields that passed validation
            score: Overall validation score (0.0 to 1.0)
            validation_time_ms: Time taken for validation in milliseconds
        """
        self.is_valid = is_valid
        self.gaps = gaps
        self.validated_fields = validated_fields
        self.score = score
        self.validation_time_ms = validation_time_ms

    @property
    def required_gaps(self) -> list[ValidationGapModel]:
        """Get only required validation gaps."""
        return [g for g in self.gaps if g.severity == ValidationSeverity.REQUIRED]

    @property
    def is_submittable(self) -> bool:
        """Check if ticket can be submitted (no required gaps)."""
        return len(self.required_gaps) == 0


class FieldValidator(ABC):
    """Abstract base class for field validation."""

    @abstractmethod
    def validate_field(self, field_name: str, value: Any) -> list[ValidationGapModel]:
        """Validate a single field and return gaps.

        Args:
            field_name: Name of the field to validate
            value: Value to validate

        Returns:
            List of validation gaps found
        """
        pass

    @abstractmethod
    def get_validation_rules(self) -> dict[str, dict[str, Any]]:
        """Get validation rules for all fields.

        Returns:
            Dictionary mapping field names to validation rules
        """
        pass


class Texas811FieldValidator(FieldValidator):
    """Texas811-specific field validator with state-specific rules."""

    def __init__(self):
        """Initialize Texas811 field validator."""
        self._validation_rules = self._build_validation_rules()
        self._phone_pattern = re.compile(
            r"^\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$"
        )
        self._email_pattern = re.compile(
            r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        )

    def get_validation_rules(self) -> dict[str, dict[str, Any]]:
        """Get Texas811 validation rules."""
        return self._validation_rules.copy()

    def validate_field(self, field_name: str, value: Any) -> list[ValidationGapModel]:
        """Validate field against Texas811 rules."""
        gaps = []
        rules = self._validation_rules.get(field_name, {})

        if not rules:
            return gaps  # No validation rules for this field

        # Check if required field is missing/empty
        if rules.get("required", False):
            if value is None or (isinstance(value, str) and not value.strip()):
                gaps.append(
                    ValidationGapModel(
                        field_name=field_name,
                        severity=ValidationSeverity.REQUIRED,
                        message=f"{field_name.replace('_', ' ').title()} is required for Texas811 submission",
                        prompt_text=self._get_field_prompt(field_name),
                    )
                )
                return gaps  # Don't continue validation if required field is missing

        # Skip further validation if field is empty but not required
        if value is None or (isinstance(value, str) and not value.strip()):
            if rules.get("recommended", False):
                gaps.append(
                    ValidationGapModel(
                        field_name=field_name,
                        severity=ValidationSeverity.RECOMMENDED,
                        message=f"{field_name.replace('_', ' ').title()} is recommended for faster processing",
                        prompt_text=self._get_field_prompt(field_name),
                    )
                )
            return gaps

        # Format-specific validations
        if field_name.endswith("_phone") and isinstance(value, str):
            if not self._phone_pattern.match(value):
                gaps.append(
                    ValidationGapModel(
                        field_name=field_name,
                        severity=ValidationSeverity.WARNING,
                        message=f"Phone number format may be invalid: {value}",
                        prompt_text=f"Please verify the phone number format for {field_name.replace('_', ' ')}: {value}",
                    )
                )

        if field_name.endswith("_email") and isinstance(value, str):
            if not self._email_pattern.match(value):
                gaps.append(
                    ValidationGapModel(
                        field_name=field_name,
                        severity=ValidationSeverity.WARNING,
                        message=f"Email format may be invalid: {value}",
                        prompt_text=f"Please verify the email address: {value}",
                    )
                )

        # GPS coordinate validation for Texas bounds
        if field_name == "gps_lat" and isinstance(value, int | float):
            if not (25.0 <= value <= 37.0):
                gaps.append(
                    ValidationGapModel(
                        field_name=field_name,
                        severity=ValidationSeverity.WARNING,
                        message=f"GPS latitude {value} may be outside Texas bounds (25°-37°N)",
                        prompt_text=f"Please verify the GPS latitude is correct: {value}",
                    )
                )

        if field_name == "gps_lng" and isinstance(value, int | float):
            if not (-107.0 <= value <= -93.0):
                gaps.append(
                    ValidationGapModel(
                        field_name=field_name,
                        severity=ValidationSeverity.WARNING,
                        message=f"GPS longitude {value} may be outside Texas bounds (-107° to -93°W)",
                        prompt_text=f"Please verify the GPS longitude is correct: {value}",
                    )
                )

        return gaps

    def _build_validation_rules(self) -> dict[str, dict[str, Any]]:
        """Build comprehensive Texas811 validation rules."""
        return {
            # Texas811 Required Fields
            "county": {
                "required": True,
                "description": "Texas county where work will be performed",
            },
            "city": {
                "required": True,
                "description": "City where work will be performed",
            },
            "address": {
                "required": True,
                "description": "Street address of work location",
            },
            "work_description": {
                "required": True,
                "description": "Description of work to be performed",
            },
            # Recommended Fields
            "cross_street": {
                "recommended": True,
                "description": "Nearest cross street for location clarity",
            },
            "caller_name": {
                "recommended": True,
                "description": "Contact person for this locate request",
            },
            "caller_company": {
                "recommended": True,
                "description": "Company requesting the locate",
            },
            "caller_phone": {
                "recommended": True,
                "description": "Phone number for locate coordination",
            },
            # Optional but helpful
            "caller_email": {
                "optional": True,
                "description": "Email for locate updates and notifications",
            },
            "excavator_company": {
                "optional": True,
                "description": "Company performing the excavation",
            },
            "excavator_phone": {
                "optional": True,
                "description": "Excavator contact information",
            },
            "excavator_address": {
                "optional": True,
                "description": "Excavator business address",
            },
            # GPS coordinates (alternative to address)
            "gps_lat": {
                "optional": True,
                "description": "GPS latitude for precise location",
            },
            "gps_lng": {
                "optional": True,
                "description": "GPS longitude for precise location",
            },
            # Work details
            "work_start_date": {
                "recommended": True,
                "description": "When excavation work will begin",
            },
            "work_duration_days": {
                "optional": True,
                "description": "Expected duration of work in days",
            },
        }

    def _get_field_prompt(self, field_name: str) -> str:
        """Generate conversational prompt for missing field."""
        prompts = {
            "county": "What Texas county will the work be performed in?",
            "city": "What city will the work take place in?",
            "address": "What's the street address where the work will be done?",
            "work_description": "Can you describe what type of work will be performed?",
            "cross_street": "What's the nearest cross street or landmark?",
            "caller_name": "What's the name of the person I'm speaking with?",
            "caller_company": "What company are you with?",
            "caller_phone": "What's the best phone number to reach you at?",
            "caller_email": "What's your email address for updates?",
            "excavator_company": "What company will be doing the excavation work?",
            "excavator_phone": "What's the excavator's contact phone number?",
            "work_start_date": "When do you plan to start the excavation work?",
        }
        return prompts.get(
            field_name, f"Can you provide the {field_name.replace('_', ' ')}?"
        )


class GapDetector:
    """Detects validation gaps and generates conversational prompts."""

    def __init__(self, field_validator: FieldValidator | None = None):
        """Initialize gap detector.

        Args:
            field_validator: Field validator to use (defaults to Texas811FieldValidator)
        """
        self.field_validator = field_validator or Texas811FieldValidator()

    def analyze_gaps(self, ticket: TicketModel) -> list[ValidationGapModel]:
        """Analyze ticket for validation gaps.

        Args:
            ticket: Ticket model to analyze

        Returns:
            List of validation gaps found
        """
        all_gaps = []

        # Get ticket data as dict
        ticket_data = ticket.model_dump()

        # Validate each field according to rules
        for field_name, value in ticket_data.items():
            field_gaps = self.field_validator.validate_field(field_name, value)
            all_gaps.extend(field_gaps)

        # Custom business logic validations
        custom_gaps = self._validate_business_rules(ticket)
        all_gaps.extend(custom_gaps)

        return self.prioritize_gaps(all_gaps)

    def analyze_fields_gaps(self, fields: dict[str, Any]) -> list[ValidationGapModel]:
        """Analyze partial field data for gaps (supports iterative validation).

        Args:
            fields: Dictionary of field names to values

        Returns:
            List of validation gaps found
        """
        all_gaps = []

        # Validate provided fields
        for field_name, value in fields.items():
            field_gaps = self.field_validator.validate_field(field_name, value)
            all_gaps.extend(field_gaps)

        # Check for missing required fields
        validation_rules = self.field_validator.get_validation_rules()
        for field_name, rules in validation_rules.items():
            if rules.get("required", False) and field_name not in fields:
                all_gaps.append(
                    ValidationGapModel(
                        field_name=field_name,
                        severity=ValidationSeverity.REQUIRED,
                        message=f"{field_name.replace('_', ' ').title()} is required but not provided",
                        prompt_text=self._get_field_prompt(field_name),
                    )
                )

        return self.prioritize_gaps(all_gaps)

    def prioritize_gaps(
        self, gaps: list[ValidationGapModel]
    ) -> list[ValidationGapModel]:
        """Prioritize gaps by severity for presentation order.

        Args:
            gaps: List of validation gaps

        Returns:
            Gaps sorted by severity (REQUIRED first)
        """
        severity_order = {
            ValidationSeverity.REQUIRED: 0,
            ValidationSeverity.RECOMMENDED: 1,
            ValidationSeverity.WARNING: 2,
            ValidationSeverity.INFO: 3,
        }

        return sorted(gaps, key=lambda g: severity_order.get(g.severity, 4))

    def get_next_prompt(self, gaps: list[ValidationGapModel]) -> str | None:
        """Get the next conversational prompt for CustomGPT.

        Args:
            gaps: List of validation gaps (should be prioritized)

        Returns:
            Next prompt text or None if no gaps
        """
        if not gaps:
            return None

        # Return prompt for highest priority gap
        return gaps[0].prompt_text

    def _classify_field_severity(self, field_name: str) -> ValidationSeverity:
        """Classify field validation severity based on Texas811 requirements."""
        rules = self.field_validator.get_validation_rules()
        field_rules = rules.get(field_name, {})

        if field_rules.get("required", False):
            return ValidationSeverity.REQUIRED
        elif field_rules.get("recommended", False):
            return ValidationSeverity.RECOMMENDED
        else:
            return ValidationSeverity.INFO

    def _validate_business_rules(self, ticket: TicketModel) -> list[ValidationGapModel]:
        """Apply Texas811-specific business logic validations."""
        gaps = []

        # Location validation: Must have either address OR GPS coordinates
        has_address = ticket.address and ticket.address.strip()
        has_gps = ticket.gps_lat is not None and ticket.gps_lng is not None

        if not has_address and not has_gps:
            gaps.append(
                ValidationGapModel(
                    field_name="location",
                    severity=ValidationSeverity.REQUIRED,
                    message="Must provide either street address OR GPS coordinates for work location",
                    prompt_text="I need either a street address or GPS coordinates. Which would you prefer to provide?",
                )
            )

        # Work timing validation
        if (
            ticket.work_start_date
            and ticket.work_start_date <= datetime.now(UTC).date()
        ):
            gaps.append(
                ValidationGapModel(
                    field_name="work_start_date",
                    severity=ValidationSeverity.WARNING,
                    message="Work start date should be at least 2 business days in the future per Texas811 requirements",
                    prompt_text="Texas law requires at least 2 business days notice. When do you plan to start work?",
                )
            )

        return gaps

    def _get_field_prompt(self, field_name: str) -> str:
        """Get conversational prompt for field (delegate to field validator)."""
        if hasattr(self.field_validator, "_get_field_prompt"):
            return self.field_validator._get_field_prompt(field_name)
        return f"Can you provide the {field_name.replace('_', ' ')}?"


class ValidationCache:
    """In-memory cache for validation results with TTL and size limits."""

    def __init__(self, max_size: int = 1000, ttl_seconds: int = 300):
        """Initialize validation cache.

        Args:
            max_size: Maximum number of entries to cache
            ttl_seconds: Time-to-live for cache entries in seconds
        """
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: dict[str, dict[str, Any]] = {}

    def get(self, cache_key: str) -> ValidationResult | None:
        """Get cached validation result.

        Args:
            cache_key: Cache key to lookup

        Returns:
            Cached validation result or None if not found/expired
        """
        if cache_key not in self._cache:
            return None

        entry = self._cache[cache_key]

        # Check if expired
        if time.time() - entry["timestamp"] > self.ttl_seconds:
            del self._cache[cache_key]
            return None

        return entry["result"]

    def store(self, cache_key: str, result: ValidationResult) -> None:
        """Store validation result in cache.

        Args:
            cache_key: Key to store result under
            result: Validation result to cache
        """
        # Enforce size limit (simple FIFO eviction)
        if len(self._cache) >= self.max_size:
            # Remove oldest entry
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]

        self._cache[cache_key] = {"result": result, "timestamp": time.time()}

    def clear(self) -> None:
        """Clear all cache entries."""
        self._cache.clear()

    def _generate_cache_key(self, ticket_data: dict[str, Any]) -> str:
        """Generate cache key from ticket data."""
        # Create hash of relevant ticket data
        cache_data = {k: v for k, v in ticket_data.items() if v is not None}
        cache_str = str(sorted(cache_data.items()))
        return hashlib.md5(cache_str.encode()).hexdigest()


class ValidationEngine:
    """Main validation orchestrator for Texas811 POC."""

    def __init__(
        self,
        field_validator: FieldValidator | None = None,
        cache_enabled: bool = True,
        cache_size: int = 1000,
        cache_ttl: int = 300,
    ):
        """Initialize validation engine.

        Args:
            field_validator: Field validator to use (defaults to Texas811FieldValidator)
            cache_enabled: Whether to enable result caching
            cache_size: Maximum cache size
            cache_ttl: Cache TTL in seconds
        """
        self.field_validator = field_validator or Texas811FieldValidator()
        self.gap_detector = GapDetector(self.field_validator)
        self.cache = ValidationCache(cache_size, cache_ttl) if cache_enabled else None

    def validate_ticket(self, ticket: TicketModel) -> ValidationResult:
        """Validate complete ticket model.

        Args:
            ticket: Ticket to validate

        Returns:
            Validation result with gaps and scoring

        Raises:
            ValidationError: If ticket is None or invalid
        """
        if ticket is None:
            raise ValidationError("Cannot validate None ticket")

        start_time = time.time()

        # Check cache first
        cache_key = None
        if self.cache:
            ticket_data = ticket.model_dump()
            cache_key = self.cache._generate_cache_key(ticket_data)
            cached_result = self.cache.get(cache_key)
            if cached_result:
                return cached_result

        try:
            # Perform validation
            gaps = self.gap_detector.analyze_gaps(ticket)
            validated_fields = self._get_validated_fields(ticket, gaps)
            score = self._calculate_validation_score(ticket, gaps)
            is_valid = (
                len([g for g in gaps if g.severity == ValidationSeverity.REQUIRED]) == 0
            )

            # Calculate timing
            validation_time_ms = (time.time() - start_time) * 1000

            result = ValidationResult(
                is_valid=is_valid,
                gaps=gaps,
                validated_fields=validated_fields,
                score=score,
                validation_time_ms=validation_time_ms,
            )

            # Cache result
            if self.cache and cache_key:
                self.cache.store(cache_key, result)

            return result

        except Exception as e:
            raise ValidationError(f"Validation failed: {e}") from e

    def validate_fields(self, fields: dict[str, Any]) -> ValidationResult:
        """Validate partial field data (supports iterative workflow).

        Args:
            fields: Dictionary of field names to values

        Returns:
            Validation result for provided fields
        """
        if not isinstance(fields, dict):
            raise ValidationError("Fields must be a dictionary")

        start_time = time.time()

        try:
            # Perform validation
            gaps = self.gap_detector.analyze_fields_gaps(fields)
            validated_fields = list(fields.keys())
            score = self._calculate_fields_score(fields, gaps)
            is_valid = (
                len([g for g in gaps if g.severity == ValidationSeverity.REQUIRED]) == 0
            )

            validation_time_ms = (time.time() - start_time) * 1000

            return ValidationResult(
                is_valid=is_valid,
                gaps=gaps,
                validated_fields=validated_fields,
                score=score,
                validation_time_ms=validation_time_ms,
            )

        except Exception as e:
            raise ValidationError(f"Fields validation failed: {e}") from e

    def get_next_prompt(self, ticket: TicketModel) -> str | None:
        """Get next conversational prompt for CustomGPT workflow.

        Args:
            ticket: Current ticket state

        Returns:
            Next prompt text or None if complete
        """
        try:
            gaps = self.gap_detector.analyze_gaps(ticket)
            return self.gap_detector.get_next_prompt(gaps)
        except Exception as e:
            raise ValidationError(f"Failed to get next prompt: {e}") from e

    def _get_validated_fields(
        self, ticket: TicketModel, gaps: list[ValidationGapModel]
    ) -> list[str]:
        """Get list of fields that passed validation."""
        ticket_data = ticket.model_dump()
        gap_fields = {gap.field_name for gap in gaps}

        return [
            field_name
            for field_name, value in ticket_data.items()
            if value is not None and field_name not in gap_fields
        ]

    def _calculate_validation_score(
        self, ticket: TicketModel, gaps: list[ValidationGapModel]
    ) -> float:
        """Calculate overall validation score (0.0 to 1.0)."""
        validation_rules = self.field_validator.get_validation_rules()
        total_weight = 0
        achieved_weight = 0

        # Weight scoring by field importance
        field_weights = {
            ValidationSeverity.REQUIRED: 3.0,
            ValidationSeverity.RECOMMENDED: 2.0,
            ValidationSeverity.WARNING: 1.0,
            ValidationSeverity.INFO: 0.5,
        }

        ticket_data = ticket.model_dump()
        gap_fields = {
            gap.field_name
            for gap in gaps
            if gap.severity
            in [ValidationSeverity.REQUIRED, ValidationSeverity.RECOMMENDED]
        }

        for field_name, rules in validation_rules.items():
            if rules.get("required"):
                weight = field_weights[ValidationSeverity.REQUIRED]
            elif rules.get("recommended"):
                weight = field_weights[ValidationSeverity.RECOMMENDED]
            else:
                weight = field_weights[ValidationSeverity.INFO]

            total_weight += weight

            # Give credit if field has value and no gaps
            field_value = ticket_data.get(field_name)
            if field_value is not None and field_name not in gap_fields:
                if isinstance(field_value, str) and field_value.strip():
                    achieved_weight += weight
                elif not isinstance(field_value, str):
                    achieved_weight += weight

        return achieved_weight / total_weight if total_weight > 0 else 0.0

    def _calculate_fields_score(
        self, fields: dict[str, Any], gaps: list[ValidationGapModel]
    ) -> float:
        """Calculate validation score for partial field data."""
        if not fields:
            return 0.0

        # Count valid fields vs gaps
        valid_fields = len([f for f in fields.values() if f is not None and f != ""])
        total_fields = len(fields)
        gap_penalty = (
            len(
                [
                    g
                    for g in gaps
                    if g.severity
                    in [ValidationSeverity.REQUIRED, ValidationSeverity.RECOMMENDED]
                ]
            )
            * 0.1
        )

        base_score = valid_fields / total_fields if total_fields > 0 else 0.0
        return max(0.0, base_score - gap_penalty)
