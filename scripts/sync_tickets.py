#!/usr/bin/env python3
"""
Texas811 Ticket Sync Script

Syncs tickets from scraped JSON data to the backend API.
This is a lightweight tool for POC development - not production code.

Usage:
    python scripts/sync_tickets.py

Configuration:
    - Reads from: scrape/texas811-all-tickets-2025-09-03.json
    - Backend API: http://localhost:8000
    - Logs to console with INFO level
"""

import json
import logging
import re
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

import requests
from dateutil import parser as date_parser

# Configuration
API_BASE_URL = "http://localhost:8000"
SCRAPED_DATA_FILE = "scrape/texas811-all-tickets-2025-09-03.json"
API_KEY = "test-api-key-12345"  # Default development API key
TIMEOUT_SECONDS = 30

# Removed GPS bounds and work duration limits to allow historical data import

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


class TicketSyncer:
    """Handles syncing scraped ticket data to the backend API."""

    def __init__(self):
        self.api_base = API_BASE_URL
        self.api_key = API_KEY
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
        )

        # Stats tracking
        self.stats = {
            "processed": 0,
            "created": 0,
            "updated": 0,
            "errors": 0,
            "skipped": 0,
        }

    def load_scraped_data(self, file_path: str) -> dict[str, Any]:
        """Load scraped ticket data from JSON file."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Scraped data file not found: {file_path}")

        with open(path, encoding="utf-8") as f:
            data = json.load(f)

        logger.info(
            f"Loaded {data.get('metadata', {}).get('total_tickets_extracted', 0)} tickets from {file_path}"
        )
        return data

    def parse_date(self, date_str: str) -> datetime | None:
        """Parse date string from scraper format to datetime object."""
        if not date_str or date_str.strip() == "":
            return None

        try:
            # Handle formats like "September 02, 2025, 4:20 PM"
            return date_parser.parse(date_str)
        except (ValueError, TypeError) as e:
            logger.warning(f"Could not parse date '{date_str}': {e}")
            return None

    def parse_duration(self, duration_str: str) -> int:
        """Parse work duration string to days (integer) - no limits for historical data."""
        if not duration_str:
            return 1  # Default to 1 day

        duration_str = duration_str.upper().strip()

        # Extract number from strings like "1 Day", "3 MONTHS", "2 WEEKS"
        match = re.search(r"(\d+)", duration_str)
        if not match:
            return 1

        num = int(match.group(1))

        if "MONTH" in duration_str:
            days = num * 30  # Approximate days
        elif "WEEK" in duration_str:
            days = num * 7
        else:  # Assume days
            days = num

        return days

    def validate_gps_coordinates(self, lat: float, lng: float) -> bool:
        """Accept all GPS coordinates for historical data import."""
        return True  # Accept all coordinates for historical data

    def validate_and_fix_work_start_date(
        self, work_start_date: datetime | None
    ) -> date | None:
        """Allow work start dates in the past for historical data import."""
        if not work_start_date:
            return None

        return work_start_date.date()  # Return actual date without modification

    def transform_ticket_data(self, scraped_ticket: dict[str, Any]) -> dict[str, Any]:
        """Transform scraped ticket format to API request format."""

        # Use ticket_id directly as session_id (remove sync- prefix)
        session_id = scraped_ticket.get("ticket_id", "unknown")

        # Parse dates
        work_start_date = self.parse_date(scraped_ticket.get("work_start_date"))

        # Parse work duration
        work_duration_days = self.parse_duration(
            scraped_ticket.get("work_duration_days", "1 Day")
        )

        # Build API request data
        api_data = {
            "session_id": session_id,
            "county": scraped_ticket.get("county", "").strip(),
            "city": scraped_ticket.get("city", "").strip(),
            "address": scraped_ticket.get("address", "").strip(),
            "work_description": scraped_ticket.get("work_description", "").strip(),
        }

        # Optional fields
        if scraped_ticket.get("cross_street"):
            api_data["cross_street"] = scraped_ticket["cross_street"].strip()

        # GPS coordinates (accept all coordinates for historical data)
        gps_lat = scraped_ticket.get("gps_lat")
        gps_lng = scraped_ticket.get("gps_lng")
        if isinstance(gps_lat, int | float) and isinstance(gps_lng, int | float):
            # Skip placeholder/invalid coordinates
            if not (
                gps_lat == 2 and gps_lng == 2025
            ):  # Common placeholder in scraped data
                api_data["gps_lat"] = float(gps_lat)
                api_data["gps_lng"] = float(gps_lng)

        # Work details
        if scraped_ticket.get("work_type"):
            api_data["work_type"] = scraped_ticket["work_type"].strip()

        # Process work start date (allow historical dates)
        validated_work_date = self.validate_and_fix_work_start_date(work_start_date)
        if validated_work_date:
            api_data["work_start_date"] = validated_work_date.isoformat()

        api_data["work_duration_days"] = work_duration_days

        # Company information
        if scraped_ticket.get("excavator_company"):
            api_data["excavator_company"] = scraped_ticket["excavator_company"].strip()

        if scraped_ticket.get("excavator_phone"):
            api_data["excavator_phone"] = scraped_ticket["excavator_phone"].strip()

        # Caller information
        if scraped_ticket.get("caller_name"):
            api_data["caller_name"] = scraped_ticket["caller_name"].strip()

        if scraped_ticket.get("caller_phone"):
            api_data["caller_phone"] = scraped_ticket["caller_phone"].strip()

        if scraped_ticket.get("caller_email"):
            api_data["caller_email"] = scraped_ticket["caller_email"].strip()

        # Add sync override flag for historical data import
        api_data["skip_validation"] = True

        return api_data

    def sync_responses(self, ticket_id: str, scraped_ticket: dict[str, Any]):
        """Sync member responses if present in scraped data."""
        responses = scraped_ticket.get("responses", [])
        if not responses:
            return

        logger.info(f"Syncing {len(responses)} responses for ticket {ticket_id}")

        for response in responses:
            try:
                member_code = response.get("member_code")
                if not member_code:
                    continue

                # Prepare response data
                response_data = {
                    "member_name": response.get("member_name", member_code),
                    "status": response.get("status", "clear"),
                    "user_name": response.get("user_name", "sync-import"),
                    "facilities": response.get("facilities"),
                    "comment": response.get("comment"),
                }

                # Submit response
                response_url = (
                    f"{self.api_base}/tickets/{ticket_id}/responses/{member_code}"
                )
                api_response = self.session.post(
                    response_url, json=response_data, timeout=TIMEOUT_SECONDS
                )

                if api_response.status_code in [200, 201]:
                    logger.info(
                        f"Synced response from {member_code} for ticket {ticket_id}"
                    )
                else:
                    logger.warning(
                        f"Failed to sync response from {member_code}: {api_response.status_code}"
                    )

            except Exception as e:
                logger.error(
                    f"Error syncing response from {response.get('member_code', 'unknown')}: {e}"
                )

    def create_ticket(self, ticket_data: dict[str, Any]) -> str | None:
        """Create a new ticket via API. Returns ticket_id if successful."""
        try:
            response = self.session.post(
                f"{self.api_base}/tickets/create",
                json=ticket_data,
                timeout=TIMEOUT_SECONDS,
            )

            if response.status_code == 201:
                result = response.json()
                ticket_id = result.get("ticket_id")
                logger.info(
                    f"Created ticket {ticket_id} for session {ticket_data['session_id']}"
                )
                self.stats["created"] += 1
                return ticket_id
            else:
                logger.error(
                    f"Failed to create ticket: {response.status_code} - {response.text}"
                )
                self.stats["errors"] += 1
                return None

        except requests.RequestException as e:
            logger.error(f"Request failed for ticket creation: {e}")
            self.stats["errors"] += 1
            return None

    def sync_tickets(self, file_path: str):
        """Main sync process."""
        logger.info(f"Starting ticket sync from {file_path}")

        # Load scraped data
        try:
            data = self.load_scraped_data(file_path)
        except FileNotFoundError as e:
            logger.error(f"Data file error: {e}")
            return

        # Check API availability
        try:
            health_response = self.session.get(
                f"{self.api_base}/health", timeout=TIMEOUT_SECONDS
            )
            if health_response.status_code != 200:
                logger.error(f"API health check failed: {health_response.status_code}")
                return
        except requests.RequestException as e:
            logger.error(f"Cannot connect to API at {self.api_base}: {e}")
            return

        logger.info("API connection verified")

        # Process tickets
        tickets = data.get("tickets", [])
        logger.info(f"Processing {len(tickets)} tickets...")

        for i, scraped_ticket in enumerate(tickets, 1):
            self.stats["processed"] += 1

            # Skip failed extractions
            if not scraped_ticket.get("extraction_success", True):
                logger.warning(f"Skipping ticket {i}: extraction failed")
                self.stats["skipped"] += 1
                continue

            # Transform data
            try:
                api_data = self.transform_ticket_data(scraped_ticket)
            except Exception as e:
                logger.error(f"Failed to transform ticket {i}: {e}")
                self.stats["errors"] += 1
                continue

            # Validate required fields
            required_fields = [
                "session_id",
                "county",
                "city",
                "address",
                "work_description",
            ]
            missing_fields = [
                field for field in required_fields if not api_data.get(field)
            ]

            if missing_fields:
                logger.warning(
                    f"Skipping ticket {i}: missing required fields: {missing_fields}"
                )
                self.stats["skipped"] += 1
                continue

            # Create ticket
            logger.info(
                f"Processing ticket {i}/{len(tickets)}: {scraped_ticket.get('ticket_id', 'unknown')}"
            )
            created_ticket_id = self.create_ticket(api_data)

            # Sync responses if ticket was created successfully
            if created_ticket_id:
                self.sync_responses(created_ticket_id, scraped_ticket)

            # Progress logging
            if i % 5 == 0:
                logger.info(f"Progress: {i}/{len(tickets)} tickets processed")

    def print_stats(self):
        """Print sync statistics."""
        logger.info("=" * 50)
        logger.info("SYNC STATISTICS")
        logger.info("=" * 50)
        logger.info(f"Processed:    {self.stats['processed']}")
        logger.info(f"Created:      {self.stats['created']}")
        logger.info(f"Updated:      {self.stats['updated']}")
        logger.info(f"Errors:       {self.stats['errors']}")
        logger.info(f"Skipped:      {self.stats['skipped']}")
        logger.info("=" * 50)


def main():
    """Main entry point."""
    logger.info("Texas811 Ticket Sync Tool")
    logger.info("=" * 50)

    # Check if running from project root
    if not Path(SCRAPED_DATA_FILE).exists():
        logger.error("Please run this script from the project root directory.")
        logger.error(f"Expected file: {SCRAPED_DATA_FILE}")
        sys.exit(1)

    # Create syncer and run sync
    syncer = TicketSyncer()

    try:
        syncer.sync_tickets(SCRAPED_DATA_FILE)
    except KeyboardInterrupt:
        logger.info("Sync interrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
    finally:
        syncer.print_stats()


if __name__ == "__main__":
    main()
