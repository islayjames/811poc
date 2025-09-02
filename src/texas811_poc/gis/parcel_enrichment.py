"""
GIS Parcel Enrichment Module.

This module provides functionality to enrich location data with parcel information
from county-specific ArcGIS systems. It integrates with County Appraisal District
(CAD) systems to retrieve subdivision, lot, block, and parcel ID information.

Key Features:
- Async parcel data enrichment from county ArcGIS endpoints
- Coordinate validation and bounds checking
- Graceful error handling for unsupported counties and network failures
- Structured response format with debugging information
- Support for Harris, Fort Bend, Galveston, and Liberty counties

Usage:
    result = await enrichParcelFromGIS(29.7604, -95.3698, 'Harris')
    if result['feature_found']:
        print(f"Parcel ID: {result['parcel_id']}")
"""

import logging
from typing import Dict, Any, Optional, Union
from .cad_resolvers import get_resolver

# Set up logging
logger = logging.getLogger(__name__)

# Type definition for ParcelInfo return value
ParcelInfo = Dict[str, Union[str, bool, int, Dict[str, Any], None]]


async def enrichParcelFromGIS(lat: float, lng: float, county: Optional[str]) -> ParcelInfo:
    """
    Enrich location data with parcel information from county ArcGIS systems.
    
    This function queries county-specific ArcGIS endpoints to retrieve detailed
    parcel information including subdivision, lot, block, and parcel ID. It handles
    coordinate validation, unsupported counties, and network errors gracefully.
    
    Args:
        lat: Latitude coordinate (-90 to 90)
        lng: Longitude coordinate (-180 to 180)  
        county: County name (case insensitive), or None
        
    Returns:
        ParcelInfo dict containing:
        - subdivision: Subdivision name (nullable string)
        - lot: Lot number (nullable string) 
        - block: Block number (nullable string)
        - parcel_id: Parcel/account ID (nullable string)
        - feature_found: True if parcel data was found (bool)
        - matched_count: Number of features returned from query (int)
        - raw_feature: Raw ArcGIS feature data for debugging (optional)
        - arcgis_url: ArcGIS endpoint URL used for query (string)
        - source_county: Original county parameter (string or None)
        
    Raises:
        ValueError: If coordinates are outside valid bounds
        
    Examples:
        >>> result = await enrichParcelFromGIS(29.7604, -95.3698, 'Harris')
        >>> result['feature_found']
        True
        >>> result['parcel_id'] 
        'ACC123456'
        
        >>> result = await enrichParcelFromGIS(29.7604, -95.3698, 'Unsupported')
        >>> result['feature_found']
        False
    """
    logger.info(f"Starting parcel enrichment for lat={lat}, lng={lng}, county={county}")
    
    # Validate coordinates
    _validate_coordinates(lat, lng)
    
    # Initialize return structure with defaults
    parcel_info: ParcelInfo = {
        'subdivision': None,
        'lot': None,
        'block': None,
        'parcel_id': None,
        'feature_found': False,
        'matched_count': 0,
        'arcgis_url': '',
        'source_county': county
    }
    
    # Handle unsupported or None county
    resolver = get_resolver(county)
    if not resolver:
        logger.warning(f"County '{county}' is not supported for parcel enrichment")
        return parcel_info
        
    # Set ArcGIS URL in response
    parcel_info['arcgis_url'] = resolver['arcgis_url']
    
    try:
        # Query ArcGIS endpoint for parcel features
        logger.debug(f"Querying {resolver['name']} for parcel data")
        response = await fetchParcelFeature(lat, lng, resolver)
        
        # Process response and extract parcel information
        return _process_arcgis_response(response, resolver, parcel_info)
        
    except Exception as e:
        logger.error(f"Error enriching parcel data for {county}: {str(e)}")
        # Return default structure on any error - graceful degradation
        return parcel_info


def _validate_coordinates(lat: float, lng: float) -> None:
    """
    Validate latitude and longitude coordinates are within valid bounds.
    
    Args:
        lat: Latitude coordinate
        lng: Longitude coordinate
        
    Raises:
        ValueError: If coordinates are outside valid bounds
    """
    if not -90.0 <= lat <= 90.0:
        raise ValueError(f"Invalid latitude: {lat}. Must be between -90 and 90.")
        
    if not -180.0 <= lng <= 180.0:
        raise ValueError(f"Invalid longitude: {lng}. Must be between -180 and 180.")


def _process_arcgis_response(
    response: Dict[str, Any], 
    resolver: Dict[str, Any], 
    parcel_info: ParcelInfo
) -> ParcelInfo:
    """
    Process ArcGIS response and extract parcel information.
    
    Args:
        response: Raw ArcGIS response data
        resolver: County resolver configuration
        parcel_info: ParcelInfo dict to populate
        
    Returns:
        Updated ParcelInfo dict with extracted data
    """
    # Check for valid response format
    if 'features' not in response:
        logger.warning("Invalid ArcGIS response format - missing 'features' key")
        return parcel_info
        
    features = response['features']
    matched_count = len(features)
    parcel_info['matched_count'] = matched_count
    
    if matched_count == 0:
        logger.info("No parcel features found for coordinates")
        return parcel_info
        
    if matched_count > 1:
        logger.info(f"Multiple parcel features found ({matched_count}), using first result")
        
    # Use first feature for parcel data
    first_feature = features[0]
    parcel_info['raw_feature'] = first_feature  # Include for debugging
    parcel_info['feature_found'] = True
    
    # Extract attributes using field mapping
    attributes = first_feature.get('attributes', {})
    field_mapping = resolver['out_fields']
    
    # Map county-specific field names to normalized values
    parcel_info['subdivision'] = _safe_extract_field(attributes, field_mapping['subdivision'])
    parcel_info['lot'] = _safe_extract_field(attributes, field_mapping['lot'])  
    parcel_info['block'] = _safe_extract_field(attributes, field_mapping['block'])
    parcel_info['parcel_id'] = _safe_extract_field(attributes, field_mapping['parcel_id'])
    
    logger.info(f"Successfully enriched parcel data: parcel_id={parcel_info['parcel_id']}")
    return parcel_info


def _safe_extract_field(attributes: Dict[str, Any], field_name: str) -> Optional[str]:
    """
    Safely extract and convert field value to string or None.
    
    Args:
        attributes: ArcGIS feature attributes
        field_name: Field name to extract
        
    Returns:
        String value or None if field is missing/null/empty
    """
    value = attributes.get(field_name)
    
    # Handle None, empty string, or whitespace-only values
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
        
    # Convert to string and strip whitespace
    return str(value).strip()


async def fetchParcelFeature(lat: float, lng: float, resolver: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fetch parcel feature data from ArcGIS endpoint.
    
    This is a placeholder function for Task 2. The actual ArcGIS HTTP client
    implementation will be added in Task 3. For now, this returns mock data
    to support the enrichParcelFromGIS function testing.
    
    Args:
        lat: Latitude coordinate
        lng: Longitude coordinate  
        resolver: County resolver configuration
        
    Returns:
        Mock ArcGIS response data for testing
        
    Note:
        This function will be replaced with actual HTTP client logic in Task 3.
    """
    logger.debug(f"[MOCK] Fetching parcel data from {resolver['arcgis_url']}")
    
    # Return mock data structure for testing
    # This will be replaced with actual HTTP request in Task 3
    mock_response = {
        'features': [{
            'attributes': {
                resolver['out_fields']['subdivision']: 'Mock Subdivision',
                resolver['out_fields']['lot']: '123',
                resolver['out_fields']['block']: '4', 
                resolver['out_fields']['parcel_id']: 'MOCK123456'
            }
        }]
    }
    
    return mock_response