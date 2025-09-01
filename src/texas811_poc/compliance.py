"""
Texas811 compliance date calculation module.

This module provides compliance date calculations for Texas 811 tickets including:
- Texas holiday definitions for POC (2024-2025)
- Business day calculations (excluding weekends and holidays)
- 2 business day minimum wait period calculation
- 14-day ticket lifecycle calculations
- Ticket status and expiration validation
- Past date prevention for work confirmations

Follows Texas 811 legal requirements for timing and ticket lifecycle management.
"""

from datetime import date, datetime, timedelta
from typing import Any

import pytz


# Texas holidays for POC - hardcoded for 2024 and 2025
def texas_holidays_2024() -> set[date]:
    """Return set of Texas holidays for 2024."""
    return {
        date(2024, 1, 1),  # New Year's Day (Monday)
        date(2024, 5, 27),  # Memorial Day (Last Monday of May)
        date(2024, 7, 4),  # Independence Day (Thursday)
        date(2024, 9, 2),  # Labor Day (First Monday of September)
        date(2024, 11, 28),  # Thanksgiving (Fourth Thursday of November)
        date(2024, 12, 25),  # Christmas Day (Wednesday)
    }


def texas_holidays_2025() -> set[date]:
    """Return set of Texas holidays for 2025."""
    return {
        date(2025, 1, 1),  # New Year's Day (Wednesday)
        date(2025, 5, 26),  # Memorial Day (Last Monday of May)
        date(2025, 7, 4),  # Independence Day (Friday)
        date(2025, 9, 1),  # Labor Day (First Monday of September)
        date(2025, 11, 27),  # Thanksgiving (Fourth Thursday of November)
        date(2025, 12, 25),  # Christmas Day (Thursday)
    }


def get_texas_holidays(year: int) -> set[date]:
    """Get Texas holidays for a specific year."""
    if year == 2024:
        return texas_holidays_2024()
    elif year == 2025:
        return texas_holidays_2025()
    else:
        # For other years, calculate dynamically (POC limitation)
        return _calculate_texas_holidays_for_year(year)


def _calculate_texas_holidays_for_year(year: int) -> set[date]:
    """Calculate Texas holidays for years outside hardcoded range."""
    holidays = set()

    # New Year's Day
    holidays.add(date(year, 1, 1))

    # Memorial Day (Last Monday of May)
    last_day_may = date(year, 5, 31)
    days_from_monday = (last_day_may.weekday() - 0) % 7
    memorial_day = last_day_may - timedelta(days=days_from_monday)
    holidays.add(memorial_day)

    # Independence Day
    holidays.add(date(year, 7, 4))

    # Labor Day (First Monday of September)
    first_day_sep = date(year, 9, 1)
    days_to_monday = (0 - first_day_sep.weekday()) % 7
    labor_day = first_day_sep + timedelta(days=days_to_monday)
    holidays.add(labor_day)

    # Thanksgiving (Fourth Thursday of November)
    first_day_nov = date(year, 11, 1)
    days_to_thursday = (3 - first_day_nov.weekday()) % 7
    first_thursday = first_day_nov + timedelta(days=days_to_thursday)
    thanksgiving = first_thursday + timedelta(weeks=3)  # Fourth Thursday
    holidays.add(thanksgiving)

    # Christmas Day
    holidays.add(date(year, 12, 25))

    return holidays


def is_business_day(check_date: date) -> bool:
    """
    Check if a given date is a business day.

    Business days are Monday-Friday, excluding Texas holidays.

    Args:
        check_date: Date to check

    Returns:
        True if the date is a business day, False otherwise
    """
    # Check if weekend (Saturday=5, Sunday=6)
    if check_date.weekday() >= 5:
        return False

    # Check if holiday
    texas_holidays = get_texas_holidays(check_date.year)
    if check_date in texas_holidays:
        return False

    return True


def add_business_days(start_date: date, business_days: int) -> date:
    """
    Add business days to a start date, skipping weekends and holidays.

    Args:
        start_date: Starting date
        business_days: Number of business days to add (can be negative)

    Returns:
        Date after adding the specified business days

    Raises:
        TypeError: If start_date is not a date object
    """
    if not isinstance(start_date, date):
        raise TypeError("start_date must be a date object")

    current_date = start_date
    remaining_days = abs(business_days)
    direction = 1 if business_days >= 0 else -1

    while remaining_days > 0:
        current_date += timedelta(days=direction)

        if is_business_day(current_date):
            remaining_days -= 1

    return current_date


def calculate_lawful_start_date(submission_time: datetime | None = None) -> date:
    """
    Calculate the lawful start date for work (2 business days minimum).

    Per Texas 811 requirements, work cannot begin until at least 2 business
    days after ticket submission, excluding weekends and holidays.

    Args:
        submission_time: When ticket was submitted (defaults to now)

    Returns:
        Earliest lawful date to start work
    """
    if submission_time is None:
        submission_time = datetime.now()

    submission_date = submission_time.date()
    return add_business_days(submission_date, 2)


def calculate_ticket_expiration(submission_date: date | datetime) -> date:
    """
    Calculate when a ticket expires (14 days from submission).

    Per Texas 811 requirements, tickets are valid for 14 days from submission.

    Args:
        submission_date: When ticket was submitted

    Returns:
        Date when ticket expires

    Raises:
        TypeError: If submission_date is not a date or datetime object
    """
    if hasattr(submission_date, "date"):  # datetime object
        submission_date = submission_date.date()
    elif not hasattr(submission_date, "year"):  # not a date object
        raise TypeError("submission_date must be a date or datetime object")

    return submission_date + timedelta(days=14)


def calculate_marking_validity(
    response_date: date | datetime | list[date | datetime] | None,
) -> date | None:
    """
    Calculate when markings expire (14 days from positive response).

    Per Texas 811 requirements, markings are valid for 14 days from when
    positive responses are received from utilities.

    Args:
        response_date: When positive responses were received. Can be:
                      - Single date/datetime
                      - List of dates/datetimes (uses latest)
                      - None (returns None)

    Returns:
        Date when markings expire, or None if no responses
    """
    if response_date is None:
        return None

    if isinstance(response_date, list):
        if not response_date:
            return None

        # Convert all to dates and find the latest
        dates = []
        for rd in response_date:
            if hasattr(rd, "date"):  # datetime object
                dates.append(rd.date())
            elif hasattr(rd, "year"):  # date object
                dates.append(rd)
            else:
                raise TypeError("All response dates must be date or datetime objects")

        latest_response = max(dates)
    else:
        if hasattr(response_date, "date"):  # datetime object
            latest_response = response_date.date()
        elif hasattr(response_date, "year"):  # date object
            latest_response = response_date
        else:
            raise TypeError("response_date must be a date or datetime object")

    return latest_response + timedelta(days=14)


def validate_future_date(check_date: date | None, field_name: str) -> bool:
    """
    Validate that a date is not in the past.

    Used to prevent setting work start dates or other future dates to past values.

    Args:
        check_date: Date to validate (None is allowed)
        field_name: Name of field for error message

    Returns:
        True if date is valid (future or today)

    Raises:
        ValueError: If date is in the past
    """
    if check_date is None:
        return True

    if check_date < date.today():
        raise ValueError(f"{field_name} cannot be in the past")

    return True


def get_ticket_lifecycle_status(ticket_data: dict[str, Any]) -> dict[str, Any]:
    """
    Calculate comprehensive ticket lifecycle status and timing information.

    Analyzes ticket state and dates to provide complete status including:
    - Current lifecycle phase
    - Days until key milestones
    - Work authorization status
    - Required actions and warnings

    Args:
        ticket_data: Dictionary containing ticket fields

    Returns:
        Dictionary with comprehensive status information
    """
    status = ticket_data.get("status", "draft")
    today = date.today()

    # Base status info
    lifecycle_status = {
        "current_status": status,
        "can_start_work": False,
        "markings_valid": False,
        "requires_action": False,
        "action_required": None,
        "days_until_lawful_start": None,
        "days_until_expiration": None,
        "days_until_marking_expiration": None,
    }

    # Get key dates
    lawful_start_date = ticket_data.get("lawful_start_date")
    ticket_expires_date = ticket_data.get("ticket_expires_date")
    marking_valid_until = ticket_data.get("marking_valid_until")
    submitted_at = ticket_data.get("submitted_at")

    # Calculate days until expiration
    if ticket_expires_date:
        if isinstance(ticket_expires_date, str):
            ticket_expires_date = datetime.fromisoformat(ticket_expires_date).date()
        days_until_expiry = (ticket_expires_date - today).days
        lifecycle_status["days_until_expiration"] = days_until_expiry

        # Check if expired
        if days_until_expiry < 0:
            lifecycle_status["current_status"] = "expired"
            lifecycle_status["requires_action"] = True
            lifecycle_status["action_required"] = (
                "Ticket has expired - create new ticket"
            )
            return lifecycle_status

    # Calculate days until lawful start
    if lawful_start_date:
        if isinstance(lawful_start_date, str):
            lawful_start_date = datetime.fromisoformat(lawful_start_date).date()
        days_until_lawful = (lawful_start_date - today).days
        lifecycle_status["days_until_lawful_start"] = days_until_lawful

        # Can start work if past lawful start date
        if days_until_lawful <= 0:
            lifecycle_status["can_start_work"] = True

    # Calculate marking validity
    if marking_valid_until:
        if isinstance(marking_valid_until, str):
            marking_valid_until = datetime.fromisoformat(marking_valid_until).date()
        days_until_marking_expiry = (marking_valid_until - today).days
        lifecycle_status["days_until_marking_expiration"] = days_until_marking_expiry

        # Markings valid if not expired
        if days_until_marking_expiry >= 0:
            lifecycle_status["markings_valid"] = True
        else:
            lifecycle_status["requires_action"] = True
            lifecycle_status["action_required"] = (
                "Markings have expired - request re-mark"
            )

    # Status-specific logic
    if status == "draft":
        lifecycle_status["action_required"] = "Complete ticket fields and submit"

    elif status == "validated":
        lifecycle_status["action_required"] = "Review and confirm ticket for submission"

    elif status == "ready":
        lifecycle_status["action_required"] = "Submit ticket to Texas811 portal"

    elif status == "submitted":
        # Check for no-response situation nearing expiration
        if ticket_expires_date and submitted_at:
            days_since_submit = (
                (today - submitted_at.date()).days
                if hasattr(submitted_at, "date")
                else (today - submitted_at).days
            )
            days_until_expiry = lifecycle_status.get("days_until_expiration", 0)

            # Warn if nearing expiration without responses
            if days_since_submit >= 10 and days_until_expiry <= 4:
                lifecycle_status["requires_action"] = True
                lifecycle_status["action_required"] = (
                    "No response received - ticket expires soon. May need emergency ticket."
                )

        # Update status if ready to dig
        if (
            lifecycle_status["can_start_work"]
            and lifecycle_status["markings_valid"]
            and marking_valid_until
        ):
            lifecycle_status["current_status"] = "ready_to_dig"

    elif status == "responses_in":
        if lifecycle_status["can_start_work"] and lifecycle_status["markings_valid"]:
            lifecycle_status["current_status"] = "ready_to_dig"
        elif not lifecycle_status["markings_valid"]:
            lifecycle_status["requires_action"] = True
            lifecycle_status["action_required"] = (
                "Request re-marking - current markings expired"
            )

    return lifecycle_status


class ComplianceCalculator:
    """
    Main compliance calculation class for Texas811 POC.

    Provides a unified interface for all compliance date calculations
    with configurable timezone support and caching for performance.
    """

    def __init__(self, timezone: str = "US/Central"):
        """
        Initialize compliance calculator.

        Args:
            timezone: Timezone for date calculations (default: US/Central for Texas)
        """
        self.timezone = timezone
        self.tz = pytz.timezone(timezone)
        self._holiday_cache = {}

    def calculate_lawful_start_date(
        self, submission_time: datetime | None = None
    ) -> date:
        """Calculate lawful start date with timezone handling."""
        if submission_time is None:
            # Get current time in configured timezone
            utc_now = datetime.now(pytz.UTC)
            local_now = utc_now.astimezone(self.tz)
            submission_time = local_now.replace(
                tzinfo=None
            )  # Remove timezone for consistency

        return calculate_lawful_start_date(submission_time)

    def calculate_ticket_expiration(self, submission_date: date | datetime) -> date:
        """Calculate ticket expiration date."""
        return calculate_ticket_expiration(submission_date)

    def calculate_marking_validity(
        self,
        response_date: date | datetime | list[date | datetime] | None,
    ) -> date | None:
        """Calculate marking validity expiration."""
        return calculate_marking_validity(response_date)

    def get_ticket_lifecycle_status(
        self, ticket_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Get comprehensive ticket lifecycle status."""
        return get_ticket_lifecycle_status(ticket_data)

    def validate_future_date(self, check_date: date | None, field_name: str) -> bool:
        """Validate date is not in past."""
        return validate_future_date(check_date, field_name)

    def update_ticket_compliance_fields(
        self, ticket_data: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Update ticket with calculated compliance fields.

        Calculates and adds lawful_start_date, ticket_expires_date, and
        marking_valid_until fields to ticket data.

        Args:
            ticket_data: Ticket dictionary to update

        Returns:
            Updated ticket data with compliance fields
        """
        # Calculate lawful start date if not set
        if not ticket_data.get("lawful_start_date"):
            created_at = ticket_data.get("created_at")
            if created_at:
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(
                        created_at.replace("Z", "+00:00")
                    )
                ticket_data["lawful_start_date"] = self.calculate_lawful_start_date(
                    created_at
                )

        # Calculate ticket expiration if not set
        if not ticket_data.get("ticket_expires_date"):
            submitted_at = ticket_data.get("submitted_at") or ticket_data.get(
                "created_at"
            )
            if submitted_at:
                if isinstance(submitted_at, str):
                    submitted_at = datetime.fromisoformat(
                        submitted_at.replace("Z", "+00:00")
                    )
                ticket_data["ticket_expires_date"] = self.calculate_ticket_expiration(
                    submitted_at
                )

        # Update marking validity if responses are recorded
        # This would be called when responses are received

        return ticket_data
