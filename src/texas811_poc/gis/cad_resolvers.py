"""
Parcel Data Resolver Configuration using ReportAll USA API.

This module provides configuration for the ReportAll USA API, which offers
nationwide parcel data coverage through a single, reliable endpoint.

ReportAll USA API Features:
- Nationwide coverage (all US counties)
- Reliable SSL certificates and uptime
- Standardized field schema across all counties
- Rich parcel data including ownership and legal descriptions

The resolver contains:
- name: System name (ReportAll USA)
- arcgis_url: ReportAll USA ArcGIS REST endpoint
- out_fields: Mapping of normalized field names to ReportAll USA field names
- client_key: Embedded API key for authentication
"""

from typing import Any

# ReportAll USA API configuration for nationwide parcel data
# This single resolver works for all counties in the United States
REPORTALL_USA_RESOLVER: dict[str, Any] = {
    "name": "ReportAll USA",
    "arcgis_url": "https://reportallusa.com/api/rest_services/client=C5fcN8oa9c/Parcels/MapServer/0/query",
    "client_key": "C5fcN8oa9c",  # Embedded in URL for authentication
    "out_fields": {
        "subdivision": "legal_desc1",  # ReportAll uses legal_desc1 for subdivision info
        "lot": "legal_desc2",  # Use legal_desc2 for lot information
        "block": "legal_desc3",  # Use legal_desc3 for block information
        "parcel_id": "parcel_id",  # Direct mapping for parcel_id
        "owner": "owner",  # Additional field: property owner
        "address": "address",  # Additional field: property address
    },
}

# For backward compatibility, maintain the CAD_RESOLVERS structure
# All counties now use the same ReportAll USA resolver
CAD_RESOLVERS: dict[str, dict[str, Any]] = {
    # All counties use ReportAll USA - no county-specific endpoints needed
    "default": REPORTALL_USA_RESOLVER.copy(),
}


def normalize_county_name(county: str | None) -> str:
    """
    Normalize county name - ReportAll USA supports all counties.

    Since ReportAll USA provides nationwide coverage, any valid county name
    is supported. We return 'default' to use the universal resolver.

    Args:
        county: Raw county name string (any US county)

    Returns:
        Always returns 'default' since ReportAll USA supports all counties

    Examples:
        >>> normalize_county_name('harris')
        'default'
        >>> normalize_county_name('FORT BEND')
        'default'
        >>> normalize_county_name('Any County')
        'default'
    """
    # ReportAll USA supports all counties, so we always return 'default'
    # The county information is preserved in the API response for reference
    return "default"


def get_resolver(county: str | None) -> dict[str, Any]:
    """
    Get resolver configuration - ReportAll USA supports all counties.

    Args:
        county: County name (any US county, case insensitive)

    Returns:
        ReportAll USA resolver configuration dict

    Examples:
        >>> resolver = get_resolver('Harris')
        >>> resolver['name']
        'ReportAll USA'
        >>> resolver = get_resolver('Any County')
        >>> resolver['name']
        'ReportAll USA'
    """
    # ReportAll USA supports all counties, so always return the default resolver
    resolver = CAD_RESOLVERS["default"].copy()  # Return copy to prevent modification

    # Add the original county name to the resolver for reference
    resolver["original_county"] = county

    return resolver


def get_all_supported_counties() -> str:
    """
    Get information about supported counties.

    Returns:
        Information string indicating nationwide support

    Examples:
        >>> counties = get_all_supported_counties()
        >>> print(counties)
        'All US counties supported via ReportAll USA API'
    """
    return "All US counties supported via ReportAll USA API"


def get_out_fields_string(county: str | None) -> str:
    """
    Get comma-separated out_fields string for ReportAll USA API query.

    Args:
        county: County name (any US county, case insensitive)

    Returns:
        Comma-separated field names for ArcGIS outFields parameter

    Examples:
        >>> get_out_fields_string('Harris')
        'legal_desc1,legal_desc2,legal_desc3,parcel_id,owner,address'
        >>> get_out_fields_string('Any County')
        'legal_desc1,legal_desc2,legal_desc3,parcel_id,owner,address'
    """
    resolver = get_resolver(county)
    fields = resolver["out_fields"].values()
    return ",".join(fields)


# Type definitions for external use
ResolverType = dict[str, Any]
OutFieldsMapping = dict[str, str]

# Legacy type alias for backward compatibility
CADResolverType = ResolverType
