#!/usr/bin/env python3
"""
Test script to create a ticket with the California address and see what happens.
"""

import json

import httpx


def test_ticket_creation():
    """Test creating a ticket with the California address."""

    base_url = "http://localhost:8000"

    # Test data with the problematic California address
    test_ticket = {
        "primary_contact": {
            "name": "John Doe",
            "phone": "555-123-4567",
            "email": "john@example.com",
            "company": "Test Company",
        },
        "work_details": {
            "type": "Normal",
            "description": "Install fiber optic cable",
            "start_date": "2025-09-05",
            "expected_duration_days": 3,
        },
        "location": {
            "address": "17181 Marina View Pl, Huntington Beach, CA 92649",
            "city": "Huntington Beach",
            "county": "Orange",
            "state": "CA",
            "zip_code": "92649",
            "cross_street": "Main Street",
        },
        "excavation_details": {
            "depth_feet": 4.0,
            "width_feet": 2.0,
            "length_feet": 100.0,
            "equipment": ["Trencher", "Excavator"],
        },
    }

    print("Creating test ticket with California address...")
    print(f"Address: {test_ticket['location']['address']}")
    print()

    try:
        # Create the ticket
        headers = {"Authorization": "Bearer test-api-key-12345"}
        with httpx.Client() as client:
            response = client.post(
                f"{base_url}/tickets/create",
                json=test_ticket,
                headers=headers,
                timeout=30,
            )

        print(f"Response status: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print("✅ Ticket created successfully!")
            print()

            # Extract relevant geocoding information
            if "enrichment" in result and "gis_data" in result["enrichment"]:
                gis_data = result["enrichment"]["gis_data"]

                print("=== Geocoding Results ===")
                print(f"Formatted Address: {gis_data.get('formatted_address', 'N/A')}")

                if "geometry" in gis_data and gis_data["geometry"]:
                    geometry = gis_data["geometry"]
                    coords = geometry.get("coordinates", [])
                    if len(coords) >= 2:
                        lng, lat = coords[0], coords[1]
                        print(f"Coordinates: ({lat:.6f}, {lng:.6f})")

                        # Check if in California
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

                        print(f"In California: {in_california}")

                        if not in_california:
                            print("❌ ERROR: Address geocoded outside California!")
                        else:
                            print("✅ Address correctly geocoded to California")

                print(f"Confidence: {gis_data.get('confidence_score', 'N/A')}")
                print(f"Source: {gis_data.get('source', 'N/A')}")

            else:
                print("No geocoding data found in response")

            print()
            print("=== Full Response ===")
            print(json.dumps(result, indent=2, default=str))

        else:
            print(f"❌ Failed to create ticket: {response.status_code}")
            print(response.text)

    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    test_ticket_creation()
