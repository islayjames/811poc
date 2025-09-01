"""
Comprehensive tests for compliance date calculations.

This test module covers:
- Texas holiday list and business day calculations
- 2 business day minimum wait period calculations
- 14-day validity window calculations
- Ticket lifecycle status calculations
- Past date prevention validation
- Edge cases and timezone handling

Following TDD approach for compliance.py implementation.
"""

from datetime import date, datetime, timedelta
from unittest.mock import patch

import pytest

from texas811_poc.compliance import (
    ComplianceCalculator,
    add_business_days,
    calculate_lawful_start_date,
    calculate_marking_validity,
    calculate_ticket_expiration,
    get_ticket_lifecycle_status,
    is_business_day,
    texas_holidays_2024,
    texas_holidays_2025,
    validate_future_date,
)


class TestTexasHolidays:
    """Test Texas holiday definitions and business day calculations."""

    def test_texas_holidays_2024_includes_required_holidays(self):
        """Test that 2024 holidays include all required Texas holidays."""
        holidays_2024 = texas_holidays_2024()

        # New Year's Day (Jan 1, 2024 - Monday)
        assert date(2024, 1, 1) in holidays_2024

        # Memorial Day (Last Monday of May - May 27, 2024)
        assert date(2024, 5, 27) in holidays_2024

        # Independence Day (July 4, 2024 - Thursday)
        assert date(2024, 7, 4) in holidays_2024

        # Labor Day (First Monday of September - September 2, 2024)
        assert date(2024, 9, 2) in holidays_2024

        # Thanksgiving (Fourth Thursday of November - November 28, 2024)
        assert date(2024, 11, 28) in holidays_2024

        # Christmas Day (December 25, 2024 - Wednesday)
        assert date(2024, 12, 25) in holidays_2024

    def test_texas_holidays_2025_includes_required_holidays(self):
        """Test that 2025 holidays include all required Texas holidays."""
        holidays_2025 = texas_holidays_2025()

        # New Year's Day (Jan 1, 2025 - Wednesday)
        assert date(2025, 1, 1) in holidays_2025

        # Memorial Day (Last Monday of May - May 26, 2025)
        assert date(2025, 5, 26) in holidays_2025

        # Independence Day (July 4, 2025 - Friday)
        assert date(2025, 7, 4) in holidays_2025

        # Labor Day (First Monday of September - September 1, 2025)
        assert date(2025, 9, 1) in holidays_2025

        # Thanksgiving (Fourth Thursday of November - November 27, 2025)
        assert date(2025, 11, 27) in holidays_2025

        # Christmas Day (December 25, 2025 - Thursday)
        assert date(2025, 12, 25) in holidays_2025

    def test_is_business_day_weekdays(self):
        """Test business day detection for regular weekdays."""
        # Monday - Friday should be business days (if not holidays)
        monday = date(2024, 1, 8)  # January 8, 2024 (Monday, not a holiday)
        tuesday = date(2024, 1, 9)  # January 9, 2024 (Tuesday)
        wednesday = date(2024, 1, 10)  # January 10, 2024 (Wednesday)
        thursday = date(2024, 1, 11)  # January 11, 2024 (Thursday)
        friday = date(2024, 1, 12)  # January 12, 2024 (Friday)

        assert is_business_day(monday) is True
        assert is_business_day(tuesday) is True
        assert is_business_day(wednesday) is True
        assert is_business_day(thursday) is True
        assert is_business_day(friday) is True

    def test_is_business_day_weekends(self):
        """Test business day detection for weekends."""
        # Saturday and Sunday should not be business days
        saturday = date(2024, 1, 6)  # January 6, 2024 (Saturday)
        sunday = date(2024, 1, 7)  # January 7, 2024 (Sunday)

        assert is_business_day(saturday) is False
        assert is_business_day(sunday) is False

    def test_is_business_day_holidays(self):
        """Test business day detection for holidays."""
        # Holidays should not be business days, even if weekdays
        new_years = date(2024, 1, 1)  # Monday, but New Year's Day
        july_4th = date(2024, 7, 4)  # Thursday, but Independence Day
        christmas = date(2024, 12, 25)  # Wednesday, but Christmas

        assert is_business_day(new_years) is False
        assert is_business_day(july_4th) is False
        assert is_business_day(christmas) is False

    def test_add_business_days_simple_case(self):
        """Test adding business days without holidays or weekends."""
        # Start on Monday, add 2 business days -> Wednesday
        start_date = date(2024, 1, 8)  # Monday
        result = add_business_days(start_date, 2)
        expected = date(2024, 1, 10)  # Wednesday
        assert result == expected

    def test_add_business_days_skip_weekend(self):
        """Test adding business days that cross weekends."""
        # Start on Friday, add 1 business day -> next Monday
        start_date = date(2024, 1, 12)  # Friday
        result = add_business_days(start_date, 1)
        expected = date(2024, 1, 15)  # Monday
        assert result == expected

    def test_add_business_days_skip_holiday(self):
        """Test adding business days that cross holidays."""
        # Start on December 24, 2024 (Tuesday), add 2 business days
        # Should skip Christmas Day (Dec 25) and weekend -> December 27, 2024
        start_date = date(2024, 12, 24)  # Tuesday
        result = add_business_days(start_date, 2)
        expected = date(
            2024, 12, 27
        )  # Friday (skips Christmas Wed, Thu is normal business day)
        assert result == expected

    def test_add_business_days_multiple_skips(self):
        """Test adding business days with multiple weekends and holidays."""
        # Start on Thursday before Memorial Day weekend 2024
        start_date = date(2024, 5, 23)  # Thursday
        result = add_business_days(start_date, 3)
        # Business days after Thursday:
        # Fri 5/24 (Day 1), skip weekend, skip Memorial Day Mon 5/27
        # Tue 5/28 (Day 2), Wed 5/29 (Day 3)
        expected = date(2024, 5, 29)  # Wednesday
        assert result == expected


class TestLawfulStartDateCalculation:
    """Test 2 business day minimum calculation."""

    @patch("texas811_poc.compliance.datetime")
    def test_lawful_start_date_basic_case(self, mock_datetime):
        """Test basic lawful start date calculation."""
        # Mock current time as Monday morning
        mock_now = datetime(2024, 1, 8, 10, 0, 0)  # Monday 10 AM
        mock_datetime.now.return_value = mock_now

        result = calculate_lawful_start_date()
        # Should be 2 business days later: Wednesday
        expected = date(2024, 1, 10)
        assert result == expected

    @patch("texas811_poc.compliance.datetime")
    def test_lawful_start_date_crosses_weekend(self, mock_datetime):
        """Test lawful start date calculation crossing weekend."""
        # Mock current time as Thursday afternoon
        mock_now = datetime(2024, 1, 11, 15, 0, 0)  # Thursday 3 PM
        mock_datetime.now.return_value = mock_now

        result = calculate_lawful_start_date()
        # Should be 2 business days later: Monday (skips weekend)
        expected = date(2024, 1, 15)
        assert result == expected

    @patch("texas811_poc.compliance.datetime")
    def test_lawful_start_date_crosses_holiday(self, mock_datetime):
        """Test lawful start date calculation crossing holiday."""
        # Mock current time as Tuesday before July 4th
        mock_now = datetime(2024, 7, 2, 9, 0, 0)  # Tuesday 9 AM
        mock_datetime.now.return_value = mock_now

        result = calculate_lawful_start_date()
        # Should be 2 business days later: Friday (Wed 7/3, skip Thu 7/4 holiday)
        expected = date(2024, 7, 5)
        assert result == expected

    def test_lawful_start_date_with_custom_submission_time(self):
        """Test lawful start date calculation with custom submission time."""
        submission_time = datetime(2024, 1, 8, 14, 30, 0)  # Monday 2:30 PM
        result = calculate_lawful_start_date(submission_time)
        expected = date(2024, 1, 10)  # Wednesday
        assert result == expected

    def test_lawful_start_date_minimum_boundary(self):
        """Test that lawful start date respects minimum 2 business day rule."""
        # Submit on Monday morning
        submission_time = datetime(2024, 1, 8, 8, 0, 0)
        result = calculate_lawful_start_date(submission_time)

        # Even with early submission, must wait minimum 2 business days
        expected = date(2024, 1, 10)  # Wednesday
        assert result == expected


class TestTicketExpirationCalculation:
    """Test 14-day ticket lifecycle calculations."""

    def test_ticket_expiration_basic_case(self):
        """Test basic 14-day expiration calculation."""
        submission_date = date(2024, 1, 8)  # Monday
        result = calculate_ticket_expiration(submission_date)
        expected = date(2024, 1, 22)  # 14 days later
        assert result == expected

    def test_ticket_expiration_from_datetime(self):
        """Test expiration calculation from datetime input."""
        submission_datetime = datetime(2024, 1, 8, 15, 30, 0)
        result = calculate_ticket_expiration(submission_datetime)
        expected = date(2024, 1, 22)  # 14 days from date portion
        assert result == expected

    def test_ticket_expiration_crosses_month_boundary(self):
        """Test expiration calculation crossing month boundary."""
        submission_date = date(2024, 1, 25)  # Late January
        result = calculate_ticket_expiration(submission_date)
        expected = date(2024, 2, 8)  # 14 days later in February
        assert result == expected

    def test_ticket_expiration_leap_year(self):
        """Test expiration calculation during leap year."""
        submission_date = date(2024, 2, 20)  # 2024 is leap year
        result = calculate_ticket_expiration(submission_date)
        expected = date(2024, 3, 5)  # Crosses leap day February 29
        assert result == expected


class TestMarkingValidityCalculation:
    """Test 14-day marking validity calculations."""

    def test_marking_validity_basic_case(self):
        """Test basic 14-day marking validity calculation."""
        response_date = date(2024, 1, 10)  # Wednesday
        result = calculate_marking_validity(response_date)
        expected = date(2024, 1, 24)  # 14 days later
        assert result == expected

    def test_marking_validity_from_datetime(self):
        """Test marking validity from datetime input."""
        response_datetime = datetime(2024, 1, 10, 9, 15, 0)
        result = calculate_marking_validity(response_datetime)
        expected = date(2024, 1, 24)  # 14 days from date portion
        assert result == expected

    def test_marking_validity_multiple_responses(self):
        """Test marking validity with multiple response dates (use latest)."""
        response_dates = [
            date(2024, 1, 10),  # First response
            date(2024, 1, 12),  # Later response - should use this
            date(2024, 1, 11),  # Middle response
        ]

        result = calculate_marking_validity(response_dates)
        expected = date(2024, 1, 26)  # 14 days from latest (Jan 12)
        assert result == expected

    def test_marking_validity_empty_responses(self):
        """Test marking validity with no responses returns None."""
        result = calculate_marking_validity([])
        assert result is None

    def test_marking_validity_none_input(self):
        """Test marking validity with None input returns None."""
        result = calculate_marking_validity(None)
        assert result is None


class TestTicketLifecycleStatus:
    """Test ticket lifecycle status calculations."""

    def test_lifecycle_status_draft(self):
        """Test status for draft tickets."""
        ticket_data = {
            "status": "draft",
            "created_at": datetime.now(),
        }
        result = get_ticket_lifecycle_status(ticket_data)
        assert result["current_status"] == "draft"
        assert result["days_until_expiration"] is None
        assert result["can_start_work"] is False

    def test_lifecycle_status_submitted_before_lawful_start(self):
        """Test status for submitted tickets before lawful start date."""
        tomorrow = date.today() + timedelta(days=3)  # Future lawful start

        ticket_data = {
            "status": "submitted",
            "submitted_at": datetime.now(),
            "lawful_start_date": tomorrow,
            "ticket_expires_date": date.today() + timedelta(days=14),
        }

        result = get_ticket_lifecycle_status(ticket_data)
        assert result["current_status"] == "submitted"
        assert result["can_start_work"] is False
        assert result["days_until_lawful_start"] == 3

    def test_lifecycle_status_ready_to_dig(self):
        """Test status for tickets ready to start work."""
        yesterday = date.today() - timedelta(days=1)  # Past lawful start

        ticket_data = {
            "status": "responses_in",
            "lawful_start_date": yesterday,
            "marking_valid_until": date.today() + timedelta(days=10),
            "ticket_expires_date": date.today() + timedelta(days=5),
        }

        result = get_ticket_lifecycle_status(ticket_data)
        assert result["current_status"] == "ready_to_dig"
        assert result["can_start_work"] is True
        assert result["days_until_expiration"] == 5

    def test_lifecycle_status_expired_ticket(self):
        """Test status for expired tickets."""
        yesterday = date.today() - timedelta(days=1)

        ticket_data = {
            "status": "submitted",
            "ticket_expires_date": yesterday,
            "lawful_start_date": date.today() - timedelta(days=5),
        }

        result = get_ticket_lifecycle_status(ticket_data)
        assert result["current_status"] == "expired"
        assert result["can_start_work"] is False
        assert result["days_until_expiration"] == -1

    def test_lifecycle_status_marking_expired(self):
        """Test status for tickets with expired markings."""
        yesterday = date.today() - timedelta(days=1)

        ticket_data = {
            "status": "responses_in",
            "marking_valid_until": yesterday,
            "ticket_expires_date": date.today() + timedelta(days=5),
            "lawful_start_date": date.today() - timedelta(days=5),
        }

        result = get_ticket_lifecycle_status(ticket_data)
        assert result["markings_valid"] is False
        assert result["days_until_marking_expiration"] == -1

    def test_lifecycle_status_no_responses_warning(self):
        """Test status warning for tickets nearing no-response deadline."""
        # Ticket submitted 12 days ago, expires in 2 days, no responses
        submitted_12_days_ago = datetime.now() - timedelta(days=12)
        expires_in_2_days = date.today() + timedelta(days=2)

        ticket_data = {
            "status": "submitted",
            "submitted_at": submitted_12_days_ago,
            "ticket_expires_date": expires_in_2_days,
            "lawful_start_date": date.today() - timedelta(days=8),
        }

        result = get_ticket_lifecycle_status(ticket_data)
        assert result["requires_action"] is True
        assert "no response" in result["action_required"].lower()


class TestPastDateValidation:
    """Test past date prevention validation."""

    def test_validate_future_date_valid_future(self):
        """Test validation passes for future dates."""
        future_date = date.today() + timedelta(days=1)
        result = validate_future_date(future_date, "work_start_date")
        assert result is True

    def test_validate_future_date_today_allowed(self):
        """Test validation passes for today's date."""
        today = date.today()
        result = validate_future_date(today, "work_start_date")
        assert result is True

    def test_validate_future_date_past_raises_error(self):
        """Test validation raises error for past dates."""
        yesterday = date.today() - timedelta(days=1)

        with pytest.raises(ValueError, match="work_start_date cannot be in the past"):
            validate_future_date(yesterday, "work_start_date")

    def test_validate_future_date_none_allowed(self):
        """Test validation passes for None values."""
        result = validate_future_date(None, "work_start_date")
        assert result is True

    def test_validate_future_date_custom_field_name(self):
        """Test validation uses custom field name in error message."""
        yesterday = date.today() - timedelta(days=1)

        with pytest.raises(ValueError, match="custom_field cannot be in the past"):
            validate_future_date(yesterday, "custom_field")


class TestComplianceCalculatorClass:
    """Test the main ComplianceCalculator class integration."""

    def test_calculator_initialization(self):
        """Test calculator initializes with correct timezone."""
        calculator = ComplianceCalculator()
        assert calculator.timezone == "US/Central"  # Texas timezone

    @patch("texas811_poc.compliance.datetime")
    def test_calculator_full_workflow(self, mock_datetime):
        """Test complete calculator workflow for a new ticket."""
        # Mock submission time
        submission_time = datetime(2024, 1, 8, 10, 0, 0)  # Monday 10 AM
        mock_datetime.now.return_value = submission_time

        calculator = ComplianceCalculator()

        # Calculate all dates for new ticket
        lawful_start = calculator.calculate_lawful_start_date()
        ticket_expiration = calculator.calculate_ticket_expiration(
            submission_time.date()
        )

        assert lawful_start == date(2024, 1, 10)  # Wednesday (+2 business days)
        assert ticket_expiration == date(2024, 1, 22)  # +14 days

    def test_calculator_ticket_update(self):
        """Test calculator with ticket status updates."""
        calculator = ComplianceCalculator()

        # Simulate receiving positive responses
        response_date = date(2024, 1, 15)
        marking_expiry = calculator.calculate_marking_validity(response_date)

        assert marking_expiry == date(2024, 1, 29)  # +14 days from response

    def test_calculator_timezone_handling(self):
        """Test calculator handles timezone conversions correctly."""
        calculator = ComplianceCalculator(timezone="US/Eastern")  # Different timezone

        # Should still work with different timezone
        submission_time = datetime(2024, 1, 8, 15, 0, 0)  # 3 PM Eastern
        result = calculator.calculate_lawful_start_date(submission_time)

        # Should be 2 business days later regardless of timezone
        expected = date(2024, 1, 10)
        assert result == expected


class TestEdgeCases:
    """Test edge cases and error conditions."""

    def test_year_boundary_calculations(self):
        """Test calculations crossing year boundaries."""
        # Submit near end of year
        submission_date = date(2024, 12, 20)  # Friday

        ticket_expiry = calculate_ticket_expiration(submission_date)
        expected_expiry = date(2025, 1, 3)  # 14 days later, crosses New Year
        assert ticket_expiry == expected_expiry

    def test_leap_day_handling(self):
        """Test calculations during leap year edge cases."""
        # Submit on leap day
        submission_date = date(2024, 2, 29)  # Leap day 2024

        ticket_expiry = calculate_ticket_expiration(submission_date)
        expected_expiry = date(2024, 3, 14)  # 14 days later
        assert ticket_expiry == expected_expiry

    def test_holiday_on_weekend(self):
        """Test holiday handling when holiday falls on weekend."""
        # July 4th 2025 is on Friday (regular handling)
        friday_july_4 = date(2025, 7, 4)
        assert is_business_day(friday_july_4) is False

        # Test business day calculation around this holiday
        start_date = date(2025, 7, 2)  # Wednesday before July 4th Friday
        result = add_business_days(start_date, 2)
        expected = date(2025, 7, 7)  # Monday (skip Thu 7/3, Fri 7/4 holiday, weekend)
        assert result == expected

    def test_multiple_holidays_in_sequence(self):
        """Test handling of multiple holidays in close succession."""
        # Thanksgiving week 2024: Thu 11/28 (Thanksgiving)
        start_date = date(2024, 11, 26)  # Tuesday before Thanksgiving
        result = add_business_days(start_date, 3)
        # Business days after Tuesday:
        # Wed 11/27 (Day 1), skip Thanksgiving Thu 11/28, Fri 11/29 (Day 2)
        # Skip weekend, Mon 12/2 (Day 3)
        expected = date(2024, 12, 2)  # Monday
        assert result == expected

    def test_invalid_input_types(self):
        """Test error handling for invalid input types."""
        with pytest.raises(TypeError):
            add_business_days("not a date", 2)

        with pytest.raises(TypeError):
            calculate_ticket_expiration("not a date")

    def test_negative_business_days(self):
        """Test handling of negative business day additions."""
        start_date = date(2024, 1, 10)  # Wednesday
        result = add_business_days(start_date, -2)
        expected = date(2024, 1, 8)  # Monday (2 business days back)
        assert result == expected

    def test_zero_business_days(self):
        """Test handling of zero business day additions."""
        start_date = date(2024, 1, 10)  # Wednesday
        result = add_business_days(start_date, 0)
        assert result == start_date
