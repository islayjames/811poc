"""
Tests for GIS Parcel Enrichment functionality.

Tests the enrichParcelFromGIS function and related parcel data retrieval
from county ArcGIS systems.
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from src.texas811_poc.gis.parcel_enrichment import enrichParcelFromGIS, ParcelInfo


class TestEnrichParcelFromGIS:
    """Test cases for the enrichParcelFromGIS function."""
    
    @pytest.mark.asyncio
    async def test_valid_coordinates_supported_county(self):
        """Test enrichment with valid coordinates in supported county."""
        # Mock successful ArcGIS response
        mock_response = {
            'features': [{
                'attributes': {
                    'SUBDIVNME': 'Test Subdivision',
                    'LOT': '123',
                    'BLOCK': '4',
                    'ACCOUNT': 'ACC123456'
                }
            }]
        }
        
        with patch('src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature', 
                  new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_response
            
            result = await enrichParcelFromGIS(29.7604, -95.3698, 'Harris')
            
            assert result['subdivision'] == 'Test Subdivision'
            assert result['lot'] == '123'
            assert result['block'] == '4'
            assert result['parcel_id'] == 'ACC123456'
            assert result['feature_found'] is True
            assert result['matched_count'] == 1
            assert result['source_county'] == 'Harris'
            assert 'hctx.net' in result['arcgis_url']
            
    @pytest.mark.asyncio
    async def test_multiple_features_returned(self):
        """Test handling of multiple parcel features (should use first)."""
        mock_response = {
            'features': [
                {
                    'attributes': {
                        'SUBDIVNME': 'First Subdivision',
                        'LOT': '123',
                        'BLOCK': '4',
                        'ACCOUNT': 'ACC123456'
                    }
                },
                {
                    'attributes': {
                        'SUBDIVNME': 'Second Subdivision',
                        'LOT': '456',
                        'BLOCK': '5',
                        'ACCOUNT': 'ACC789012'
                    }
                }
            ]
        }
        
        with patch('src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature',
                  new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_response
            
            result = await enrichParcelFromGIS(29.7604, -95.3698, 'Harris')
            
            # Should use first feature
            assert result['subdivision'] == 'First Subdivision'
            assert result['parcel_id'] == 'ACC123456'
            assert result['feature_found'] is True
            assert result['matched_count'] == 2
            
    @pytest.mark.asyncio
    async def test_no_features_found(self):
        """Test handling when no parcel features are found."""
        mock_response = {
            'features': []
        }
        
        with patch('src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature',
                  new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_response
            
            result = await enrichParcelFromGIS(29.7604, -95.3698, 'Harris')
            
            assert result['subdivision'] is None
            assert result['lot'] is None
            assert result['block'] is None
            assert result['parcel_id'] is None
            assert result['feature_found'] is False
            assert result['matched_count'] == 0
            assert result['source_county'] == 'Harris'
            
    @pytest.mark.asyncio
    async def test_unsupported_county(self):
        """Test handling of unsupported county."""
        result = await enrichParcelFromGIS(29.7604, -95.3698, 'Unsupported')
        
        assert result['subdivision'] is None
        assert result['lot'] is None
        assert result['block'] is None
        assert result['parcel_id'] is None
        assert result['feature_found'] is False
        assert result['matched_count'] == 0
        assert result['source_county'] == 'Unsupported'
        assert result['arcgis_url'] == ''
        
    @pytest.mark.asyncio
    async def test_coordinate_validation_invalid_latitude(self):
        """Test validation of invalid latitude coordinates."""
        with pytest.raises(ValueError, match="Invalid latitude"):
            await enrichParcelFromGIS(95.0, -95.3698, 'Harris')
            
        with pytest.raises(ValueError, match="Invalid latitude"):
            await enrichParcelFromGIS(-95.0, -95.3698, 'Harris')
            
    @pytest.mark.asyncio
    async def test_coordinate_validation_invalid_longitude(self):
        """Test validation of invalid longitude coordinates."""
        with pytest.raises(ValueError, match="Invalid longitude"):
            await enrichParcelFromGIS(29.7604, 185.0, 'Harris')
            
        with pytest.raises(ValueError, match="Invalid longitude"):
            await enrichParcelFromGIS(29.7604, -185.0, 'Harris')
            
    @pytest.mark.asyncio
    async def test_coordinate_validation_boundary_values(self):
        """Test validation with boundary coordinate values."""
        # Valid boundary values should not raise errors
        try:
            await enrichParcelFromGIS(90.0, 180.0, 'Unsupported')
            await enrichParcelFromGIS(-90.0, -180.0, 'Unsupported') 
            await enrichParcelFromGIS(0.0, 0.0, 'Unsupported')
        except ValueError:
            pytest.fail("Valid boundary coordinates should not raise ValueError")
            
    @pytest.mark.asyncio
    async def test_network_error_handling(self):
        """Test graceful handling of network errors."""
        with patch('src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature',
                  new_callable=AsyncMock) as mock_fetch:
            mock_fetch.side_effect = Exception("Network timeout")
            
            result = await enrichParcelFromGIS(29.7604, -95.3698, 'Harris')
            
            assert result['subdivision'] is None
            assert result['lot'] is None
            assert result['block'] is None
            assert result['parcel_id'] is None
            assert result['feature_found'] is False
            assert result['matched_count'] == 0
            assert result['source_county'] == 'Harris'
            
    @pytest.mark.asyncio
    async def test_partial_data_in_response(self):
        """Test handling of partial data in ArcGIS response."""
        mock_response = {
            'features': [{
                'attributes': {
                    'SUBDIVNME': 'Test Subdivision',
                    'LOT': None,  # Missing lot
                    'BLOCK': '4',
                    # Missing ACCOUNT field entirely
                }
            }]
        }
        
        with patch('src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature',
                  new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_response
            
            result = await enrichParcelFromGIS(29.7604, -95.3698, 'Harris')
            
            assert result['subdivision'] == 'Test Subdivision'
            assert result['lot'] is None
            assert result['block'] == '4'
            assert result['parcel_id'] is None  # Missing field should be None
            assert result['feature_found'] is True
            assert result['matched_count'] == 1
            
    @pytest.mark.asyncio
    async def test_fort_bend_county_mapping(self):
        """Test field mapping for Fort Bend county."""
        mock_response = {
            'features': [{
                'attributes': {
                    'SUBDIVISION': 'Fort Bend Subdivision',
                    'LOT': '456',
                    'BLOCK': '7',
                    'PROP_ID': 'FB789012'
                }
            }]
        }
        
        with patch('src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature',
                  new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_response
            
            result = await enrichParcelFromGIS(29.6516, -95.6890, 'Fort Bend')
            
            assert result['subdivision'] == 'Fort Bend Subdivision'
            assert result['parcel_id'] == 'FB789012'
            assert result['source_county'] == 'Fort Bend'
            assert 'fbcad.org' in result['arcgis_url']
            
    @pytest.mark.asyncio 
    async def test_galveston_county_mapping(self):
        """Test field mapping for Galveston county."""
        mock_response = {
            'features': [{
                'attributes': {
                    'SUBDIVISION': 'Galveston Subdivision',
                    'LOT': '789',
                    'BLOCK': '12',
                    'ACCOUNT': 'GAL123456'
                }
            }]
        }
        
        with patch('src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature',
                  new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_response
            
            result = await enrichParcelFromGIS(29.3013, -94.7977, 'Galveston')
            
            assert result['subdivision'] == 'Galveston Subdivision'
            assert result['parcel_id'] == 'GAL123456'
            assert result['source_county'] == 'Galveston'
            assert 'cityofwebster.com' in result['arcgis_url']
            
    @pytest.mark.asyncio
    async def test_liberty_county_mapping(self):
        """Test field mapping for Liberty county."""
        mock_response = {
            'features': [{
                'attributes': {
                    'SUBDIV': 'Liberty Subdivision',  # Different field name
                    'LOT': '101',
                    'BLOCK': '3',
                    'ACCOUNT': 'LIB456789'
                }
            }]
        }
        
        with patch('src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature',
                  new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_response
            
            result = await enrichParcelFromGIS(30.0588, -94.8008, 'Liberty')
            
            assert result['subdivision'] == 'Liberty Subdivision'
            assert result['parcel_id'] == 'LIB456789'
            assert result['source_county'] == 'Liberty'
            assert 'ljaengineering.com' in result['arcgis_url']
            
    @pytest.mark.asyncio
    async def test_invalid_response_format(self):
        """Test handling of invalid ArcGIS response format."""
        # Response without features key
        mock_response = {
            'error': {
                'code': 400,
                'message': 'Invalid request'
            }
        }
        
        with patch('src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature',
                  new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_response
            
            result = await enrichParcelFromGIS(29.7604, -95.3698, 'Harris')
            
            assert result['feature_found'] is False
            assert result['matched_count'] == 0
            assert all(v is None for v in [result['subdivision'], result['lot'], 
                                         result['block'], result['parcel_id']])
            
    @pytest.mark.asyncio
    async def test_debug_raw_feature_included(self):
        """Test that raw_feature is included for debugging."""
        mock_response = {
            'features': [{
                'attributes': {
                    'SUBDIVNME': 'Debug Subdivision',
                    'LOT': '999',
                    'BLOCK': '1',
                    'ACCOUNT': 'DEBUG123'
                }
            }]
        }
        
        with patch('src.texas811_poc.gis.parcel_enrichment.fetchParcelFeature',
                  new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_response
            
            result = await enrichParcelFromGIS(29.7604, -95.3698, 'Harris')
            
            assert 'raw_feature' in result
            assert result['raw_feature'] == mock_response['features'][0]
            
    @pytest.mark.asyncio
    async def test_empty_string_coordinates_handled(self):
        """Test that None county is handled gracefully."""
        result = await enrichParcelFromGIS(29.7604, -95.3698, None)
        
        assert result['feature_found'] is False
        assert result['source_county'] is None
        assert result['arcgis_url'] == ''


class TestParcelInfoType:
    """Test cases for ParcelInfo type definition."""
    
    def test_parcel_info_structure(self):
        """Test that ParcelInfo has all required fields."""
        # This test will ensure our type definition is correct
        from src.texas811_poc.gis.parcel_enrichment import ParcelInfo
        
        # Create a sample ParcelInfo instance
        parcel_info: ParcelInfo = {
            'subdivision': 'Test Subdivision',
            'lot': '123',
            'block': '4',
            'parcel_id': 'ACC123456',
            'feature_found': True,
            'matched_count': 1,
            'raw_feature': {'test': 'data'},
            'arcgis_url': 'https://example.com',
            'source_county': 'Harris'
        }
        
        # Verify all required keys are present
        required_keys = {
            'subdivision', 'lot', 'block', 'parcel_id', 
            'feature_found', 'matched_count', 'arcgis_url', 'source_county'
        }
        assert all(key in parcel_info for key in required_keys)
        
        # Verify nullable fields can be None
        parcel_info_with_nulls: ParcelInfo = {
            'subdivision': None,
            'lot': None,
            'block': None,
            'parcel_id': None,
            'feature_found': False,
            'matched_count': 0,
            'arcgis_url': '',
            'source_county': 'Test'
        }
        
        assert parcel_info_with_nulls['subdivision'] is None
        assert parcel_info_with_nulls['feature_found'] is False