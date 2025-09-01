"""
Tests for GIS and geocoding functionality.

Following TDD approach - comprehensive test suite covering:
- Geocoding service with Mapbox integration
- Geometry generation from GPS coordinates
- Simple geofence builder (box/polyline buffer)
- Coordinate validation and Texas bounds checking
- Confidence scoring for generated geometries
- Error handling for missing API keys
"""

from datetime import datetime
from unittest.mock import Mock, patch

import httpx
import pytest

from texas811_poc.geocoding import (
    ConfidenceScorer,
    CoordinateValidator,
    GeocodingError,
    GeocodingService,
    GeofenceBuilder,
    GeometryGenerationError,
    GeometryGenerator,
    InvalidCoordinateError,
)
from texas811_poc.models import GeometryModel, GeometryType


class TestGeocodingService:
    """Tests for the GeocodingService class."""

    def test_init_with_api_key(self):
        """Test service initialization with API key."""
        service = GeocodingService("test_key")
        assert service.api_key == "test_key"
        assert service.base_url == "https://api.mapbox.com/geocoding/v5/mapbox.places"

    def test_init_without_api_key(self):
        """Test service initialization without API key returns mock service."""
        service = GeocodingService(None)
        assert service.api_key is None
        assert hasattr(service, "_mock_mode")
        assert service._mock_mode is True

    @patch("httpx.get")
    def test_geocode_address_success(self, mock_get):
        """Test successful address geocoding."""
        # Mock successful Mapbox response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "features": [
                {
                    "center": [-97.7431, 30.2672],
                    "place_name": "123 Main St, Austin, TX 78701, United States",
                    "relevance": 0.95,
                    "properties": {},
                    "geometry": {"type": "Point", "coordinates": [-97.7431, 30.2672]},
                }
            ]
        }
        mock_get.return_value = mock_response

        service = GeocodingService("test_key")
        result = service.geocode_address("123 Main St, Austin, TX")

        assert result["latitude"] == 30.2672
        assert result["longitude"] == -97.7431
        assert result["confidence"] > 0.9
        assert "Austin" in result["formatted_address"]

    @patch("httpx.get")
    def test_geocode_address_api_error(self, mock_get):
        """Test API error handling."""
        mock_get.side_effect = httpx.RequestError("Network error")

        service = GeocodingService("test_key")
        with pytest.raises(GeocodingError, match="Geocoding request failed"):
            service.geocode_address("123 Main St, Austin, TX")

    @patch("httpx.get")
    def test_geocode_address_no_results(self, mock_get):
        """Test handling when no results found."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"features": []}
        mock_get.return_value = mock_response

        service = GeocodingService("test_key")
        with pytest.raises(GeocodingError, match="No geocoding results found"):
            service.geocode_address("Invalid Address")

    def test_geocode_address_mock_mode(self):
        """Test geocoding in mock mode (no API key)."""
        service = GeocodingService(None)
        result = service.geocode_address("123 Main St, Austin, TX")

        assert "latitude" in result
        assert "longitude" in result
        assert result["confidence"] == 0.7  # Mock confidence
        assert result["source"] == "mock_geocoding"

        # Should return Texas coordinates
        assert 25.0 <= result["latitude"] <= 37.0
        assert -107.0 <= result["longitude"] <= -93.0

    def test_reverse_geocode_success(self):
        """Test reverse geocoding from coordinates."""
        service = GeocodingService("test_key")

        with patch("httpx.get") as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "features": [
                    {
                        "place_name": "Austin, Travis County, Texas, United States",
                        "relevance": 1.0,
                        "properties": {"wikidata": "Q16559"},
                    }
                ]
            }
            mock_get.return_value = mock_response

            result = service.reverse_geocode(30.2672, -97.7431)

            assert "Austin" in result["formatted_address"]
            assert result["confidence"] == 1.0

    def test_reverse_geocode_mock_mode(self):
        """Test reverse geocoding in mock mode."""
        service = GeocodingService(None)
        result = service.reverse_geocode(30.2672, -97.7431)

        assert "formatted_address" in result
        assert result["confidence"] == 0.7
        assert result["source"] == "mock_reverse_geocoding"


class TestCoordinateValidator:
    """Tests for coordinate validation and Texas bounds checking."""

    def test_validate_texas_coordinates_valid(self):
        """Test validation of valid Texas coordinates."""
        validator = CoordinateValidator()

        # Austin coordinates
        assert validator.is_in_texas(30.2672, -97.7431) is True

        # Houston coordinates
        assert validator.is_in_texas(29.7604, -95.3698) is True

        # Dallas coordinates
        assert validator.is_in_texas(32.7767, -96.7970) is True

    def test_validate_texas_coordinates_invalid(self):
        """Test validation of coordinates outside Texas."""
        validator = CoordinateValidator()

        # New York coordinates
        assert validator.is_in_texas(40.7128, -74.0060) is False

        # California coordinates
        assert validator.is_in_texas(34.0522, -118.2437) is False

        # Mexico coordinates (south of Texas)
        assert validator.is_in_texas(24.0, -100.0) is False

    def test_validate_coordinates_basic_validation(self):
        """Test basic coordinate validation."""
        validator = CoordinateValidator()

        # Valid coordinates
        result = validator.validate_coordinates(30.2672, -97.7431)
        assert result["is_valid"] is True
        assert result["in_texas"] is True
        assert len(result["warnings"]) == 0

    def test_validate_coordinates_with_warnings(self):
        """Test coordinate validation with warnings."""
        validator = CoordinateValidator()

        # Coordinates outside Texas but valid globally
        result = validator.validate_coordinates(40.7128, -74.0060)
        assert result["is_valid"] is True
        assert result["in_texas"] is False
        assert len(result["warnings"]) > 0
        assert "outside Texas" in result["warnings"][0]

    def test_validate_coordinates_invalid_range(self):
        """Test validation of coordinates outside valid ranges."""
        validator = CoordinateValidator()

        # Invalid latitude (too high)
        with pytest.raises(InvalidCoordinateError):
            validator.validate_coordinates(91.0, -97.7431)

        # Invalid longitude (too high)
        with pytest.raises(InvalidCoordinateError):
            validator.validate_coordinates(30.2672, 181.0)

    def test_get_texas_bounds(self):
        """Test getting Texas boundary information."""
        validator = CoordinateValidator()
        bounds = validator.get_texas_bounds()

        assert bounds["min_lat"] == 25.0
        assert bounds["max_lat"] == 37.0
        assert bounds["min_lng"] == -107.0
        assert bounds["max_lng"] == -93.0


class TestGeometryGenerator:
    """Tests for geometry generation from GPS coordinates."""

    def test_create_point_geometry(self):
        """Test creating point geometry from coordinates."""
        generator = GeometryGenerator()

        geometry = generator.create_point(30.2672, -97.7431, confidence=0.95)

        assert isinstance(geometry, GeometryModel)
        assert geometry.type == GeometryType.POINT
        assert geometry.coordinates == [-97.7431, 30.2672]  # GeoJSON format: [lng, lat]
        assert geometry.confidence_score == 0.95
        assert geometry.source == "manual_coordinates"

    def test_create_linestring_geometry(self):
        """Test creating linestring geometry from coordinate array."""
        generator = GeometryGenerator()

        coordinates = [
            (30.2672, -97.7431),  # Austin
            (30.2700, -97.7400),  # Nearby point
        ]

        geometry = generator.create_linestring(coordinates, confidence=0.85)

        assert geometry.type == GeometryType.LINESTRING
        assert len(geometry.coordinates) == 2
        assert geometry.coordinates[0] == [-97.7431, 30.2672]
        assert geometry.confidence_score == 0.85

    def test_create_polygon_geometry(self):
        """Test creating polygon geometry from coordinate ring."""
        generator = GeometryGenerator()

        # Simple square around Austin
        coordinates = [
            (30.26, -97.75),  # SW
            (30.26, -97.73),  # SE
            (30.28, -97.73),  # NE
            (30.28, -97.75),  # NW
            (30.26, -97.75),  # Close the ring
        ]

        geometry = generator.create_polygon(coordinates, confidence=0.8)

        assert geometry.type == GeometryType.POLYGON
        assert len(geometry.coordinates) == 1  # One ring
        assert len(geometry.coordinates[0]) == 5  # 5 points (closed)
        assert geometry.coordinates[0][0] == geometry.coordinates[0][-1]  # Closed ring

    def test_create_geometry_with_validation(self):
        """Test geometry creation with coordinate validation."""
        generator = GeometryGenerator()

        # Valid Texas coordinates
        geometry = generator.create_point(30.2672, -97.7431)
        assert geometry.confidence_score > 0.8

        # Coordinates outside Texas should have lower confidence
        geometry = generator.create_point(40.7128, -74.0060)
        assert geometry.confidence_score < 0.7

    def test_create_geometry_invalid_coordinates(self):
        """Test error handling for invalid coordinates."""
        generator = GeometryGenerator()

        with pytest.raises(GeometryGenerationError):
            generator.create_point(91.0, -97.7431)  # Invalid latitude

    def test_geometry_metadata(self):
        """Test geometry includes proper metadata."""
        generator = GeometryGenerator()

        geometry = generator.create_point(30.2672, -97.7431, source="geocoded_address")

        assert geometry.source == "geocoded_address"
        assert isinstance(geometry.created_at, datetime)
        assert geometry.created_at.tzinfo is not None  # Should have timezone info


class TestGeofenceBuilder:
    """Tests for simple geofence generation."""

    def test_create_point_buffer_default(self):
        """Test creating default buffer around a point."""
        builder = GeofenceBuilder()

        geofence = builder.create_point_buffer(30.2672, -97.7431)

        assert geofence.type == GeometryType.POLYGON
        assert geofence.confidence_score == 0.9  # High confidence for simple buffer
        assert geofence.source == "point_buffer_25ft"

    def test_create_point_buffer_custom_distance(self):
        """Test creating custom distance buffer."""
        builder = GeofenceBuilder()

        geofence = builder.create_point_buffer(30.2672, -97.7431, buffer_feet=50)

        assert "50ft" in geofence.source

        # Buffer with 50ft should be larger than 25ft
        geofence_25 = builder.create_point_buffer(30.2672, -97.7431, buffer_feet=25)
        # Simple check: 50ft buffer should have different coordinates
        assert geofence.coordinates != geofence_25.coordinates

    def test_create_linestring_buffer(self):
        """Test creating buffer around a line."""
        builder = GeofenceBuilder()

        coordinates = [
            (30.2672, -97.7431),
            (30.2700, -97.7400),
        ]

        geofence = builder.create_linestring_buffer(coordinates)

        assert geofence.type == GeometryType.POLYGON
        assert geofence.source == "linestring_buffer_25ft"

    def test_create_polygon_buffer(self):
        """Test creating buffer around a polygon."""
        builder = GeofenceBuilder()

        coordinates = [
            (30.26, -97.75),
            (30.26, -97.73),
            (30.28, -97.73),
            (30.28, -97.75),
            (30.26, -97.75),
        ]

        geofence = builder.create_polygon_buffer(coordinates)

        assert geofence.type == GeometryType.POLYGON
        assert geofence.source == "polygon_buffer_25ft"

    def test_buffer_coordinate_validation(self):
        """Test buffer creation with coordinate validation."""
        builder = GeofenceBuilder()

        # Valid coordinates should work
        geofence = builder.create_point_buffer(30.2672, -97.7431)
        assert geofence.confidence_score > 0.8

        # Invalid coordinates should raise error
        with pytest.raises(GeometryGenerationError):
            builder.create_point_buffer(91.0, -97.7431)

    def test_feet_to_degrees_conversion(self):
        """Test the feet to degrees conversion used in buffering."""
        builder = GeofenceBuilder()

        # Test the internal conversion method
        degrees = builder._feet_to_degrees(25)

        # 25 feet should be a small fraction of a degree
        assert 0 < degrees < 0.001
        assert degrees == pytest.approx(25 / 364000, rel=1e-2)  # Approximate conversion


class TestConfidenceScorer:
    """Tests for geometry confidence scoring."""

    def test_score_geocoded_address(self):
        """Test confidence scoring for geocoded address."""
        scorer = ConfidenceScorer()

        # High relevance geocoding result
        score = scorer.score_geocoding_result(
            relevance=0.95,
            address_components=["street", "city", "state", "zip"],
            in_texas=True,
        )

        assert score > 0.9
        assert score <= 1.0

    def test_score_manual_coordinates(self):
        """Test confidence scoring for manual GPS coordinates."""
        scorer = ConfidenceScorer()

        # Manual coordinates in Texas
        score = scorer.score_manual_coordinates(
            30.2672, -97.7431, precision_claimed=None
        )

        assert score == 0.8  # Default for manual coordinates in Texas

    def test_score_coordinates_outside_texas(self):
        """Test reduced confidence for coordinates outside Texas."""
        scorer = ConfidenceScorer()

        # Manual coordinates outside Texas
        score = scorer.score_manual_coordinates(
            40.7128, -74.0060, precision_claimed=None
        )

        assert score < 0.7  # Reduced confidence outside Texas

    def test_score_with_precision_claims(self):
        """Test confidence scoring with precision metadata."""
        scorer = ConfidenceScorer()

        # High precision claim
        score_high = scorer.score_manual_coordinates(
            30.2672, -97.7431, precision_claimed="high"
        )

        # Low precision claim
        score_low = scorer.score_manual_coordinates(
            30.2672, -97.7431, precision_claimed="low"
        )

        assert score_high > score_low

    def test_score_geometry_generation(self):
        """Test confidence scoring for generated geometries."""
        scorer = ConfidenceScorer()

        # Simple point buffer should have high confidence
        score = scorer.score_geometry_generation("point_buffer", coordinate_quality=0.9)

        assert score > 0.8
        assert score <= 1.0

    def test_generate_assumptions_list(self):
        """Test generation of assumptions list for low confidence scores."""
        scorer = ConfidenceScorer()

        # Low confidence scenario
        assumptions = scorer.generate_assumptions(
            confidence=0.4,
            source="geocoded_address",
            in_texas=False,
            geocoding_relevance=0.3,
        )

        assert len(assumptions) > 0
        assert any("outside Texas" in assumption for assumption in assumptions)
        assert any(
            "geocoding confidence" in assumption.lower() for assumption in assumptions
        )


class TestGeofenceBuilderIntegration:
    """Integration tests combining multiple components."""

    def test_end_to_end_address_geocoding(self):
        """Test complete flow from address to geofence."""
        # Use None API key to trigger mock mode
        geocoding_service = GeocodingService(None)
        geofence_builder = GeofenceBuilder()

        # Geocode the address (should use mock)
        geocode_result = geocoding_service.geocode_address("123 Main St, Austin, TX")

        # Verify mock result structure
        assert "latitude" in geocode_result
        assert "longitude" in geocode_result
        assert geocode_result["source"] == "mock_geocoding"

        # Create geofence from geocoded coordinates
        geofence = geofence_builder.create_point_buffer(
            geocode_result["latitude"], geocode_result["longitude"]
        )

        assert geofence.type == GeometryType.POLYGON
        assert geofence.confidence_score > 0.8

    def test_coordinate_validation_integration(self):
        """Test coordinate validation integration with all services."""
        validator = CoordinateValidator()
        generator = GeometryGenerator()
        builder = GeofenceBuilder()

        # Valid Texas coordinates should work in all services
        lat, lng = 30.2672, -97.7431

        validation = validator.validate_coordinates(lat, lng)
        assert validation["is_valid"] is True

        geometry = generator.create_point(lat, lng)
        assert geometry.confidence_score > 0.8

        geofence = builder.create_point_buffer(lat, lng)
        assert geofence.confidence_score > 0.8

    def test_error_handling_integration(self):
        """Test error handling across all components."""
        # Invalid coordinates should be handled consistently
        invalid_lat, invalid_lng = 91.0, -97.7431

        validator = CoordinateValidator()
        generator = GeometryGenerator()
        builder = GeofenceBuilder()

        # All should raise appropriate errors
        with pytest.raises(InvalidCoordinateError):
            validator.validate_coordinates(invalid_lat, invalid_lng)

        with pytest.raises(GeometryGenerationError):
            generator.create_point(invalid_lat, invalid_lng)

        with pytest.raises(GeometryGenerationError):
            builder.create_point_buffer(invalid_lat, invalid_lng)


class TestMockModeIntegration:
    """Tests for POC mode with missing API keys."""

    def test_complete_workflow_without_api_key(self):
        """Test that complete workflow works without API key (POC mode)."""
        geocoding_service = GeocodingService(None)  # No API key
        geometry_generator = GeometryGenerator()
        geofence_builder = GeofenceBuilder()

        # Geocode should return mock data
        result = geocoding_service.geocode_address("123 Main St, Austin, TX")
        assert result["source"] == "mock_geocoding"
        assert result["confidence"] == 0.7

        # Generate geometry from mock coordinates
        geometry = geometry_generator.create_point(
            result["latitude"], result["longitude"], confidence=result["confidence"]
        )

        # Create geofence
        geofence = geofence_builder.create_point_buffer(
            result["latitude"], result["longitude"]
        )

        # All should work and produce valid results
        assert geometry.type == GeometryType.POINT
        assert geofence.type == GeometryType.POLYGON
        assert geometry.confidence_score == 0.7


# Test fixtures and utilities
@pytest.fixture
def sample_texas_coordinates():
    """Sample coordinates for major Texas cities."""
    return {
        "austin": (30.2672, -97.7431),
        "houston": (29.7604, -95.3698),
        "dallas": (32.7767, -96.7970),
        "san_antonio": (29.4241, -98.4936),
        "fort_worth": (32.7555, -97.3308),
    }


@pytest.fixture
def mock_mapbox_response():
    """Mock Mapbox API response for testing."""
    return {
        "features": [
            {
                "center": [-97.7431, 30.2672],
                "place_name": "123 Main St, Austin, Travis County, Texas 78701, United States",
                "relevance": 0.95,
                "properties": {},
                "geometry": {"type": "Point", "coordinates": [-97.7431, 30.2672]},
                "bbox": [-97.7441, 30.2662, -97.7421, 30.2682],
            }
        ]
    }
