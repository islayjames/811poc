#!/usr/bin/env python3
"""
Load consolidated dataset from scraper into Texas811 POC backend.

This script loads tickets from the consolidated JSON file and converts them
to the backend's ticket format, storing them in the database.
"""

import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

# Add src to path for imports
import sys
sys.path.insert(0, '/home/james/dev/811poc-revert/src')

from texas811_poc.config import settings
from texas811_poc.models import (
    AuditAction,
    AuditEventModel,
    TicketModel,
    TicketStatus,
)
from texas811_poc.storage import create_storage_instances

logger = logging.getLogger(__name__)

# Mapping from scraped statuses to internal statuses
STATUS_MAPPING = {
    "Update": TicketStatus.SUBMITTED,
    "Normal": TicketStatus.SUBMITTED,
    "Emergency": TicketStatus.SUBMITTED,
    "No Response": TicketStatus.EXPIRED,
    "Cancelled": TicketStatus.CANCELLED,
    "Draft": TicketStatus.DRAFT,
    "Validated": TicketStatus.VALIDATED,
    "Ready": TicketStatus.READY,
    "Submitted": TicketStatus.SUBMITTED,
    "Responses In": TicketStatus.RESPONSES_IN,
}


def parse_scraped_date(date_str: str) -> datetime:
    """Parse date string from scraped data."""
    try:
        # Handle format like "September 26, 2025, 4:25 PM"
        if "," in date_str:
            # Remove the time part if present
            date_part = date_str.split(",")[0] + ", " + date_str.split(",")[1]
            if "AM" in date_str or "PM" in date_str:
                # Full datetime
                return datetime.strptime(date_str, "%B %d, %Y, %I:%M %p").replace(tzinfo=UTC)
            else:
                # Date only
                return datetime.strptime(date_part, "%B %d, %Y").replace(tzinfo=UTC)
        else:
            # Try ISO format
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except ValueError:
        # Fallback to current time
        logger.warning(f"Could not parse date: {date_str}, using current time")
        return datetime.now(UTC)


def convert_scraped_ticket(scraped_ticket: dict) -> dict:
    """Convert scraped ticket to internal ticket format."""

    # Parse the created_at date
    created_at = parse_scraped_date(scraped_ticket["created_at"])

    # Map status
    scraped_status = scraped_ticket.get("status", "Normal")
    internal_status = STATUS_MAPPING.get(scraped_status, TicketStatus.SUBMITTED)

    # Generate IDs
    ticket_id = scraped_ticket.get("ticket_id", str(uuid.uuid4()))
    session_id = f"scraped-data-{ticket_id}"

    # Extract location info
    county = scraped_ticket.get("county", "").upper()
    city = scraped_ticket.get("city", "").title()
    address = scraped_ticket.get("address", "")

    # Extract company and caller info
    excavator_company = scraped_ticket.get("excavator_company", "")
    caller_name = scraped_ticket.get("caller_name", "")
    caller_phone = scraped_ticket.get("caller_phone", "") or scraped_ticket.get("excavator_phone", "")
    caller_email = scraped_ticket.get("caller_email", "")

    # Work description
    work_description = scraped_ticket.get("work_description", "")
    if not work_description:
        work_description = f"Work by {excavator_company}" if excavator_company else "Utility work"

    # GPS coordinates
    gps_lat = None
    gps_lng = None
    if "gps_coordinates" in scraped_ticket:
        coords = scraped_ticket["gps_coordinates"]
        if isinstance(coords, dict):
            gps_lat = coords.get("latitude")
            gps_lng = coords.get("longitude")

    # Calculate compliance dates
    lawful_start_date = (created_at + timedelta(days=2)).date()
    ticket_expires_date = (created_at + timedelta(days=14)).date()

    # Determine submitted_at based on status
    submitted_at = None
    marking_valid_until = None
    if internal_status in [TicketStatus.SUBMITTED, TicketStatus.RESPONSES_IN]:
        submitted_at = created_at + timedelta(hours=2)  # Assume submitted 2 hours after creation
        marking_valid_until = (submitted_at + timedelta(days=14)).date()

    # Create geometry if we have coordinates
    geometry = None
    if gps_lat and gps_lng:
        geometry = {
            "type": "Point",
            "coordinates": [gps_lng, gps_lat],
            "confidence_score": 0.9,
            "source": "scraped_data",
            "created_at": created_at.isoformat(),
        }

    # Build the ticket data
    ticket_data = {
        "ticket_id": ticket_id,
        "session_id": session_id,
        "status": internal_status,
        "created_at": created_at,
        "updated_at": created_at + timedelta(minutes=30),
        "county": county,
        "city": city,
        "address": address,
        "cross_street": scraped_ticket.get("cross_street"),
        "gps_lat": gps_lat,
        "gps_lng": gps_lng,
        "work_description": work_description,
        "caller_name": caller_name,
        "caller_company": excavator_company,
        "caller_phone": caller_phone,
        "caller_email": caller_email,
        "excavator_company": excavator_company,
        "excavator_address": scraped_ticket.get("excavator_address"),
        "excavator_phone": scraped_ticket.get("excavator_phone"),
        "work_start_date": None,  # Not available in scraped data
        "work_duration_days": None,  # Not available in scraped data
        "work_type": "normal" if scraped_status != "Emergency" else "emergency",
        "driving_directions": scraped_ticket.get("directions"),
        "marking_instructions": scraped_ticket.get("marking_instructions"),
        "remarks": scraped_ticket.get("remarks"),
        "geometry": geometry,
        "lawful_start_date": lawful_start_date,
        "ticket_expires_date": ticket_expires_date,
        "marking_valid_until": marking_valid_until,
        "submitted_at": submitted_at,
        "validation_gaps": [],  # Assume scraped data is complete
    }

    return ticket_data


def load_consolidated_data():
    """Load the consolidated dataset into the backend."""
    print("🔄 Loading consolidated dataset into Texas811 POC backend...")

    # Load the consolidated data file
    data_file = Path("/home/james/dev/811poc-revert/scrape/texas811-consolidated-full-dataset-2025-09-28.json")

    if not data_file.exists():
        print(f"❌ Consolidated data file not found: {data_file}")
        return

    print(f"📂 Loading data from: {data_file}")

    with open(data_file, 'r') as f:
        data = json.load(f)

    # Extract tickets
    tickets_data = data.get("tickets", [])
    metadata = data.get("metadata", {})

    print(f"📊 Found {len(tickets_data)} tickets in consolidated dataset")
    print(f"📅 Data from: {metadata.get('consolidation_date', 'unknown')}")
    print(f"🏢 Companies: {', '.join(metadata.get('company_filters', []))}")

    # Initialize storage
    ticket_storage, audit_storage, response_storage, backup_manager = create_storage_instances(
        settings.data_root
    )

    # Clear existing tickets (optional)
    existing_tickets = ticket_storage.list_tickets()
    if existing_tickets:
        print(f"⚠️  Found {len(existing_tickets)} existing tickets. Keeping them.")

    # Convert and store tickets
    stored_count = 0
    error_count = 0

    for scraped_ticket in tickets_data:
        try:
            # Convert to internal format
            ticket_data = convert_scraped_ticket(scraped_ticket)

            # Create TicketModel
            ticket_model = TicketModel(**ticket_data)

            # Store ticket
            ticket_storage.save_ticket(ticket_model)

            # Create audit event
            try:
                audit_event = AuditEventModel(
                    ticket_id=ticket_model.ticket_id,
                    session_id=ticket_model.session_id,
                    action=AuditAction.TICKET_CREATED,
                    details={
                        "status": ticket_model.status.value,
                        "city": ticket_model.city,
                        "county": ticket_model.county,
                        "source": "consolidated_scraper_data",
                        "original_ticket_id": scraped_ticket.get("ticket_id"),
                        "excavator_company": ticket_model.excavator_company,
                    },
                    timestamp=ticket_model.created_at,
                )
                audit_storage.save_audit_event(audit_event)
            except Exception as audit_error:
                print(f"⚠️  Warning: Could not create audit event for {ticket_model.ticket_id}: {audit_error}")

            stored_count += 1

            if stored_count % 10 == 0:
                print(f"📈 Processed {stored_count}/{len(tickets_data)} tickets...")

        except Exception as e:
            error_count += 1
            print(f"❌ Error storing ticket {scraped_ticket.get('ticket_id', 'unknown')}: {e}")
            continue

    print(f"\n✅ Successfully loaded {stored_count}/{len(tickets_data)} tickets")
    if error_count > 0:
        print(f"⚠️  {error_count} tickets failed to load")

    # Print summary by status and city
    print("\n📊 Summary by Status:")
    status_counts = {}
    city_counts = {}

    all_tickets = ticket_storage.list_tickets()
    for ticket in all_tickets:
        status = ticket.status.value
        city = ticket.city

        status_counts[status] = status_counts.get(status, 0) + 1
        city_counts[city] = city_counts.get(city, 0) + 1

    for status, count in sorted(status_counts.items()):
        print(f"  {status}: {count}")

    print("\n📊 Summary by City:")
    for city, count in sorted(city_counts.items()):
        print(f"  {city}: {count}")

    print(f"\n🎯 Total tickets in database: {len(all_tickets)}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    load_consolidated_data()