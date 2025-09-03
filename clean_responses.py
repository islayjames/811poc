#!/usr/bin/env python3
"""
Clean up response data by removing invalid entries and fixing data issues.
"""
import json
from pathlib import Path

# Known invalid member codes that are actually field labels or errors
INVALID_MEMBER_CODES = {
    "NAME",
    "MOORE",
    "COMMENT",
    "FACILITIES",
    "ELECTRIC",
    "EXCAVATOR",
    "MEMBER",
    "RESPONSE",
    "UTILITY",
    "Name",
    "square",
    "Comment",
    "Facilities",
    "Electric",
    "Excavator",
}

# Valid utility member codes we've seen
VALID_MEMBER_CODES = {
    "TGC",
    "ETX01",
    "UNIGAS31",
    "CENTRIC31",
    "TXS2",
    "CPTEN01",
    "CPTEN02",
    "CPTGH01",
    "CPTGH02",
    "CPTWD01",
    "ONCOR01",
    "ONCOR02",
    "BEC",
    "BTEX",
    # Add more as we discover them
}

# Map of member codes to full names (where known)
MEMBER_NAMES = {
    "TGC": "Kinder Morgan - Tennessee Gas Pipeline",
    "ETX01": "Entergy Texas Inc",
    "UNIGAS31": "UniGas Services",
    "CENTRIC31": "CenterPoint Energy",
    "CPTEN01": "CenterPoint Energy",
    "CPTEN02": "CenterPoint Energy",
    "ONCOR01": "Oncor Electric",
    "ONCOR02": "Oncor Electric",
}

# Map of member codes to typical facilities
MEMBER_FACILITIES = {
    "TGC": "Gas",
    "ETX01": "Electric",
    "UNIGAS31": "Gas",
    "CENTRIC31": "Gas",
    "CPTEN01": "Electric",
    "CPTEN02": "Electric",
    "ONCOR01": "Electric",
    "ONCOR02": "Electric",
}


def clean_responses():
    """Clean all response data."""
    responses_dir = Path("data/responses")

    total_removed = 0
    total_fixed = 0
    total_tickets = 0

    # Process each ticket directory
    for ticket_dir in responses_dir.iterdir():
        if not ticket_dir.is_dir():
            continue

        ticket_id = ticket_dir.name
        total_tickets += 1
        print(f"\nProcessing ticket {ticket_id}...")

        # Check each response file
        for response_file in ticket_dir.glob("*.json"):
            member_code = response_file.stem

            # Remove invalid responses
            if member_code in INVALID_MEMBER_CODES:
                print(f"  Removing invalid response: {member_code}")
                response_file.unlink()
                total_removed += 1
                continue

            # Fix valid responses
            try:
                with open(response_file) as f:
                    data = json.load(f)

                updated = False

                # Fix status values
                if data.get("status") == "in_conflict":
                    data["status"] = "not_clear"
                    updated = True
                    print(f"  Fixed status for {member_code}: in_conflict -> not_clear")

                # Add missing member names
                if (
                    member_code in MEMBER_NAMES
                    and data.get("member_name") == member_code
                ):
                    data["member_name"] = MEMBER_NAMES[member_code]
                    updated = True
                    print(f"  Added full name for {member_code}")

                # Add missing facilities
                if not data.get("facilities") and member_code in MEMBER_FACILITIES:
                    data["facilities"] = MEMBER_FACILITIES[member_code]
                    updated = True
                    print(
                        f"  Added facilities for {member_code}: {MEMBER_FACILITIES[member_code]}"
                    )

                # Fix user_name if it's sync-import (keep as is for now)

                if updated:
                    with open(response_file, "w") as f:
                        json.dump(data, f, indent=2)
                    total_fixed += 1

            except Exception as e:
                print(f"  Error processing {response_file}: {e}")

    print("\n=== Summary ===")
    print(f"Tickets processed: {total_tickets}")
    print(f"Invalid responses removed: {total_removed}")
    print(f"Responses fixed: {total_fixed}")


if __name__ == "__main__":
    clean_responses()
