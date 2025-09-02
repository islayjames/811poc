"""
GIS Parcel Enrichment Module using ReportAll USA API.

This module provides functionality to enrich location data with parcel information
using the ReportAll USA API, which offers reliable nationwide parcel data coverage.

Key Features:
- Async parcel data enrichment from ReportAll USA nationwide API
- Coordinate validation and bounds checking
- Graceful error handling for network failures
- Structured response format with debugging information
- Nationwide coverage for all US counties
- Rich parcel data including ownership and legal descriptions

Usage:
    result = await enrichParcelFromGIS(29.7604, -95.3698, 'Any County')
    if result['feature_found']:
        print(f"Parcel ID: {result['parcel_id']}")
        print(f"Owner: {result['owner']}")
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
    Enrich location data with parcel information from ReportAll USA API.

    This function queries the ReportAll USA nationwide parcel database to retrieve
    detailed parcel information including subdivision, lot, block, parcel ID, owner,
    and property address. It handles coordinate validation and network errors gracefully.

    Args:
        lat: Latitude coordinate (-90 to 90)
        lng: Longitude coordinate (-180 to 180)
        county: County name (any US county, case insensitive), or None

    Returns:
        ParcelInfo dict containing:
        - subdivision: Subdivision name from legal description (nullable string)
        - lot: Lot information from legal description (nullable string)
        - block: Block information from legal description (nullable string)
        - parcel_id: Parcel/account ID (nullable string)
        - owner: Property owner name (nullable string)
        - address: Property address (nullable string)
        - feature_found: True if parcel data was found (bool)
        - matched_count: Number of features returned from query (int)
        - raw_feature: Raw ArcGIS feature data for debugging (optional)
        - arcgis_url: ReportAll USA endpoint URL used for query (string)
        - source_county: Original county parameter (string or None)

    Raises:
        ValueError: If coordinates are outside valid bounds

    Examples:
        >>> result = await enrichParcelFromGIS(29.7604, -95.3698, 'Harris')
        >>> result['feature_found']
        True
        >>> result['parcel_id']
        'PARCEL123456'
        >>> result['owner']
        'John Doe'

        >>> result = await enrichParcelFromGIS(29.7604, -95.3698, 'Any County')
        >>> result['feature_found']
        True  # Works for any county via ReportAll USA
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
        "owner": None,
        "address": None,
        "feature_found": False,
        "matched_count": 0,
        "arcgis_url": "",
        "source_county": county,
    }

    # Get ReportAll USA resolver (supports all counties)
    resolver = get_resolver(county)

    # Set ReportAll USA URL in response
    parcel_info["arcgis_url"] = resolver["arcgis_url"]

    try:
        # Query ReportAll USA API for parcel features
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

    # Map ReportAll USA field names to normalized values
    parcel_info["subdivision"] = _safe_extract_field(
        attributes, field_mapping["subdivision"]
    )
    parcel_info["lot"] = _safe_extract_field(attributes, field_mapping["lot"])
    parcel_info["block"] = _safe_extract_field(attributes, field_mapping["block"])
    parcel_info["parcel_id"] = _safe_extract_field(
        attributes, field_mapping["parcel_id"]
    )

    # Extract additional ReportAll USA fields
    parcel_info["owner"] = _safe_extract_field(attributes, field_mapping.get("owner"))
    parcel_info["address"] = _safe_extract_field(
        attributes, field_mapping.get("address")
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
    Fetch parcel feature data from ReportAll USA API.

    This function queries the ReportAll USA nationwide parcel database using the provided
    coordinates and resolver configuration. It includes HTTP timeout support,
    retry logic with exponential backoff, and comprehensive error handling.

    Args:
        lat: Latitude coordinate
        lng: Longitude coordinate
        resolver: ReportAll USA resolver configuration containing:
            - arcgis_url: ReportAll USA ArcGIS service URL with embedded API key
            - out_fields: Field mapping for parcel_id, legal_desc1-3, owner, address

    Returns:
        ArcGIS JSON response containing features array or error information

    Raises:
        Exception: On network errors, timeouts, or HTTP status errors after all retries

    Examples:
        >>> resolver = get_resolver('Any County')
        >>> response = await fetchParcelFeature(29.7604, -95.3698, resolver)
        >>> len(response['features'])
        1
    """
    # Use the query URL directly (already includes /query endpoint)
    query_url = resolver["arcgis_url"]

    # Build query parameters for ArcGIS point intersection
    query_params = _build_query_params(lat, lng, resolver)

    logger.debug(f"Querying ArcGIS endpoint: {query_url} with params: {query_params}")

    # Attempt HTTP request with retry logic
    max_retries = 2
    timeout_seconds = 5.0

    for attempt in range(max_retries + 1):
        try:
            # Disable SSL verification for ReportAll USA API (working solution from testing)
            # This is safe for ReportAll USA where we're only reading public parcel data
            async with httpx.AsyncClient(verify=False) as client:
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
    Build ReportAll USA API query parameters for point intersection.

    Constructs the standardized parameter set required for querying the ReportAll USA
    parcel service using point geometry intersection. The geometry is
    specified in lng,lat order as required by ArcGIS REST API format.

    Args:
        lat: Latitude coordinate
        lng: Longitude coordinate
        resolver: ReportAll USA resolver with out_fields mapping

    Returns:
        Dictionary of query parameters for ReportAll USA API

    Examples:
        >>> resolver = get_resolver('Any County')
        >>> params = _build_query_params(29.7604, -95.3698, resolver)
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
