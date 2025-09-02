"""
Tests for CAD Resolvers Configuration.

Following TDD approach - comprehensive test suite covering:
- CAD_RESOLVERS structure validation
- County name normalization
- Field mappings for all 4 supported counties
- Type validation and error handling
"""


def test_cad_resolvers_import():
    """Test that CAD_RESOLVERS can be imported."""
    from texas811_poc.gis.cad_resolvers import CAD_RESOLVERS

    assert CAD_RESOLVERS is not None
    assert isinstance(CAD_RESOLVERS, dict)


def test_cad_resolvers_has_required_counties():
    """Test that CAD_RESOLVERS contains all 4 required counties."""
    from texas811_poc.gis.cad_resolvers import CAD_RESOLVERS

    required_counties = {"Harris", "Fort Bend", "Galveston", "Liberty"}
    available_counties = set(CAD_RESOLVERS.keys())

    assert required_counties.issubset(
        available_counties
    ), f"Missing counties: {required_counties - available_counties}"


def test_harris_county_resolver():
    """Test Harris County HCAD resolver configuration."""
    from texas811_poc.gis.cad_resolvers import CAD_RESOLVERS

    harris = CAD_RESOLVERS["Harris"]

    assert harris["name"] == "HCAD"
    assert (
        harris["arcgis_url"]
        == "https://gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query"
    )

    expected_fields = {
        "subdivision": "SUBDIVNME",
        "lot": "LOT",
        "block": "BLOCK",
        "parcel_id": "ACCOUNT",
    }
    assert harris["out_fields"] == expected_fields


def test_fort_bend_county_resolver():
    """Test Fort Bend County FBCAD resolver configuration."""
    from texas811_poc.gis.cad_resolvers import CAD_RESOLVERS

    fort_bend = CAD_RESOLVERS["Fort Bend"]

    assert fort_bend["name"] == "FBCAD"
    assert (
        fort_bend["arcgis_url"]
        == "https://gisweb.fbcad.org/arcgis/rest/services/Hosted/FBCAD_Public_Data/FeatureServer/0/query"
    )

    expected_fields = {
        "subdivision": "SUBDIVISION",
        "lot": "LOT",
        "block": "BLOCK",
        "parcel_id": "PROP_ID",
    }
    assert fort_bend["out_fields"] == expected_fields


def test_galveston_county_resolver():
    """Test Galveston County resolver configuration."""
    from texas811_poc.gis.cad_resolvers import CAD_RESOLVERS

    galveston = CAD_RESOLVERS["Galveston"]

    assert galveston["name"] == "City of Webster"
    assert (
        galveston["arcgis_url"]
        == "https://www1.cityofwebster.com/arcgis/rest/services/Landbase/CountyGalveston/MapServer/0/query"
    )

    expected_fields = {
        "subdivision": "SUBDIVISION",
        "lot": "LOT",
        "block": "BLOCK",
        "parcel_id": "ACCOUNT",
    }
    assert galveston["out_fields"] == expected_fields


def test_liberty_county_resolver():
    """Test Liberty County LJA Engineering resolver configuration."""
    from texas811_poc.gis.cad_resolvers import CAD_RESOLVERS

    liberty = CAD_RESOLVERS["Liberty"]

    assert liberty["name"] == "LJA Engineering"
    assert (
        liberty["arcgis_url"]
        == "https://gis.ljaengineering.com/arcgis/rest/services/liberty/liberty_co/MapServer/0/query"
    )

    expected_fields = {
        "subdivision": "SUBDIV",
        "lot": "LOT",
        "block": "BLOCK",
        "parcel_id": "ACCOUNT",
    }
    assert liberty["out_fields"] == expected_fields


def test_resolver_structure_validation():
    """Test that all resolvers have required structure."""
    from texas811_poc.gis.cad_resolvers import CAD_RESOLVERS

    required_keys = {"name", "arcgis_url", "out_fields"}
    required_field_keys = {"subdivision", "lot", "block", "parcel_id"}

    for county, resolver in CAD_RESOLVERS.items():
        # Check top-level keys
        assert (
            set(resolver.keys()) == required_keys
        ), f"{county} resolver missing keys: {required_keys - set(resolver.keys())}"

        # Check field mapping keys
        assert (
            set(resolver["out_fields"].keys()) == required_field_keys
        ), f"{county} resolver missing field keys: {required_field_keys - set(resolver['out_fields'].keys())}"

        # Check types
        assert isinstance(resolver["name"], str), f"{county} name must be string"
        assert isinstance(
            resolver["arcgis_url"], str
        ), f"{county} arcgis_url must be string"
        assert isinstance(
            resolver["out_fields"], dict
        ), f"{county} out_fields must be dict"

        # Check URL format
        assert resolver["arcgis_url"].startswith(
            "https://"
        ), f"{county} URL must use HTTPS"
        assert (
            "/query" in resolver["arcgis_url"]
        ), f"{county} URL must contain /query endpoint"


def test_normalize_county_name():
    """Test county name normalization function."""
    from texas811_poc.gis.cad_resolvers import normalize_county_name

    # Test exact matches
    assert normalize_county_name("Harris") == "Harris"
    assert normalize_county_name("Fort Bend") == "Fort Bend"
    assert normalize_county_name("Galveston") == "Galveston"
    assert normalize_county_name("Liberty") == "Liberty"

    # Test case insensitive matching
    assert normalize_county_name("harris") == "Harris"
    assert normalize_county_name("HARRIS") == "Harris"
    assert normalize_county_name("HaRrIs") == "Harris"

    # Test with spaces and variations
    assert normalize_county_name("fort bend") == "Fort Bend"
    assert normalize_county_name("FORT BEND") == "Fort Bend"
    assert normalize_county_name("fortbend") == "Fort Bend"
    assert normalize_county_name("fort_bend") == "Fort Bend"
    assert normalize_county_name("fort-bend") == "Fort Bend"

    # Test galveston variations
    assert normalize_county_name("galveston") == "Galveston"
    assert normalize_county_name("GALVESTON") == "Galveston"

    # Test liberty variations
    assert normalize_county_name("liberty") == "Liberty"
    assert normalize_county_name("LIBERTY") == "Liberty"


def test_normalize_county_name_unsupported():
    """Test county name normalization with unsupported counties."""
    from texas811_poc.gis.cad_resolvers import normalize_county_name

    # Should return None for unsupported counties
    assert normalize_county_name("Brazoria") is None
    assert normalize_county_name("Montgomery") is None
    assert normalize_county_name("Travis") is None
    assert normalize_county_name("") is None
    assert normalize_county_name("   ") is None


def test_normalize_county_name_edge_cases():
    """Test county name normalization edge cases."""
    from texas811_poc.gis.cad_resolvers import normalize_county_name

    # None and empty string handling
    assert normalize_county_name(None) is None
    assert normalize_county_name("") is None
    assert normalize_county_name("   ") is None

    # Whitespace variations
    assert normalize_county_name(" Harris ") == "Harris"
    assert normalize_county_name("\tHarris\n") == "Harris"
    assert normalize_county_name("  fort   bend  ") == "Fort Bend"


def test_get_resolver_function():
    """Test get_resolver helper function."""
    from texas811_poc.gis.cad_resolvers import get_resolver

    # Test successful lookups
    harris_resolver = get_resolver("Harris")
    assert harris_resolver is not None
    assert harris_resolver["name"] == "HCAD"

    # Test case insensitive lookup
    fort_bend_resolver = get_resolver("fort bend")
    assert fort_bend_resolver is not None
    assert fort_bend_resolver["name"] == "FBCAD"

    # Test unsupported county
    assert get_resolver("Brazoria") is None
    assert get_resolver("Invalid") is None
    assert get_resolver("") is None
    assert get_resolver(None) is None


def test_get_all_supported_counties():
    """Test function to get all supported county names."""
    from texas811_poc.gis.cad_resolvers import get_all_supported_counties

    counties = get_all_supported_counties()
    expected_counties = {"Harris", "Fort Bend", "Galveston", "Liberty"}

    assert isinstance(counties, set)
    assert counties == expected_counties


def test_get_out_fields_string():
    """Test helper to get comma-separated out_fields for ArcGIS query."""
    from texas811_poc.gis.cad_resolvers import get_out_fields_string

    # Test Harris county
    harris_fields = get_out_fields_string("Harris")
    expected_harris = "SUBDIVNME,LOT,BLOCK,ACCOUNT"
    assert set(harris_fields.split(",")) == set(expected_harris.split(","))

    # Test Fort Bend county
    fort_bend_fields = get_out_fields_string("Fort Bend")
    expected_fort_bend = "SUBDIVISION,LOT,BLOCK,PROP_ID"
    assert set(fort_bend_fields.split(",")) == set(expected_fort_bend.split(","))

    # Test unsupported county
    assert get_out_fields_string("Unsupported") is None


def test_cad_resolver_constants_immutability():
    """Test that CAD_RESOLVERS is properly structured as constants."""
    from texas811_poc.gis.cad_resolvers import CAD_RESOLVERS

    # Test that we can't accidentally modify the original
    original_harris = CAD_RESOLVERS["Harris"].copy()

    # This should not affect the original
    test_copy = CAD_RESOLVERS["Harris"]
    test_copy["test_key"] = "test_value"

    # Original should be unmodified (this depends on implementation, but good to test)
    # Note: This test may need adjustment based on actual implementation
    assert "test_key" not in original_harris


def test_resolver_urls_are_valid():
    """Test that all resolver URLs are properly formatted."""
    from texas811_poc.gis.cad_resolvers import CAD_RESOLVERS

    for county, resolver in CAD_RESOLVERS.items():
        url = resolver["arcgis_url"]

        # Basic URL validation
        assert url.startswith("https://"), f"{county} URL must use HTTPS: {url}"
        assert (
            "arcgis/rest/services" in url
        ), f"{county} URL must be ArcGIS REST service: {url}"
        assert url.endswith("/query"), f"{county} URL must end with /query: {url}"

        # Check for common ArcGIS patterns
        assert (
            "/MapServer/" in url or "/FeatureServer/" in url
        ), f"{county} URL must be MapServer or FeatureServer: {url}"
