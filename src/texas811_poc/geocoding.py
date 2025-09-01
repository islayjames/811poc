"""
GIS and geocoding functionality for Texas 811 POC.

This module provides:
- GeocodingService: Mapbox API integration for address geocoding
- GeometryGenerator: GeoJSON geometry creation from GPS coordinates
- GeofenceBuilder: Simple buffer generation (box/polyline)
- CoordinateValidator: Texas bounds checking and validation
- ConfidenceScorer: Quality assessment for generated geometries

Handles missing API keys gracefully by returning mock data in POC mode.
"""

import random
from datetime import UTC, datetime
from typing import Any

import httpx

from texas811_poc.config import settings
from texas811_poc.models import GeometryModel, GeometryType


# Custom exceptions
class GeocodingError(Exception):
    """Raised when geocoding operations fail."""

    pass


class InvalidCoordinateError(Exception):
    """Raised when coordinates are invalid or out of bounds."""

    pass


class GeometryGenerationError(Exception):
    """Raised when geometry generation fails."""

    pass


class GeocodingService:
    """Service for geocoding addresses using Mapbox API."""

    _SENTINEL: object = object()  # Sentinel to distinguish None from not provided
    api_key: str | None

    def __init__(self, api_key: str | None | object = _SENTINEL):
        """Initialize the geocoding service.

        Args:
            api_key: Mapbox API key. If None, service runs in mock mode.
        """
        # Use provided key, or fall back to settings if not provided
        if api_key is self._SENTINEL:
            self.api_key = settings.mapbox_token
        else:
            self.api_key = api_key if isinstance(api_key, str | type(None)) else None

        self.base_url = "https://api.mapbox.com/geocoding/v5/mapbox.places"
        # Mock mode if no API key or placeholder value
        self._mock_mode = (
            self.api_key is None
            or self.api_key == "your_geocoding_api_key_here"
            or (isinstance(self.api_key, str) and not self.api_key.strip())
        )

    def geocode_address(self, address: str) -> dict[str, Any]:
        """Geocode an address to GPS coordinates.

        Args:
            address: Street address to geocode

        Returns:
            Dict containing latitude, longitude, confidence, formatted_address, source

        Raises:
            GeocodingError: If geocoding fails
        """
        if self._mock_mode:
            return self._mock_geocode_address(address)

        try:
            # Build request URL
            url = f"{self.base_url}/{address}.json"
            params = {
                "access_token": self.api_key,
                "country": "US",
                "bbox": "-107.0,25.0,-93.0,37.0",  # Texas bounds
                "limit": 1,
            }

            # Make API request
            response = httpx.get(url, params=params, timeout=10.0)
            response.raise_for_status()

            data = response.json()

            if not data.get("features"):
                raise GeocodingError(
                    f"No geocoding results found for address: {address}"
                )

            feature = data["features"][0]
            center = feature["center"]

            return {
                "latitude": center[1],
                "longitude": center[0],
                "confidence": feature.get("relevance", 0.8),
                "formatted_address": feature["place_name"],
                "source": "mapbox_geocoding",
            }

        except httpx.RequestError as e:
            raise GeocodingError(f"Geocoding request failed: {e}") from e
        except (KeyError, IndexError) as e:
            raise GeocodingError(
                f"Invalid response format from geocoding service: {e}"
            ) from e

    def reverse_geocode(self, latitude: float, longitude: float) -> dict[str, Any]:
        """Reverse geocode GPS coordinates to address.

        Args:
            latitude: GPS latitude
            longitude: GPS longitude

        Returns:
            Dict containing formatted_address, confidence, source

        Raises:
            GeocodingError: If reverse geocoding fails
        """
        if self._mock_mode:
            return self._mock_reverse_geocode(latitude, longitude)

        try:
            # Build request URL
            url = f"{self.base_url}/{longitude},{latitude}.json"
            params = {
                "access_token": self.api_key,
                "types": "address,poi,place",
                "limit": 1,
            }

            # Make API request
            response = httpx.get(url, params=params, timeout=10.0)
            response.raise_for_status()

            data = response.json()

            if not data.get("features"):
                raise GeocodingError(
                    f"No reverse geocoding results found for coordinates: {latitude}, {longitude}"
                )

            feature = data["features"][0]

            return {
                "formatted_address": feature["place_name"],
                "confidence": feature.get("relevance", 0.8),
                "source": "mapbox_reverse_geocoding",
            }

        except httpx.RequestError as e:
            raise GeocodingError(f"Reverse geocoding request failed: {e}") from e
        except (KeyError, IndexError) as e:
            raise GeocodingError(
                f"Invalid response format from reverse geocoding service: {e}"
            ) from e

    def _mock_geocode_address(self, address: str) -> dict[str, Any]:
        """Mock geocoding for POC mode without API key."""
        # Generate random Texas coordinates
        lat = random.uniform(25.5, 36.5)  # Texas bounds with some margin
        lng = random.uniform(-106.5, -93.5)

        return {
            "latitude": lat,
            "longitude": lng,
            "confidence": 0.7,
            "formatted_address": f"Mock address for '{address}' in Texas",
            "source": "mock_geocoding",
        }

    def _mock_reverse_geocode(
        self, latitude: float, longitude: float
    ) -> dict[str, Any]:
        """Mock reverse geocoding for POC mode."""
        return {
            "formatted_address": f"Mock address near {latitude:.4f}, {longitude:.4f}",
            "confidence": 0.7,
            "source": "mock_reverse_geocoding",
        }


class CoordinateValidator:
    """Validates GPS coordinates and checks Texas bounds."""

    # Texas approximate bounds
    TEXAS_BOUNDS = {
        "min_lat": 25.0,
        "max_lat": 37.0,
        "min_lng": -107.0,
        "max_lng": -93.0,
    }

    def is_in_texas(self, latitude: float, longitude: float) -> bool:
        """Check if coordinates are within Texas bounds.

        Args:
            latitude: GPS latitude
            longitude: GPS longitude

        Returns:
            True if coordinates are within Texas bounds
        """
        return (
            self.TEXAS_BOUNDS["min_lat"] <= latitude <= self.TEXAS_BOUNDS["max_lat"]
            and self.TEXAS_BOUNDS["min_lng"]
            <= longitude
            <= self.TEXAS_BOUNDS["max_lng"]
        )

    def validate_coordinates(self, latitude: float, longitude: float) -> dict[str, Any]:
        """Validate GPS coordinates with warnings.

        Args:
            latitude: GPS latitude
            longitude: GPS longitude

        Returns:
            Dict with is_valid, in_texas, warnings

        Raises:
            InvalidCoordinateError: If coordinates are invalid
        """
        warnings = []

        # Basic range validation
        if not (-90 <= latitude <= 90):
            raise InvalidCoordinateError(
                f"Invalid latitude: {latitude}. Must be between -90 and 90."
            )

        if not (-180 <= longitude <= 180):
            raise InvalidCoordinateError(
                f"Invalid longitude: {longitude}. Must be between -180 and 180."
            )

        # Texas bounds check
        in_texas = self.is_in_texas(latitude, longitude)
        if not in_texas:
            warnings.append("Coordinates are outside Texas bounds - reduced confidence")

        return {"is_valid": True, "in_texas": in_texas, "warnings": warnings}

    def get_texas_bounds(self) -> dict[str, float]:
        """Get Texas boundary information."""
        return self.TEXAS_BOUNDS.copy()


class GeometryGenerator:
    """Generates GeoJSON geometries from GPS coordinates."""

    def __init__(self) -> None:
        """Initialize the geometry generator."""
        self.validator = CoordinateValidator()

    def create_point(
        self,
        latitude: float,
        longitude: float,
        confidence: float | None = None,
        source: str = "manual_coordinates",
    ) -> GeometryModel:
        """Create a point geometry from coordinates.

        Args:
            latitude: GPS latitude
            longitude: GPS longitude
            confidence: Optional confidence score override
            source: Source of the coordinates

        Returns:
            GeometryModel with Point type

        Raises:
            GeometryGenerationError: If coordinates are invalid
        """
        try:
            # Validate coordinates
            validation = self.validator.validate_coordinates(latitude, longitude)

            # Calculate confidence if not provided
            if confidence is None:
                if validation["in_texas"]:
                    confidence = 0.85
                else:
                    confidence = 0.6  # Reduced confidence outside Texas

            # Create geometry
            return GeometryModel(
                type=GeometryType.POINT,
                coordinates=[longitude, latitude],  # GeoJSON format: [lng, lat]
                confidence_score=confidence,
                source=source,
                created_at=datetime.now(UTC),
            )

        except InvalidCoordinateError as e:
            raise GeometryGenerationError(f"Cannot create point geometry: {e}") from e

    def create_linestring(
        self,
        coordinates: list[tuple[float, float]],
        confidence: float = 0.8,
        source: str = "manual_linestring",
    ) -> GeometryModel:
        """Create a linestring geometry from coordinate array.

        Args:
            coordinates: List of (lat, lng) tuples
            confidence: Confidence score
            source: Source of the coordinates

        Returns:
            GeometryModel with LineString type

        Raises:
            GeometryGenerationError: If coordinates are invalid
        """
        if len(coordinates) < 2:
            raise GeometryGenerationError("LineString requires at least 2 coordinates")

        try:
            # Validate all coordinates
            geojson_coords = []
            for lat, lng in coordinates:
                self.validator.validate_coordinates(lat, lng)
                geojson_coords.append([lng, lat])  # GeoJSON format: [lng, lat]

            return GeometryModel(
                type=GeometryType.LINESTRING,
                coordinates=geojson_coords,
                confidence_score=confidence,
                source=source,
                created_at=datetime.now(UTC),
            )

        except InvalidCoordinateError as e:
            raise GeometryGenerationError(
                f"Cannot create linestring geometry: {e}"
            ) from e

    def create_polygon(
        self,
        coordinates: list[tuple[float, float]],
        confidence: float = 0.8,
        source: str = "manual_polygon",
    ) -> GeometryModel:
        """Create a polygon geometry from coordinate ring.

        Args:
            coordinates: List of (lat, lng) tuples forming a closed ring
            confidence: Confidence score
            source: Source of the coordinates

        Returns:
            GeometryModel with Polygon type

        Raises:
            GeometryGenerationError: If coordinates are invalid
        """
        if len(coordinates) < 4:
            raise GeometryGenerationError(
                "Polygon requires at least 4 coordinates (including closure)"
            )

        try:
            # Validate all coordinates and convert to GeoJSON format
            geojson_coords = []
            for lat, lng in coordinates:
                self.validator.validate_coordinates(lat, lng)
                geojson_coords.append([lng, lat])  # GeoJSON format: [lng, lat]

            # Ensure polygon is closed
            if geojson_coords[0] != geojson_coords[-1]:
                geojson_coords.append(geojson_coords[0])

            return GeometryModel(
                type=GeometryType.POLYGON,
                coordinates=[geojson_coords],  # Polygon has array of rings
                confidence_score=confidence,
                source=source,
                created_at=datetime.now(UTC),
            )

        except InvalidCoordinateError as e:
            raise GeometryGenerationError(f"Cannot create polygon geometry: {e}") from e


class GeofenceBuilder:
    """Builds simple geofences (buffers) around geometries."""

    def __init__(self, default_buffer_feet: float = 25.0):
        """Initialize the geofence builder.

        Args:
            default_buffer_feet: Default buffer distance in feet
        """
        self.default_buffer_feet = default_buffer_feet
        self.validator = CoordinateValidator()
        self.generator = GeometryGenerator()

    def create_point_buffer(
        self, latitude: float, longitude: float, buffer_feet: float | None = None
    ) -> GeometryModel:
        """Create a buffer polygon around a point.

        Args:
            latitude: GPS latitude of center point
            longitude: GPS longitude of center point
            buffer_feet: Buffer distance in feet

        Returns:
            GeometryModel with Polygon type representing buffer

        Raises:
            GeometryGenerationError: If coordinates are invalid
        """
        buffer_feet = buffer_feet or self.default_buffer_feet

        try:
            # Validate center point
            self.validator.validate_coordinates(latitude, longitude)

            # Convert feet to degrees (approximate)
            buffer_degrees = self._feet_to_degrees(buffer_feet)

            # Create simple rectangular buffer
            buffer_coords = [
                (latitude - buffer_degrees, longitude - buffer_degrees),  # SW
                (latitude - buffer_degrees, longitude + buffer_degrees),  # SE
                (latitude + buffer_degrees, longitude + buffer_degrees),  # NE
                (latitude + buffer_degrees, longitude - buffer_degrees),  # NW
                (latitude - buffer_degrees, longitude - buffer_degrees),  # Close
            ]

            return self.generator.create_polygon(
                buffer_coords,
                confidence=0.9,
                source=f"point_buffer_{int(buffer_feet)}ft",
            )

        except InvalidCoordinateError as e:
            raise GeometryGenerationError(f"Cannot create point buffer: {e}") from e

    def create_linestring_buffer(
        self,
        coordinates: list[tuple[float, float]],
        buffer_feet: float | None = None,
    ) -> GeometryModel:
        """Create a buffer polygon around a linestring.

        Args:
            coordinates: List of (lat, lng) tuples forming the line
            buffer_feet: Buffer distance in feet

        Returns:
            GeometryModel with Polygon type representing buffer
        """
        buffer_feet = buffer_feet or self.default_buffer_feet
        buffer_degrees = self._feet_to_degrees(buffer_feet)

        if len(coordinates) < 2:
            raise GeometryGenerationError(
                "LineString buffer requires at least 2 coordinates"
            )

        try:
            # For simplicity, create a bounding box around all points with buffer
            lats = [coord[0] for coord in coordinates]
            lngs = [coord[1] for coord in coordinates]

            min_lat, max_lat = min(lats), max(lats)
            min_lng, max_lng = min(lngs), max(lngs)

            # Add buffer to bounding box
            buffer_coords = [
                (min_lat - buffer_degrees, min_lng - buffer_degrees),  # SW
                (min_lat - buffer_degrees, max_lng + buffer_degrees),  # SE
                (max_lat + buffer_degrees, max_lng + buffer_degrees),  # NE
                (max_lat + buffer_degrees, min_lng - buffer_degrees),  # NW
                (min_lat - buffer_degrees, min_lng - buffer_degrees),  # Close
            ]

            return self.generator.create_polygon(
                buffer_coords,
                confidence=0.8,
                source=f"linestring_buffer_{int(buffer_feet)}ft",
            )

        except InvalidCoordinateError as e:
            raise GeometryGenerationError(
                f"Cannot create linestring buffer: {e}"
            ) from e

    def create_polygon_buffer(
        self,
        coordinates: list[tuple[float, float]],
        buffer_feet: float | None = None,
    ) -> GeometryModel:
        """Create a buffer polygon around an existing polygon.

        Args:
            coordinates: List of (lat, lng) tuples forming the polygon
            buffer_feet: Buffer distance in feet

        Returns:
            GeometryModel with Polygon type representing buffer
        """
        buffer_feet = buffer_feet or self.default_buffer_feet
        buffer_degrees = self._feet_to_degrees(buffer_feet)

        try:
            # For simplicity, create a bounding box around all points with buffer
            lats = [coord[0] for coord in coordinates]
            lngs = [coord[1] for coord in coordinates]

            min_lat, max_lat = min(lats), max(lats)
            min_lng, max_lng = min(lngs), max(lngs)

            # Add buffer to bounding box
            buffer_coords = [
                (min_lat - buffer_degrees, min_lng - buffer_degrees),  # SW
                (min_lat - buffer_degrees, max_lng + buffer_degrees),  # SE
                (max_lat + buffer_degrees, max_lng + buffer_degrees),  # NE
                (max_lat + buffer_degrees, min_lng - buffer_degrees),  # NW
                (min_lat - buffer_degrees, min_lng - buffer_degrees),  # Close
            ]

            return self.generator.create_polygon(
                buffer_coords,
                confidence=0.8,
                source=f"polygon_buffer_{int(buffer_feet)}ft",
            )

        except InvalidCoordinateError as e:
            raise GeometryGenerationError(f"Cannot create polygon buffer: {e}") from e

    def _feet_to_degrees(self, feet: float) -> float:
        """Convert feet to approximate degrees.

        This is a rough approximation suitable for small distances.
        More accurate conversion would account for latitude effects.

        Args:
            feet: Distance in feet

        Returns:
            Approximate distance in degrees
        """
        # Rough conversion: 1 degree ≈ 364,000 feet at the equator
        # For Texas (around 30°N), it's approximately 314,000 feet per degree
        return feet / 364000.0


class ConfidenceScorer:
    """Calculates confidence scores for generated geometries."""

    def score_geocoding_result(
        self, relevance: float, address_components: list[str], in_texas: bool
    ) -> float:
        """Score confidence of geocoded address.

        Args:
            relevance: Relevance score from geocoding service
            address_components: List of address components found
            in_texas: Whether result is in Texas

        Returns:
            Confidence score between 0.0 and 1.0
        """
        score = relevance

        # Bonus for complete address components
        if len(address_components) >= 4:  # street, city, state, zip
            score *= 1.1
        elif len(address_components) >= 3:
            score *= 1.05

        # Penalty for locations outside Texas
        if not in_texas:
            score *= 0.7

        # Cap at 1.0
        return min(score, 1.0)

    def score_manual_coordinates(
        self, latitude: float, longitude: float, precision_claimed: str | None = None
    ) -> float:
        """Score confidence of manual GPS coordinates.

        Args:
            latitude: GPS latitude
            longitude: GPS longitude
            precision_claimed: Claimed precision level ("high", "medium", "low")

        Returns:
            Confidence score between 0.0 and 1.0
        """
        validator = CoordinateValidator()

        base_score = 0.8  # Default for manual coordinates

        # Adjust based on Texas bounds
        if validator.is_in_texas(latitude, longitude):
            score = base_score
        else:
            score = base_score * 0.6  # Significant penalty outside Texas

        # Adjust based on claimed precision
        if precision_claimed == "high":
            score *= 1.1
        elif precision_claimed == "low":
            score *= 0.8

        return min(score, 1.0)

    def score_geometry_generation(
        self, geometry_type: str, coordinate_quality: float
    ) -> float:
        """Score confidence of generated geometry.

        Args:
            geometry_type: Type of geometry generated
            coordinate_quality: Quality score of input coordinates

        Returns:
            Confidence score between 0.0 and 1.0
        """
        # Base scores by geometry type
        base_scores = {
            "point": 0.95,
            "point_buffer": 0.9,
            "linestring": 0.8,
            "linestring_buffer": 0.8,
            "polygon": 0.85,
            "polygon_buffer": 0.8,
        }

        base_score = base_scores.get(geometry_type, 0.7)

        # Adjust by coordinate quality
        return min(base_score * coordinate_quality, 1.0)

    def generate_assumptions(
        self,
        confidence: float,
        source: str,
        in_texas: bool = True,
        geocoding_relevance: float | None = None,
    ) -> list[str]:
        """Generate list of assumptions for low confidence scores.

        Args:
            confidence: Current confidence score
            source: Source of the geometry
            in_texas: Whether coordinates are in Texas
            geocoding_relevance: Geocoding relevance score if applicable

        Returns:
            List of assumption strings
        """
        assumptions = []

        if confidence < 0.5:
            assumptions.append("Very low confidence - verify coordinates manually")

        if not in_texas:
            assumptions.append("Coordinates appear to be outside Texas bounds")

        if geocoding_relevance and geocoding_relevance < 0.7:
            assumptions.append("Low geocoding confidence - address may be ambiguous")

        if "mock" in source:
            assumptions.append("Using mock data - no API key configured")

        if confidence < 0.8 and "buffer" in source:
            assumptions.append("Simple rectangular buffer used - not precise geometry")

        return assumptions
