#!/usr/bin/env python3
"""
Fix ticket status and dates based on actual responses.
"""
import json
from datetime import datetime, timedelta
from pathlib import Path

# Get ticket and response directories
tickets_dir = Path("data/tickets")
responses_dir = Path("data/responses")


def has_responses(ticket_id):
    """Check if ticket has any responses."""
    response_dir = responses_dir / ticket_id
    if not response_dir.exists():
        return False

    # Count actual response files
    response_files = list(response_dir.glob("*.json"))
    return len(response_files) > 0


def calculate_dates(work_start_date):
    """Calculate proper dates based on work start date."""
    # Parse the work start date
    if work_start_date:
        try:
            start = datetime.strptime(work_start_date, "%Y-%m-%d")
        except ValueError:
            start = datetime.now()
    else:
        start = datetime.now() + timedelta(days=2)

    # Lawful start is 2 business days after request (simplified - not accounting for weekends)
    lawful_start = start

    # Ticket expires 14 days after creation
    expires = lawful_start + timedelta(days=14)

    return lawful_start.strftime("%Y-%m-%d"), expires.strftime("%Y-%m-%d")


def fix_tickets():
    """Fix all ticket statuses and dates."""
    fixed_count = 0

    # Process each ticket
    for ticket_file in tickets_dir.glob("*.json"):
        ticket_id = ticket_file.stem

        try:
            with open(ticket_file) as f:
                data = json.load(f)

            updated = False

            # Fix status based on actual responses
            old_status = data.get("status")
            if has_responses(ticket_id):
                # Has responses - mark as responses_in
                data["status"] = "responses_in"
            else:
                # No responses - should be submitted
                data["status"] = "submitted"

            if old_status != data["status"]:
                updated = True
                print(f"  {ticket_id}: status {old_status} -> {data['status']}")

            # Fix dates based on work_start_date
            work_start = data.get("work_start_date")
            lawful_start, expires = calculate_dates(work_start)

            if data.get("lawful_start_date") != lawful_start:
                data["lawful_start_date"] = lawful_start
                updated = True
                print(f"  {ticket_id}: lawful_start_date -> {lawful_start}")

            if data.get("ticket_expires_date") != expires:
                data["ticket_expires_date"] = expires
                updated = True
                print(f"  {ticket_id}: ticket_expires_date -> {expires}")

            # Save if updated
            if updated:
                with open(ticket_file, "w") as f:
                    json.dump(data, f, indent=2)
                fixed_count += 1

        except Exception as e:
            print(f"  Error processing {ticket_file}: {e}")

    return fixed_count


if __name__ == "__main__":
    print("Fixing ticket statuses and dates...")
    fixed = fix_tickets()
    print(f"\nFixed {fixed} tickets")
