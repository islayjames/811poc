#!/usr/bin/env python3
"""
Debug script to investigate geocoding issues.

This script tests the specific California address that's being geocoded incorrectly
to Arkansas coordinates.
"""

import json

from texas811_poc.config import settings
from texas811_poc.geocoding import GeocodingService


def debug_geocoding():
    """Debug the geocoding service with the problematic address."""

    print("=== Geocoding Debug Session ===")
    print(
        f"Mapbox API Key: {settings.mapbox_token[:20]}..."
        if settings.mapbox_token
        else "No API key found"
    )
    print()

    # Create geocoding service
    service = GeocodingService()
    print(f"Mock mode: {service._mock_mode}")
    print(f"Base URL: {service.base_url}")
    print()

    # Test the problematic address
    test_address = "17181 Marina View Pl, Huntington Beach, CA 92649"
    print(f"Testing address: {test_address}")
    print("Expected: California coordinates ~(33.712, -118.050)")
    print()

    try:
        result = service.geocode_address(test_address)

        print("=== Geocoding Result ===")
        print(json.dumps(result, indent=2))

        # Check if coordinates are in California
        lat, lng = result["latitude"], result["longitude"]

        # California bounds (approximate)
        ca_bounds = {
            "min_lat": 32.5,
            "max_lat": 42.0,
            "min_lng": -124.5,
            "max_lng": -114.0,
        }

        in_california = (
            ca_bounds["min_lat"] <= lat <= ca_bounds["max_lat"]
            and ca_bounds["min_lng"] <= lng <= ca_bounds["max_lng"]
        )

        print()
        print(f"Coordinates: ({lat:.6f}, {lng:.6f})")
        print(f"In California bounds: {in_california}")

        if not in_california:
            print("❌ ERROR: Coordinates are NOT in California!")

            # Try to identify which state these coordinates are actually in
            if 34.0 <= lat <= 37.0 and -95.0 <= lng <= -90.0:
                print("🔍 These coordinates appear to be in Arkansas/Missouri area")
            elif 25.0 <= lat <= 37.0 and -107.0 <= lng <= -93.0:
                print("🔍 These coordinates appear to be in Texas area")
        else:
            print("✅ Coordinates are correctly in California")

    except Exception as e:
        print(f"❌ Geocoding failed: {e}")
        print(f"Error type: {type(e).__name__}")

    print()

    # Test a simple known address for comparison
    print("=== Testing known Texas address for comparison ===")
    texas_address = "123 Main St, Austin, TX 78701"
    print(f"Testing address: {texas_address}")

    try:
        texas_result = service.geocode_address(texas_address)
        print("Texas result:")
        print(json.dumps(texas_result, indent=2))

        # Check if Texas address gets correct coordinates
        lat, lng = texas_result["latitude"], texas_result["longitude"]
        print(f"Coordinates: ({lat:.6f}, {lng:.6f})")

        # Austin should be around (30.267, -97.743)
        if 30.0 <= lat <= 31.0 and -98.0 <= lng <= -97.0:
            print("✅ Texas address geocoded correctly")
        else:
            print("❌ Texas address also geocoded incorrectly!")

    except Exception as e:
        print(f"❌ Texas geocoding failed: {e}")


if __name__ == "__main__":
    debug_geocoding()
