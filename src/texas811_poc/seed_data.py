#!/usr/bin/env python3
"""
Seed data script for Texas811 POC - creates realistic test tickets.

This script creates 15-20 realistic Texas 811 tickets with:
- Houston, Dallas, Austin, San Antonio locations
- Varied statuses: draft, validated, ready, submitted, responses_in, expired
- Realistic Texas addresses and company information
- Proper GPS coordinates for Texas cities
- Different work types and scenarios
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from texas811_poc.config import settings
from texas811_poc.models import (
    AuditAction,
    AuditEventModel,
    TicketModel,
    TicketStatus,
    ValidationSeverity,
)
from texas811_poc.storage import create_storage_instances

logger = logging.getLogger(__name__)

# Texas city coordinates (realistic GPS coordinates)
TEXAS_CITIES = {
    "Houston": {
        "county": "Harris",
        "coordinates": [
            (-95.369803, 29.760427),  # Downtown Houston
            (-95.401829, 29.735577),  # Near Galleria
            (-95.349934, 29.749907),  # East Houston
            (-95.394894, 29.786280),  # Heights area
            (-95.356537, 29.728167),  # Hobby area
        ],
    },
    "Dallas": {
        "county": "Dallas",
        "coordinates": [
            (-96.796988, 32.776664),  # Downtown Dallas
            (-96.765305, 32.815651),  # North Dallas
            (-96.835876, 32.741208),  # West Dallas
            (-96.748369, 32.738065),  # East Dallas
            (-96.813081, 32.803467),  # Uptown
        ],
    },
    "Austin": {
        "county": "Travis",
        "coordinates": [
            (-97.743061, 30.267153),  # Downtown Austin
            (-97.688271, 30.307182),  # East Austin
            (-97.782040, 30.290105),  # West Austin
            (-97.756138, 30.244109),  # South Austin
            (-97.731405, 30.334147),  # North Austin
        ],
    },
    "San Antonio": {
        "county": "Bexar",
        "coordinates": [
            (-98.493628, 29.424122),  # Downtown San Antonio
            (-98.469749, 29.482023),  # North San Antonio
            (-98.534554, 29.395064),  # West San Antonio
            (-98.437405, 29.403946),  # East San Antonio
            (-98.520140, 29.462711),  # Northwest SA
        ],
    },
}

# Realistic Texas companies and contact information
TEXAS_COMPANIES = [
    {"name": "Lone Star Construction LLC", "phone": "(713) 555-0123"},
    {"name": "Texas Excavation Services", "phone": "(214) 555-0456"},
    {"name": "Gulf Coast Utilities", "phone": "(281) 555-0789"},
    {"name": "Hill Country Infrastructure", "phone": "(512) 555-1011"},
    {"name": "Alamo Construction Co", "phone": "(210) 555-1213"},
    {"name": "Big Bend Excavating", "phone": "(432) 555-1415"},
    {"name": "East Texas Contractors", "phone": "(903) 555-1617"},
    {"name": "Permian Basin Services", "phone": "(915) 555-1819"},
    {"name": "Piney Woods Construction", "phone": "(936) 555-2021"},
    {"name": "Rio Grande Utilities", "phone": "(956) 555-2223"},
]

CALLER_NAMES = [
    "Mike Rodriguez",
    "Sarah Johnson",
    "David Kim",
    "Lisa Martinez",
    "Robert Wilson",
    "Jennifer Brown",
    "Carlos Gonzalez",
    "Amanda Davis",
    "Kevin O'Connor",
    "Maria Hernandez",
    "James Thompson",
    "Emily White",
    "Daniel Singh",
    "Ashley Moore",
    "Michael Chen",
    "Jessica Taylor",
]

WORK_DESCRIPTIONS = [
    "Installing fiber optic cable for telecommunications upgrade",
    "Utility water line repair and replacement",
    "Natural gas service line installation",
    "Electric power line underground installation",
    "Sewer line maintenance and cleaning",
    "Cable TV service line installation",
    "Street light electrical installation",
    "Traffic signal underground wiring",
    "Building foundation excavation",
    "Parking lot utility installation",
    "Emergency water main repair",
    "Internet fiber installation for business",
    "Storm drain repair and maintenance",
    "Underground conduit for electrical service",
    "Telecommunications tower foundation",
]

STREET_NAMES = [
    "Main Street",
    "First Avenue",
    "Commerce Street",
    "Houston Street",
    "Austin Street",
    "Dallas Avenue",
    "San Antonio Road",
    "University Drive",
    "Industrial Boulevard",
    "Business Loop",
    "State Highway",
    "Farm Road",
    "County Road",
    "Memorial Drive",
    "Spring Valley Road",
    "Oak Grove Lane",
]

CROSS_STREETS = [
    "Near First Street",
    "At Commerce Avenue",
    "Between Oak and Elm",
    "Close to Main Street",
    "Adjacent to Industrial Blvd",
    "By the highway",
    "Near the shopping center",
    "Behind City Hall",
    "Next to the school",
    "At the traffic light",
    "By the gas station",
    "Near the park",
]


def generate_realistic_address(city: str, coords: tuple[float, float]) -> str:
    """Generate a realistic address for the given city and coordinates."""
    import random

    street_number = random.randint(100, 9999)
    street_name = random.choice(STREET_NAMES)
    return f"{street_number} {street_name}, {city}, TX {random.randint(70000, 79999)}"


def create_ticket_data() -> list[dict[str, Any]]:
    """Create realistic ticket data for all Texas cities."""
    import random

    tickets = []
    ticket_counter = 1

    # Create tickets for each city
    for city, city_info in TEXAS_CITIES.items():
        county = city_info["county"]
        coordinates_list = city_info["coordinates"]

        # Create 3-5 tickets per city
        num_tickets = random.randint(3, 5)

        for _ in range(num_tickets):
            # Select random coordinates for this city
            lng, lat = random.choice(coordinates_list)

            # Generate ticket details
            company = random.choice(TEXAS_COMPANIES)
            caller_name = random.choice(CALLER_NAMES)
            work_desc = random.choice(WORK_DESCRIPTIONS)
            address = generate_realistic_address(city, (lng, lat))
            cross_street = (
                random.choice(CROSS_STREETS) if random.choice([True, False]) else None
            )

            # Determine status distribution (more realistic mix)
            status_weights = [
                (TicketStatus.DRAFT, 1),
                (TicketStatus.VALIDATED, 3),
                (TicketStatus.READY, 2),
                (TicketStatus.SUBMITTED, 2),
                (TicketStatus.RESPONSES_IN, 1),
                (TicketStatus.EXPIRED, 1),
            ]
            status = random.choices(
                [s[0] for s in status_weights], weights=[s[1] for s in status_weights]
            )[0]

            # Calculate dates based on status
            created_date = datetime.now(UTC) - timedelta(days=random.randint(0, 10))
            updated_date = created_date + timedelta(hours=random.randint(1, 48))

            lawful_start_date = (created_date + timedelta(days=2)).date()
            ticket_expires_date = (created_date + timedelta(days=14)).date()

            # Determine if submitted
            submitted_at = None
            marking_valid_until = None
            if status in [TicketStatus.SUBMITTED, TicketStatus.RESPONSES_IN]:
                submitted_at = created_date + timedelta(hours=random.randint(6, 24))
                marking_valid_until = (submitted_at + timedelta(days=14)).date()

            # Create validation gaps based on completeness
            validation_gaps = []
            if not cross_street:
                validation_gaps.append(
                    {
                        "field_name": "cross_street",
                        "severity": ValidationSeverity.RECOMMENDED,
                        "message": "Cross Street is recommended for faster processing",
                        "prompt_text": "What's the nearest cross street or landmark?",
                    }
                )

            if status == TicketStatus.DRAFT:
                # Draft tickets have more gaps
                validation_gaps.extend(
                    [
                        {
                            "field_name": "caller_company",
                            "severity": ValidationSeverity.REQUIRED,
                            "message": "Company name is required",
                            "prompt_text": "What company are you with?",
                        },
                        {
                            "field_name": "caller_phone",
                            "severity": ValidationSeverity.REQUIRED,
                            "message": "Phone number is required",
                            "prompt_text": "What's the best phone number to reach you?",
                        },
                    ]
                )

            # Create geometry
            geometry = {
                "type": "Point",
                "coordinates": [lng, lat],
                "confidence_score": round(random.uniform(0.7, 1.0), 6),
                "source": "geocoded_address",
                "created_at": created_date.isoformat(),
            }

            # Create submission packet for ready/submitted tickets
            submission_packet = None
            if status in [
                TicketStatus.READY,
                TicketStatus.SUBMITTED,
                TicketStatus.RESPONSES_IN,
            ]:
                submission_packet = {
                    "texas811_fields": {
                        "county": county,
                        "city": city,
                        "address": address,
                        "cross_street": cross_street,
                        "work_description": work_desc,
                        "caller_name": caller_name,
                        "caller_company": company["name"],
                        "caller_phone": company["phone"],
                        "work_type": (
                            "emergency"
                            if "emergency" in work_desc.lower()
                            else "normal"
                        ),
                    },
                    "geometry_data": {
                        "gps_coordinates": {"latitude": lat, "longitude": lng},
                        "geometry": geometry,
                    },
                    "compliance_dates": {
                        "lawful_start_date": lawful_start_date.isoformat(),
                        "ticket_expires_date": ticket_expires_date.isoformat(),
                        "marking_valid_until": (
                            marking_valid_until.isoformat()
                            if marking_valid_until
                            else None
                        ),
                    },
                    "metadata": {
                        "submission_format": "texas811_portal",
                        "generated_by": "seed_data_script",
                    },
                }

            # Create the ticket
            ticket = {
                "ticket_id": str(uuid.uuid4()),
                "session_id": f"seed-data-session-{city.lower()}-{ticket_counter:03d}",
                "status": status,
                "created_at": created_date.isoformat(),
                "updated_at": updated_date.isoformat(),
                "county": county,
                "city": city,
                "address": address,
                "cross_street": cross_street,
                "gps_lat": lat,
                "gps_lng": lng,
                "work_description": work_desc,
                "caller_name": caller_name if status != TicketStatus.DRAFT else None,
                "caller_company": (
                    company["name"] if status != TicketStatus.DRAFT else None
                ),
                "caller_phone": (
                    company["phone"] if status != TicketStatus.DRAFT else None
                ),
                "caller_email": (
                    f"{caller_name.lower().replace(' ', '.')}@{company['name'].lower().replace(' ', '').replace(',', '').replace('.', '')}.com"
                    if status
                    in [
                        TicketStatus.READY,
                        TicketStatus.SUBMITTED,
                        TicketStatus.RESPONSES_IN,
                    ]
                    else None
                ),
                "work_start_date": (
                    (datetime.now(UTC) + timedelta(days=random.randint(3, 10)))
                    .date()
                    .isoformat()
                    if status in [TicketStatus.READY, TicketStatus.SUBMITTED]
                    else None
                ),
                "work_duration_days": (
                    random.randint(1, 5)
                    if status in [TicketStatus.READY, TicketStatus.SUBMITTED]
                    else None
                ),
                "work_type": (
                    "emergency"
                    if "emergency" in work_desc.lower()
                    else ("normal" if status != TicketStatus.DRAFT else None)
                ),
                "validation_gaps": validation_gaps,
                "geometry": geometry,
                "lawful_start_date": lawful_start_date.isoformat(),
                "ticket_expires_date": ticket_expires_date.isoformat(),
                "marking_valid_until": (
                    marking_valid_until.isoformat() if marking_valid_until else None
                ),
                "submitted_at": submitted_at.isoformat() if submitted_at else None,
                "submission_packet": submission_packet,
            }

            tickets.append(ticket)
            ticket_counter += 1

    return tickets


def clear_existing_data():
    """Clear existing ticket data (optional)."""
    ticket_storage, audit_storage, backup_manager = create_storage_instances(
        settings.data_root
    )

    # Get all existing tickets
    try:
        existing_tickets = ticket_storage.list_tickets()
        print(f"Found {len(existing_tickets)} existing tickets")

        # Optionally clear them (uncomment if you want fresh data)
        # for ticket in existing_tickets:
        #     ticket_storage.delete_ticket(ticket.ticket_id)
        # print("Cleared all existing tickets")

    except Exception as e:
        print(f"Note: Could not check existing tickets: {e}")


def create_seed_data():
    """Create and store seed data for Texas811 POC."""
    print("🌱 Creating Texas811 POC seed data...")

    # Initialize storage
    ticket_storage, audit_storage, backup_manager = create_storage_instances(
        settings.data_root
    )

    # Clear existing data (optional)
    clear_existing_data()

    # Create ticket data
    tickets_data = create_ticket_data()
    print(f"📝 Generated {len(tickets_data)} realistic Texas tickets")

    # Store tickets
    stored_count = 0
    for ticket_data in tickets_data:
        try:
            # Create TicketModel from data
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
                        "source": "seed_data_script",
                    },
                    timestamp=datetime.fromisoformat(
                        ticket_model.created_at.replace("Z", "+00:00")
                    ),
                )
                audit_storage.save_event(audit_event)
            except Exception as audit_error:
                print(
                    f"⚠️  Warning: Could not create audit event for {ticket_model.ticket_id}: {audit_error}"
                )
                # Continue without audit event

            stored_count += 1

        except Exception as e:
            print(
                f"❌ Error storing ticket {ticket_data.get('ticket_id', 'unknown')}: {e}"
            )
            continue

    print(f"✅ Successfully stored {stored_count}/{len(tickets_data)} tickets")

    # Print summary by city and status
    print("\n📊 Seed Data Summary:")
    city_status_counts = {}

    for ticket in tickets_data[:stored_count]:
        city = ticket["city"]
        status = ticket["status"]

        if city not in city_status_counts:
            city_status_counts[city] = {}
        if status not in city_status_counts[city]:
            city_status_counts[city][status] = 0
        city_status_counts[city][status] += 1

    for city, statuses in city_status_counts.items():
        print(f"  {city}: {sum(statuses.values())} tickets")
        for status, count in statuses.items():
            print(f"    - {status}: {count}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    create_seed_data()
