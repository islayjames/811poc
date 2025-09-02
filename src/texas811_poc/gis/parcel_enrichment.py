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

import asyncio
import logging
from typing import Any

import httpx

from .cad_resolvers import get_resolver

# Set up logging
logger = logging.getLogger(__name__)

# Type definition for ParcelInfo return value
ParcelInfo = dict[str, str | bool | int | dict[str, Any] | None]


async def enrichParcelFromGIS(lat: float, lng: float, county: str | None) -> ParcelInfo:
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
        "subdivision": None,
        "lot": None,
        "block": None,
        "parcel_id": None,
        "feature_found": False,
        "matched_count": 0,
        "arcgis_url": "",
        "source_county": county,
    }

    # Handle unsupported or None county
    resolver = get_resolver(county)
    if not resolver:
        logger.warning(f"County '{county}' is not supported for parcel enrichment")
        return parcel_info

    # Set ArcGIS URL in response
    parcel_info["arcgis_url"] = resolver["arcgis_url"]

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
    response: dict[str, Any], resolver: dict[str, Any], parcel_info: ParcelInfo
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
    if "features" not in response:
        logger.warning("Invalid ArcGIS response format - missing 'features' key")
        return parcel_info

    features = response["features"]
    matched_count = len(features)
    parcel_info["matched_count"] = matched_count

    if matched_count == 0:
        logger.info("No parcel features found for coordinates")
        return parcel_info

    if matched_count > 1:
        logger.info(
            f"Multiple parcel features found ({matched_count}), using first result"
        )

    # Use first feature for parcel data
    first_feature = features[0]
    parcel_info["raw_feature"] = first_feature  # Include for debugging
    parcel_info["feature_found"] = True

    # Extract attributes using field mapping
    attributes = first_feature.get("attributes", {})
    field_mapping = resolver["out_fields"]

    # Map county-specific field names to normalized values
    parcel_info["subdivision"] = _safe_extract_field(
        attributes, field_mapping["subdivision"]
    )
    parcel_info["lot"] = _safe_extract_field(attributes, field_mapping["lot"])
    parcel_info["block"] = _safe_extract_field(attributes, field_mapping["block"])
    parcel_info["parcel_id"] = _safe_extract_field(
        attributes, field_mapping["parcel_id"]
    )

    logger.info(
        f"Successfully enriched parcel data: parcel_id={parcel_info['parcel_id']}"
    )
    return parcel_info


def _safe_extract_field(attributes: dict[str, Any], field_name: str) -> str | None:
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


async def fetchParcelFeature(
    lat: float, lng: float, resolver: dict[str, Any]
) -> dict[str, Any]:
    """
    Fetch parcel feature data from ArcGIS endpoint.

    This function queries county-specific ArcGIS REST endpoints using the provided
    coordinates and resolver configuration. It includes HTTP timeout support,
    retry logic with exponential backoff, and comprehensive error handling.

    Args:
        lat: Latitude coordinate
        lng: Longitude coordinate
        resolver: County resolver configuration containing:
            - arcgis_url: Base ArcGIS service URL
            - out_fields: Field mapping for subdivision, lot, block, parcel_id

    Returns:
        ArcGIS JSON response containing features array or error information

    Raises:
        Exception: On network errors, timeouts, or HTTP status errors after all retries

    Examples:
        >>> resolver = get_resolver('Harris')
        >>> response = await fetchParcelFeature(29.7604, -95.3698, resolver)
        >>> len(response['features'])
        1
    """
    # Construct query URL by appending /query to the service endpoint
    query_url = resolver["arcgis_url"] + "/query"

    # Build query parameters for ArcGIS point intersection
    query_params = _build_query_params(lat, lng, resolver)

    logger.debug(f"Querying ArcGIS endpoint: {query_url} with params: {query_params}")

    # Attempt HTTP request with retry logic
    max_retries = 2
    timeout_seconds = 5.0

    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    query_url, params=query_params, timeout=timeout_seconds
                )

                # Raise exception for HTTP error status codes (4xx, 5xx)
                response.raise_for_status()

                # Parse JSON response
                json_response = response.json()

                logger.debug(
                    f"Successful ArcGIS response from {resolver['name']}: "
                    f"{len(json_response.get('features', []))} features found"
                )

                return json_response

        except (httpx.TimeoutException, httpx.RequestError, ValueError) as e:
            logger.warning(
                f"ArcGIS request attempt {attempt + 1}/{max_retries + 1} failed "
                f"for {resolver['name']}: {str(e)}"
            )

            # If this was the last attempt, re-raise the exception
            if attempt == max_retries:
                logger.error(
                    f"All ArcGIS request attempts failed for {resolver['name']}: {str(e)}"
                )
                raise

            # Calculate exponential backoff delay: 1s, 2s, 4s, ...
            delay = 2**attempt
            logger.debug(f"Retrying in {delay} seconds...")
            await asyncio.sleep(delay)

        except Exception as e:
            # For non-retryable errors (HTTP status errors), fail immediately
            logger.error(
                f"Non-retryable error in ArcGIS request for {resolver['name']}: {str(e)}"
            )
            raise

    # This should not be reached due to the re-raise in the loop
    raise Exception("Unexpected error in fetchParcelFeature retry logic")


def _build_query_params(
    lat: float, lng: float, resolver: dict[str, Any]
) -> dict[str, str]:
    """
    Build ArcGIS REST API query parameters for point intersection.

    Constructs the standardized parameter set required for querying ArcGIS
    feature services using point geometry intersection. The geometry is
    specified in lng,lat order as required by ArcGIS.

    Args:
        lat: Latitude coordinate
        lng: Longitude coordinate
        resolver: County resolver with out_fields mapping

    Returns:
        Dictionary of query parameters for ArcGIS REST API

    Examples:
        >>> params = _build_query_params(29.7604, -95.3698, harris_resolver)
        >>> params['geometry']
        '-95.3698,29.7604'
        >>> params['geometryType']
        'esriGeometryPoint'
    """
    # Extract field names for the outFields parameter
    out_fields = list(resolver["out_fields"].values())
    out_fields_param = ",".join(out_fields)

    return {
        "geometry": f"{lng},{lat}",  # ArcGIS expects lng,lat order
        "geometryType": "esriGeometryPoint",
        "inSR": "4326",  # WGS84 spatial reference
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": out_fields_param,
        "returnGeometry": "false",  # We only need attributes
        "f": "json",  # Response format
    }
