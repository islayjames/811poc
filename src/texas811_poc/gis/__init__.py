"""
GIS module for Texas 811 POC.

This module provides GIS functionality including:
- County-specific CAD resolver configurations
- Parcel data enrichment from ArcGIS endpoints
- Address geocoding and coordinate validation
"""

from .cad_resolvers import (
    CAD_RESOLVERS,
    get_all_supported_counties,
    get_out_fields_string,
    get_resolver,
    normalize_county_name,
)

__all__ = [
    "CAD_RESOLVERS",
    "normalize_county_name",
    "get_resolver",
    "get_all_supported_counties",
    "get_out_fields_string",
]
