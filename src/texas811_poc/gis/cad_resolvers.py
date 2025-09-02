"""
CAD Resolvers Configuration for GIS Parcel Enrichment.

This module provides county-specific ArcGIS endpoint configurations for
retrieving parcel information from County Appraisal District (CAD) systems.

Supported counties:
- Harris County (HCAD)
- Fort Bend County (FBCAD)
- Galveston County (City of Webster)
- Liberty County (LJA Engineering)

Each resolver contains:
- name: Human-readable CAD system name
- arcgis_url: ArcGIS REST endpoint for parcel queries
- out_fields: Mapping of normalized field names to county-specific field names
"""

import re
from typing import Any

# County-specific CAD resolver configurations
CAD_RESOLVERS: dict[str, dict[str, Any]] = {
    "Harris": {
        "name": "HCAD",
        "arcgis_url": "https://gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query",
        "out_fields": {
            "subdivision": "SUBDIVNME",
            "lot": "LOT",
            "block": "BLOCK",
            "parcel_id": "ACCOUNT",
        },
    },
    "Fort Bend": {
        "name": "FBCAD",
        "arcgis_url": "https://gisweb.fbcad.org/arcgis/rest/services/Hosted/FBCAD_Public_Data/FeatureServer/0/query",
        "out_fields": {
            "subdivision": "SUBDIVISION",
            "lot": "LOT",
            "block": "BLOCK",
            "parcel_id": "PROP_ID",
        },
    },
    "Galveston": {
        "name": "City of Webster",
        "arcgis_url": "https://www1.cityofwebster.com/arcgis/rest/services/Landbase/CountyGalveston/MapServer/0/query",
        "out_fields": {
            "subdivision": "SUBDIVISION",
            "lot": "LOT",
            "block": "BLOCK",
            "parcel_id": "ACCOUNT",
        },
    },
    "Liberty": {
        "name": "LJA Engineering",
        "arcgis_url": "https://gis.ljaengineering.com/arcgis/rest/services/liberty/liberty_co/MapServer/0/query",
        "out_fields": {
            "subdivision": "SUBDIV",
            "lot": "LOT",
            "block": "BLOCK",
            "parcel_id": "ACCOUNT",
        },
    },
}


def normalize_county_name(county: str | None) -> str | None:
    """
    Normalize county name to match CAD_RESOLVERS keys.

    Handles case variations, whitespace, and common alternate spellings.

    Args:
        county: Raw county name string

    Returns:
        Normalized county name that matches CAD_RESOLVERS key, or None if unsupported

    Examples:
        >>> normalize_county_name('harris')
        'Harris'
        >>> normalize_county_name('FORT BEND')
        'Fort Bend'
        >>> normalize_county_name('fort_bend')
        'Fort Bend'
        >>> normalize_county_name('Unsupported')
        None
    """
    if not county or not county.strip():
        return None

    # Clean and normalize input
    cleaned = re.sub(r"[_\-\s]+", " ", county.strip().lower())

    # Define normalization mappings
    mappings = {
        "harris": "Harris",
        "fort bend": "Fort Bend",
        "fortbend": "Fort Bend",
        "galveston": "Galveston",
        "liberty": "Liberty",
    }

    # Look for direct match
    if cleaned in mappings:
        return mappings[cleaned]

    # Handle partial matches or variations
    for key, normalized in mappings.items():
        if key.replace(" ", "") == cleaned.replace(" ", ""):
            return normalized

    return None


def get_resolver(county: str | None) -> dict[str, Any] | None:
    """
    Get CAD resolver configuration for a county.

    Args:
        county: County name (case insensitive)

    Returns:
        Resolver configuration dict, or None if county not supported

    Examples:
        >>> resolver = get_resolver('Harris')
        >>> resolver['name']
        'HCAD'
        >>> get_resolver('Unsupported') is None
        True
    """
    normalized = normalize_county_name(county)
    if normalized and normalized in CAD_RESOLVERS:
        return CAD_RESOLVERS[normalized].copy()  # Return copy to prevent modification
    return None


def get_all_supported_counties() -> set[str]:
    """
    Get set of all supported county names.

    Returns:
        Set of normalized county names that have CAD resolvers

    Examples:
        >>> counties = get_all_supported_counties()
        >>> 'Harris' in counties
        True
        >>> len(counties)
        4
    """
    return set(CAD_RESOLVERS.keys())


def get_out_fields_string(county: str | None) -> str | None:
    """
    Get comma-separated out_fields string for ArcGIS query.

    Args:
        county: County name (case insensitive)

    Returns:
        Comma-separated field names for ArcGIS outFields parameter, or None if unsupported

    Examples:
        >>> get_out_fields_string('Harris')
        'SUBDIVNME,LOT,BLOCK,ACCOUNT'
        >>> get_out_fields_string('Unsupported') is None
        True
    """
    resolver = get_resolver(county)
    if resolver:
        fields = resolver["out_fields"].values()
        return ",".join(fields)
    return None


# Type definitions for external use
CADResolverType = dict[str, Any]
OutFieldsMapping = dict[str, str]
