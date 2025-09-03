#!/usr/bin/env python3
"""
Simple test script for sync_tickets.py data transformation.
"""

import json

from sync_tickets import TicketSyncer


def test_data_transformation():
    """Test the ticket data transformation with sample data."""

    # Sample scraped ticket data
    sample_scraped = {
        "ticket_id": "2574581677",
        "created_at": "September 02, 2025, 4:20 PM",
        "status": "Update",
        "excavator_company": "BRIGHT STAR SOLUTIONS",
        "caller_name": "TRAVIS PARTEN",
        "caller_phone": "(979) 997-2171",
        "caller_email": "cplocates@bright-star.us",
        "county": "HARRIS",
        "city": "HOUSTON",
        "address": "12502 New Rochelle Ct",
        "cross_street": "New Rochelle Dr",
        "work_description": "Setting-Poles",
        "work_type": "Digger Derrick/Truck",
        "work_start_date": "September 04, 2025 4:30 PM",
        "work_duration_days": "1 Day",
        "gps_lat": 29.75,
        "gps_lng": -95.37,
    }

    syncer = TicketSyncer()

    # Transform data
    api_data = syncer.transform_ticket_data(sample_scraped)

    print("Data Transformation Test")
    print("=" * 40)
    print("Original scraped data:")
    print(json.dumps(sample_scraped, indent=2))
    print("\nTransformed API data:")
    print(json.dumps(api_data, indent=2, default=str))

    # Check required fields
    required_fields = ["session_id", "county", "city", "address", "work_description"]
    missing_fields = [field for field in required_fields if not api_data.get(field)]

    if missing_fields:
        print(f"\n❌ Missing required fields: {missing_fields}")
    else:
        print("\n✅ All required fields present")

    # Test date parsing
    print("\nDate parsing test:")
    print(f"Original: '{sample_scraped['created_at']}'")
    parsed_date = syncer.parse_date(sample_scraped["created_at"])
    print(f"Parsed: {parsed_date}")

    # Test duration parsing
    print("\nDuration parsing test:")
    duration_tests = ["1 Day", "3 MONTHS", "2 WEEKS", "5 days", "invalid"]
    for duration in duration_tests:
        days = syncer.parse_duration(duration)
        print(f"'{duration}' -> {days} days")


if __name__ == "__main__":
    test_data_transformation()
