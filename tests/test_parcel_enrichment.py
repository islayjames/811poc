"""
Tests for GIS Parcel Enrichment functionality.

Tests the enrichParcelFromGIS function and related parcel data retrieval
from county ArcGIS systems.
"""

from unittest.mock import AsyncMock, Mock, patch

import pytest
from httpx import RequestError, TimeoutException

from src.texas811_poc.gis.parcel_enrichment import (
    enrichParcelFromGIS,
    fetchParcelFeature,
)


class TestEnrichParcelFromGIS:
    """Test cases for the enrichParcelFromGIS function."""

    @pytest.mark.asyncio
    async def test_valid_coordinates_supported_county(self):
        """Test enrichment with valid coordinates in supported county."""
        # Mock successful ArcGIS response
        mock_response = {
            "features": [
                {
                    "attributes": {
                        "SUBDIVNME": "Test Subdivision",
                        "LOT": "123",
                        "BLOCK": "4",
                        "ACCOUNT": "ACC123456",
                    }
                }
            ]
        }

        with patch(
            "src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature",
            new_callable=AsyncMock,
        ) as mock_fetch:
            mock_fetch.return_value = mock_response

            result = await enrichParcelFromGIS(29.7604, -95.3698, "Harris")

            assert result["subdivision"] == "Test Subdivision"
            assert result["lot"] == "123"
            assert result["block"] == "4"
            assert result["parcel_id"] == "ACC123456"
            assert result["feature_found"] is True
            assert result["matched_count"] == 1
            assert result["source_county"] == "Harris"
            assert "hctx.net" in result["arcgis_url"]

    @pytest.mark.asyncio
    async def test_multiple_features_returned(self):
        """Test handling of multiple parcel features (should use first)."""
        mock_response = {
            "features": [
                {
                    "attributes": {
                        "SUBDIVNME": "First Subdivision",
                        "LOT": "123",
                        "BLOCK": "4",
                        "ACCOUNT": "ACC123456",
                    }
                },
                {
                    "attributes": {
                        "SUBDIVNME": "Second Subdivision",
                        "LOT": "456",
                        "BLOCK": "5",
                        "ACCOUNT": "ACC789012",
                    }
                },
            ]
        }

        with patch(
            "src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature",
            new_callable=AsyncMock,
        ) as mock_fetch:
            mock_fetch.return_value = mock_response

            result = await enrichParcelFromGIS(29.7604, -95.3698, "Harris")

            # Should use first feature
            assert result["subdivision"] == "First Subdivision"
            assert result["parcel_id"] == "ACC123456"
            assert result["feature_found"] is True
            assert result["matched_count"] == 2

    @pytest.mark.asyncio
    async def test_no_features_found(self):
        """Test handling when no parcel features are found."""
        mock_response = {"features": []}

        with patch(
            "src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature",
            new_callable=AsyncMock,
        ) as mock_fetch:
            mock_fetch.return_value = mock_response

            result = await enrichParcelFromGIS(29.7604, -95.3698, "Harris")

            assert result["subdivision"] is None
            assert result["lot"] is None
            assert result["block"] is None
            assert result["parcel_id"] is None
            assert result["feature_found"] is False
            assert result["matched_count"] == 0
            assert result["source_county"] == "Harris"

    @pytest.mark.asyncio
    async def test_unsupported_county(self):
        """Test handling of unsupported county."""
        result = await enrichParcelFromGIS(29.7604, -95.3698, "Unsupported")

        assert result["subdivision"] is None
        assert result["lot"] is None
        assert result["block"] is None
        assert result["parcel_id"] is None
        assert result["feature_found"] is False
        assert result["matched_count"] == 0
        assert result["source_county"] == "Unsupported"
        assert result["arcgis_url"] == ""

    @pytest.mark.asyncio
    async def test_coordinate_validation_invalid_latitude(self):
        """Test validation of invalid latitude coordinates."""
        with pytest.raises(ValueError, match="Invalid latitude"):
            await enrichParcelFromGIS(95.0, -95.3698, "Harris")

        with pytest.raises(ValueError, match="Invalid latitude"):
            await enrichParcelFromGIS(-95.0, -95.3698, "Harris")

    @pytest.mark.asyncio
    async def test_coordinate_validation_invalid_longitude(self):
        """Test validation of invalid longitude coordinates."""
        with pytest.raises(ValueError, match="Invalid longitude"):
            await enrichParcelFromGIS(29.7604, 185.0, "Harris")

        with pytest.raises(ValueError, match="Invalid longitude"):
            await enrichParcelFromGIS(29.7604, -185.0, "Harris")

    @pytest.mark.asyncio
    async def test_coordinate_validation_boundary_values(self):
        """Test validation with boundary coordinate values."""
        # Valid boundary values should not raise errors
        try:
            await enrichParcelFromGIS(90.0, 180.0, "Unsupported")
            await enrichParcelFromGIS(-90.0, -180.0, "Unsupported")
            await enrichParcelFromGIS(0.0, 0.0, "Unsupported")
        except ValueError:
            pytest.fail("Valid boundary coordinates should not raise ValueError")

    @pytest.mark.asyncio
    async def test_network_error_handling(self):
        """Test graceful handling of network errors."""
        with patch(
            "src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature",
            new_callable=AsyncMock,
        ) as mock_fetch:
            mock_fetch.side_effect = Exception("Network timeout")

            result = await enrichParcelFromGIS(29.7604, -95.3698, "Harris")

            assert result["subdivision"] is None
            assert result["lot"] is None
            assert result["block"] is None
            assert result["parcel_id"] is None
            assert result["feature_found"] is False
            assert result["matched_count"] == 0
            assert result["source_county"] == "Harris"

    @pytest.mark.asyncio
    async def test_partial_data_in_response(self):
        """Test handling of partial data in ArcGIS response."""
        mock_response = {
            "features": [
                {
                    "attributes": {
                        "SUBDIVNME": "Test Subdivision",
                        "LOT": None,  # Missing lot
                        "BLOCK": "4",
                        # Missing ACCOUNT field entirely
                    }
                }
            ]
        }

        with patch(
            "src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature",
            new_callable=AsyncMock,
        ) as mock_fetch:
            mock_fetch.return_value = mock_response

            result = await enrichParcelFromGIS(29.7604, -95.3698, "Harris")

            assert result["subdivision"] == "Test Subdivision"
            assert result["lot"] is None
            assert result["block"] == "4"
            assert result["parcel_id"] is None  # Missing field should be None
            assert result["feature_found"] is True
            assert result["matched_count"] == 1

    @pytest.mark.asyncio
    async def test_fort_bend_county_mapping(self):
        """Test field mapping for Fort Bend county."""
        mock_response = {
            "features": [
                {
                    "attributes": {
                        "SUBDIVISION": "Fort Bend Subdivision",
                        "LOT": "456",
                        "BLOCK": "7",
                        "PROP_ID": "FB789012",
                    }
                }
            ]
        }

        with patch(
            "src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature",
            new_callable=AsyncMock,
        ) as mock_fetch:
            mock_fetch.return_value = mock_response

            result = await enrichParcelFromGIS(29.6516, -95.6890, "Fort Bend")

            assert result["subdivision"] == "Fort Bend Subdivision"
            assert result["parcel_id"] == "FB789012"
            assert result["source_county"] == "Fort Bend"
            assert "fbcad.org" in result["arcgis_url"]

    @pytest.mark.asyncio
    async def test_galveston_county_mapping(self):
        """Test field mapping for Galveston county."""
        mock_response = {
            "features": [
                {
                    "attributes": {
                        "SUBDIVISION": "Galveston Subdivision",
                        "LOT": "789",
                        "BLOCK": "12",
                        "ACCOUNT": "GAL123456",
                    }
                }
            ]
        }

        with patch(
            "src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature",
            new_callable=AsyncMock,
        ) as mock_fetch:
            mock_fetch.return_value = mock_response

            result = await enrichParcelFromGIS(29.3013, -94.7977, "Galveston")

            assert result["subdivision"] == "Galveston Subdivision"
            assert result["parcel_id"] == "GAL123456"
            assert result["source_county"] == "Galveston"
            assert "cityofwebster.com" in result["arcgis_url"]

    @pytest.mark.asyncio
    async def test_liberty_county_mapping(self):
        """Test field mapping for Liberty county."""
        mock_response = {
            "features": [
                {
                    "attributes": {
                        "SUBDIV": "Liberty Subdivision",  # Different field name
                        "LOT": "101",
                        "BLOCK": "3",
                        "ACCOUNT": "LIB456789",
                    }
                }
            ]
        }

        with patch(
            "src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature",
            new_callable=AsyncMock,
        ) as mock_fetch:
            mock_fetch.return_value = mock_response

            result = await enrichParcelFromGIS(30.0588, -94.8008, "Liberty")

            assert result["subdivision"] == "Liberty Subdivision"
            assert result["parcel_id"] == "LIB456789"
            assert result["source_county"] == "Liberty"
            assert "ljaengineering.com" in result["arcgis_url"]

    @pytest.mark.asyncio
    async def test_invalid_response_format(self):
        """Test handling of invalid ArcGIS response format."""
        # Response without features key
        mock_response = {"error": {"code": 400, "message": "Invalid request"}}

        with patch(
            "src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature",
            new_callable=AsyncMock,
        ) as mock_fetch:
            mock_fetch.return_value = mock_response

            result = await enrichParcelFromGIS(29.7604, -95.3698, "Harris")

            assert result["feature_found"] is False
            assert result["matched_count"] == 0
            assert all(
                v is None
                for v in [
                    result["subdivision"],
                    result["lot"],
                    result["block"],
                    result["parcel_id"],
                ]
            )

    @pytest.mark.asyncio
    async def test_debug_raw_feature_included(self):
        """Test that raw_feature is included for debugging."""
        mock_response = {
            "features": [
                {
                    "attributes": {
                        "SUBDIVNME": "Debug Subdivision",
                        "LOT": "999",
                        "BLOCK": "1",
                        "ACCOUNT": "DEBUG123",
                    }
                }
            ]
        }

        with patch(
            "src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature",
            new_callable=AsyncMock,
        ) as mock_fetch:
            mock_fetch.return_value = mock_response

            result = await enrichParcelFromGIS(29.7604, -95.3698, "Harris")

            assert "raw_feature" in result
            assert result["raw_feature"] == mock_response["features"][0]

    @pytest.mark.asyncio
    async def test_empty_string_coordinates_handled(self):
        """Test that None county is handled gracefully."""
        result = await enrichParcelFromGIS(29.7604, -95.3698, None)

        assert result["feature_found"] is False
        assert result["source_county"] is None
        assert result["arcgis_url"] == ""


class TestParcelInfoType:
    """Test cases for ParcelInfo type definition."""

    def test_parcel_info_structure(self):
        """Test that ParcelInfo has all required fields."""
        # This test will ensure our type definition is correct
        from src.texas811_poc.gis.parcel_enrichment import ParcelInfo

        # Create a sample ParcelInfo instance
        parcel_info: ParcelInfo = {
            "subdivision": "Test Subdivision",
            "lot": "123",
            "block": "4",
            "parcel_id": "ACC123456",
            "feature_found": True,
            "matched_count": 1,
            "raw_feature": {"test": "data"},
            "arcgis_url": "https://example.com",
            "source_county": "Harris",
        }

        # Verify all required keys are present
        required_keys = {
            "subdivision",
            "lot",
            "block",
            "parcel_id",
            "feature_found",
            "matched_count",
            "arcgis_url",
            "source_county",
        }
        assert all(key in parcel_info for key in required_keys)

        # Verify nullable fields can be None
        parcel_info_with_nulls: ParcelInfo = {
            "subdivision": None,
            "lot": None,
            "block": None,
            "parcel_id": None,
            "feature_found": False,
            "matched_count": 0,
            "arcgis_url": "",
            "source_county": "Test",
        }

        assert parcel_info_with_nulls["subdivision"] is None
        assert parcel_info_with_nulls["feature_found"] is False


class TestFetchParcelFeature:
    """Test cases for the fetchParcelFeature HTTP client function."""

    @pytest.fixture
    def harris_resolver(self):
        """Sample Harris county resolver for testing."""
        return {
            "name": "Harris County",
            "arcgis_url": "https://gis.hctx.net/arcgis/rest/services/parcel/MapServer/0",
            "out_fields": {
                "subdivision": "SUBDIVNME",
                "lot": "LOT",
                "block": "BLOCK",
                "parcel_id": "ACCOUNT",
            },
        }

    @pytest.mark.asyncio
    async def test_successful_arcgis_response(self, harris_resolver):
        """Test successful ArcGIS API response parsing."""
        expected_response = {
            "features": [
                {
                    "attributes": {
                        "SUBDIVNME": "Test Subdivision",
                        "LOT": "123",
                        "BLOCK": "4",
                        "ACCOUNT": "ACC123456",
                    }
                }
            ]
        }

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_response = Mock()
            mock_response.json.return_value = expected_response
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response

            result = await fetchParcelFeature(29.7604, -95.3698, harris_resolver)

            assert result == expected_response
            # Verify correct query parameters were constructed
            mock_get.assert_called_once()
            call_args = mock_get.call_args
            assert call_args[1]["params"]["geometry"] == "-95.3698,29.7604"
            assert call_args[1]["params"]["geometryType"] == "esriGeometryPoint"
            assert call_args[1]["params"]["inSR"] == "4326"
            assert call_args[1]["params"]["spatialRel"] == "esriSpatialRelIntersects"
            assert call_args[1]["params"]["outFields"] == "SUBDIVNME,LOT,BLOCK,ACCOUNT"
            assert call_args[1]["params"]["returnGeometry"] == "false"
            assert call_args[1]["params"]["f"] == "json"

    @pytest.mark.asyncio
    async def test_empty_features_response(self, harris_resolver):
        """Test ArcGIS response with no features found."""
        expected_response = {"features": []}

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_response = Mock()
            mock_response.json.return_value = expected_response
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response

            result = await fetchParcelFeature(29.7604, -95.3698, harris_resolver)

            assert result == expected_response
            assert len(result["features"]) == 0

    @pytest.mark.asyncio
    async def test_multiple_features_response(self, harris_resolver):
        """Test ArcGIS response with multiple features."""
        expected_response = {
            "features": [
                {
                    "attributes": {
                        "SUBDIVNME": "First Subdivision",
                        "LOT": "123",
                        "BLOCK": "4",
                        "ACCOUNT": "ACC123456",
                    }
                },
                {
                    "attributes": {
                        "SUBDIVNME": "Second Subdivision",
                        "LOT": "456",
                        "BLOCK": "5",
                        "ACCOUNT": "ACC789012",
                    }
                },
            ]
        }

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_response = Mock()
            mock_response.json.return_value = expected_response
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response

            result = await fetchParcelFeature(29.7604, -95.3698, harris_resolver)

            assert result == expected_response
            assert len(result["features"]) == 2

    @pytest.mark.asyncio
    async def test_timeout_error_handling(self, harris_resolver):
        """Test handling of HTTP timeout errors."""
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.side_effect = TimeoutException("Request timeout")

            with pytest.raises(Exception, match="Request timeout"):
                await fetchParcelFeature(29.7604, -95.3698, harris_resolver)

    @pytest.mark.asyncio
    async def test_network_error_handling(self, harris_resolver):
        """Test handling of network connection errors."""
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.side_effect = RequestError("Connection failed")

            with pytest.raises(Exception, match="Connection failed"):
                await fetchParcelFeature(29.7604, -95.3698, harris_resolver)

    @pytest.mark.asyncio
    async def test_http_status_error_handling(self, harris_resolver):
        """Test handling of HTTP status errors (4xx, 5xx)."""
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_response = Mock()
            mock_response.raise_for_status.side_effect = Exception(
                "HTTP 500 Internal Server Error"
            )
            mock_get.return_value = mock_response

            with pytest.raises(Exception, match="HTTP 500 Internal Server Error"):
                await fetchParcelFeature(29.7604, -95.3698, harris_resolver)

    @pytest.mark.asyncio
    async def test_malformed_json_response(self, harris_resolver):
        """Test handling of malformed JSON in response."""
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_response = Mock()
            mock_response.json.side_effect = ValueError("Invalid JSON")
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response

            with pytest.raises(Exception, match="Invalid JSON"):
                await fetchParcelFeature(29.7604, -95.3698, harris_resolver)

    @pytest.mark.asyncio
    async def test_arcgis_error_response(self, harris_resolver):
        """Test handling of ArcGIS API error responses."""
        error_response = {
            "error": {
                "code": 400,
                "message": "Invalid geometry",
                "details": ["The specified geometry is invalid"],
            }
        }

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_response = Mock()
            mock_response.json.return_value = error_response
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response

            result = await fetchParcelFeature(29.7604, -95.3698, harris_resolver)

            # Should return the error response as-is for upstream handling
            assert result == error_response
            assert "error" in result

    @pytest.mark.asyncio
    async def test_retry_logic_eventual_success(self, harris_resolver):
        """Test retry logic succeeds after initial failures."""
        successful_response = {
            "features": [
                {
                    "attributes": {
                        "SUBDIVNME": "Retry Success",
                        "LOT": "789",
                        "BLOCK": "10",
                        "ACCOUNT": "RETRY123",
                    }
                }
            ]
        }

        with patch("httpx.AsyncClient.get") as mock_get:
            # First two calls fail, third succeeds
            mock_get.side_effect = [
                TimeoutException("First timeout"),
                RequestError("Second failure"),
                Mock(json=lambda: successful_response, raise_for_status=lambda: None),
            ]

            result = await fetchParcelFeature(29.7604, -95.3698, harris_resolver)

            assert result == successful_response
            assert mock_get.call_count == 3

    @pytest.mark.asyncio
    async def test_retry_logic_max_attempts_exceeded(self, harris_resolver):
        """Test retry logic fails after max attempts."""
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.side_effect = TimeoutException("Persistent timeout")

            with pytest.raises(Exception, match="Persistent timeout"):
                await fetchParcelFeature(29.7604, -95.3698, harris_resolver)

            # Should attempt initial call + 2 retries = 3 total attempts
            assert mock_get.call_count == 3

    @pytest.mark.asyncio
    async def test_query_parameter_construction_different_counties(self):
        """Test query parameter construction for different county field mappings."""
        fort_bend_resolver = {
            "name": "Fort Bend County",
            "arcgis_url": "https://gis.fbcad.org/arcgis/rest/services/parcels/MapServer/0",
            "out_fields": {
                "subdivision": "SUBDIVISION",
                "lot": "LOT",
                "block": "BLOCK",
                "parcel_id": "PROP_ID",
            },
        }

        expected_response = {"features": []}

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_response = Mock()
            mock_response.json.return_value = expected_response
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response

            await fetchParcelFeature(29.6516, -95.6890, fort_bend_resolver)

            # Verify Fort Bend specific outFields parameter
            call_args = mock_get.call_args
            assert (
                call_args[1]["params"]["outFields"] == "SUBDIVISION,LOT,BLOCK,PROP_ID"
            )
            assert call_args[1]["params"]["geometry"] == "-95.689,29.6516"

    @pytest.mark.asyncio
    async def test_http_timeout_configuration(self, harris_resolver):
        """Test that HTTP client uses correct timeout configuration."""
        expected_response = {"features": []}

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_response = Mock()
            mock_response.json.return_value = expected_response
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response

            await fetchParcelFeature(29.7604, -95.3698, harris_resolver)

            # Verify timeout was set to 5 seconds
            call_args = mock_get.call_args
            assert call_args[1]["timeout"] == 5.0

    @pytest.mark.asyncio
    async def test_exponential_backoff_timing(self, harris_resolver):
        """Test exponential backoff timing between retry attempts."""
        with (
            patch("httpx.AsyncClient.get") as mock_get,
            patch("asyncio.sleep") as mock_sleep,
        ):

            mock_get.side_effect = TimeoutException("Timeout for all attempts")

            try:
                await fetchParcelFeature(29.7604, -95.3698, harris_resolver)
            except TimeoutException:
                pass  # Expected to fail after all retries

            # Verify exponential backoff sleep calls
            # First retry: 1 second, second retry: 2 seconds
            expected_sleep_calls = [1, 2]
            actual_sleep_calls = [call[0][0] for call in mock_sleep.call_args_list]
            assert actual_sleep_calls == expected_sleep_calls

    @pytest.mark.asyncio
    async def test_url_construction(self, harris_resolver):
        """Test that the correct ArcGIS query URL is constructed."""
        expected_response = {"features": []}

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_response = Mock()
            mock_response.json.return_value = expected_response
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response

            await fetchParcelFeature(29.7604, -95.3698, harris_resolver)

            # Verify the URL includes /query endpoint
            call_args = mock_get.call_args
            expected_url = harris_resolver["arcgis_url"] + "/query"
            assert call_args[0][0] == expected_url
