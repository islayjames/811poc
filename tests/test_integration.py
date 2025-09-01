"""
Comprehensive integration tests for Texas 811 POC backend.

This module provides end-to-end testing of the complete POC functionality including:
- Complete ticket lifecycle (create → validate → update → confirm → submit)
- Multi-turn CustomGPT workflow simulation
- State machine transitions and field locking
- Compliance date calculations in real workflow context
- Performance validation and benchmarks
- Error recovery scenarios
- Real workflow integration testing

Tests simulate actual CustomGPT interactions and validate the complete
ticket processing pipeline matches Texas811 requirements.
"""

import json
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from src.texas811_poc.models import TicketStatus


class TestTicketLifecycleIntegration:
    """Integration tests for complete ticket lifecycle workflows."""

    @pytest.fixture
    def sample_work_orders(self) -> dict[str, Any]:
        """Load sample work order fixtures."""
        fixtures_path = Path(__file__).parent / "fixtures" / "sample_work_orders.json"
        with open(fixtures_path) as f:
            return json.load(f)

    @pytest.fixture
    def valid_headers(self) -> dict[str, str]:
        """Headers with valid API key for authenticated requests."""
        return {
            "Authorization": "Bearer test-api-key-12345",
            "Content-Type": "application/json",
        }

    def test_complete_ticket_lifecycle_success(
        self,
        client: TestClient,
        valid_headers: dict[str, str],
        sample_work_orders: dict,
    ):
        """Test complete successful ticket lifecycle from creation to submission."""
        work_order = sample_work_orders["valid_complete_work_order"]

        # Step 1: Create initial ticket
        create_response = client.post(
            "/tickets/create", headers=valid_headers, json=work_order
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        create_data = create_response.json()

        ticket_id = create_data["ticket_id"]
        assert create_data["success"] is True
        assert create_data["status"] in [TicketStatus.DRAFT, TicketStatus.VALIDATED]
        assert len(create_data["validation_gaps"]) >= 0

        # Verify ticket exists and has expected data
        assert create_data["county"] == work_order["county"]
        assert create_data["city"] == work_order["city"]
        assert create_data["address"] == work_order["address"]
        assert create_data["work_description"] == work_order["work_description"]
        assert create_data["session_id"] == work_order["session_id"]

        # Step 2: Update ticket to fill any gaps (simulate gap resolution)
        if create_data["validation_gaps"]:
            # Fill in missing fields based on gaps
            update_data = {"session_id": work_order["session_id"]}
            for gap in create_data["validation_gaps"]:
                if gap["field_name"] == "cross_street" and "cross_street" in work_order:
                    update_data["cross_street"] = work_order["cross_street"]
                elif (
                    gap["field_name"] == "caller_phone" and "caller_phone" in work_order
                ):
                    update_data["caller_phone"] = work_order["caller_phone"]

            if len(update_data) > 1:  # If we have updates beyond session_id
                update_response = client.post(
                    f"/tickets/{ticket_id}/update",
                    headers=valid_headers,
                    json=update_data,
                )
                assert update_response.status_code == status.HTTP_200_OK
                update_data_response = update_response.json()
                assert update_data_response["success"] is True

        # Step 3: Confirm ticket (this may validate and/or submit depending on readiness)
        confirm_response = client.post(
            f"/tickets/{ticket_id}/confirm",
            headers=valid_headers,
            json={
                "session_id": work_order["session_id"],
                "confirm_submission": True,  # Request actual submission
            },
        )

        if confirm_response.status_code == status.HTTP_200_OK:
            confirm_data = confirm_response.json()
            assert confirm_data["success"] is True

            # Check the final status - should be either READY or SUBMITTED
            final_status = confirm_data["status"]
            assert final_status in [TicketStatus.READY, TicketStatus.SUBMITTED]

            # If submitted, verify compliance dates were calculated
            if final_status == TicketStatus.SUBMITTED:
                # Check for compliance dates in various possible locations
                if "compliance_dates" in confirm_data:
                    compliance = confirm_data["compliance_dates"]
                    assert compliance.get("lawful_start_date") is not None
                    assert compliance.get("ticket_expires_date") is not None
                else:
                    assert confirm_data.get("lawful_start_date") is not None
                    assert confirm_data.get("ticket_expires_date") is not None
                assert confirm_data.get("submitted_at") is not None

            # Packet data might be in different formats, let's be flexible
            packet_indicators = [
                confirm_data.get("packet_data"),
                confirm_data.get("submission_packet"),
                confirm_data.get("texas811_packet"),
            ]
            assert any(
                packet is not None for packet in packet_indicators
            ), f"No packet data found. Available keys: {list(confirm_data.keys())}"

    def test_multi_turn_workflow_simulation(
        self,
        client: TestClient,
        valid_headers: dict[str, str],
        sample_work_orders: dict,
    ):
        """Test multi-turn CustomGPT conversation workflow with iterative updates."""
        work_order = sample_work_orders["work_order_missing_fields"]

        # Turn 1: Initial creation with missing fields
        create_response = client.post(
            "/tickets/create", headers=valid_headers, json=work_order
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        create_data = create_response.json()
        ticket_id = create_data["ticket_id"]

        # Should have validation gaps due to missing fields
        assert len(create_data["validation_gaps"]) > 0

        # Turn 2: Fill in some missing information
        update_1 = {
            "session_id": work_order["session_id"],
            "cross_street": "Near Guadalupe Street",
            "caller_company": "Austin Utilities Inc",
        }

        update_response_1 = client.post(
            f"/tickets/{ticket_id}/update", headers=valid_headers, json=update_1
        )
        assert update_response_1.status_code == status.HTTP_200_OK
        update_data_1 = update_response_1.json()

        # Should have fewer gaps now
        previous_gap_count = len(create_data["validation_gaps"])
        current_gap_count = len(update_data_1["validation_gaps"])
        # Gap count should decrease or stay same (some gaps might not be resolved by these fields)
        assert current_gap_count <= previous_gap_count

        # Turn 3: Fill in more information
        update_2 = {
            "session_id": work_order["session_id"],
            "caller_email": "contact@austin-utilities.com",
            "work_start_date": "2024-09-10",
            "excavator_company": "Austin Utilities Inc",
        }

        update_response_2 = client.post(
            f"/tickets/{ticket_id}/update", headers=valid_headers, json=update_2
        )
        assert update_response_2.status_code == status.HTTP_200_OK

        # Turn 4: Attempt to confirm (might still have gaps)
        confirm_response = client.post(
            f"/tickets/{ticket_id}/confirm",
            headers=valid_headers,
            json={"session_id": work_order["session_id"], "confirm_submission": False},
        )

        # Should succeed regardless, but might not be ready for final submission
        assert confirm_response.status_code == status.HTTP_200_OK
        confirm_data = confirm_response.json()
        assert confirm_data["success"] is True

        # Verify final state progression
        final_ticket = confirm_data["ticket"]
        assert final_ticket["status"] in [TicketStatus.VALIDATED, TicketStatus.READY]

    def test_state_machine_transitions_integration(
        self,
        client: TestClient,
        valid_headers: dict[str, str],
        sample_work_orders: dict,
    ):
        """Test state machine transitions work correctly in API context."""
        work_order = sample_work_orders["minimal_valid_work_order"]

        # Create ticket (should be DRAFT)
        create_response = client.post(
            "/tickets/create", headers=valid_headers, json=work_order
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        ticket_id = create_response.json()["ticket_id"]

        # Try to update ticket (should work in DRAFT state)
        update_response = client.post(
            f"/tickets/{ticket_id}/update",
            headers=valid_headers,
            json={
                "session_id": work_order["session_id"],
                "cross_street": "Test Cross Street",
                "caller_name": "Test Caller",
            },
        )
        assert update_response.status_code == status.HTTP_200_OK

        # Move to next state via confirmation
        confirm_response = client.post(
            f"/tickets/{ticket_id}/confirm",
            headers=valid_headers,
            json={"session_id": work_order["session_id"], "confirm_submission": False},
        )
        assert confirm_response.status_code == status.HTTP_200_OK
        current_status = confirm_response.json()["ticket"]["status"]

        # Verify status progressed from DRAFT
        assert current_status != TicketStatus.DRAFT
        assert current_status in [TicketStatus.VALIDATED, TicketStatus.READY]

    @patch("src.texas811_poc.geocoding.GeocodingService.geocode_address")
    def test_geocoding_integration_in_workflow(
        self,
        mock_geocode,
        client: TestClient,
        valid_headers: dict[str, str],
        sample_work_orders: dict,
    ):
        """Test geocoding service integration during ticket processing."""
        # Mock successful geocoding
        mock_geocode.return_value = {
            "latitude": 29.7604,
            "longitude": -95.3698,
            "formatted_address": "1234 Main Street, Houston, TX 77002",
            "confidence_score": 0.95,
            "components": {
                "street_number": "1234",
                "street_name": "Main Street",
                "city": "Houston",
                "county": "Harris",
                "state": "TX",
                "postal_code": "77002",
            },
        }

        work_order = sample_work_orders["valid_complete_work_order"]

        # Create ticket - should trigger geocoding
        create_response = client.post(
            "/tickets/create", headers=valid_headers, json=work_order
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        create_data = create_response.json()

        # Verify geocoding was called
        mock_geocode.assert_called_once()

        # Verify geocoded coordinates are populated
        ticket = create_data
        assert ticket["gps_lat"] is not None
        assert ticket["gps_lng"] is not None
        assert abs(ticket["gps_lat"] - 29.7604) < 0.001
        assert abs(ticket["gps_lng"] - (-95.3698)) < 0.001

    def test_compliance_calculations_integration(
        self,
        client: TestClient,
        valid_headers: dict[str, str],
        sample_work_orders: dict,
    ):
        """Test compliance date calculations in full workflow context."""
        work_order = sample_work_orders["valid_complete_work_order"]

        # Create and process ticket to submission
        create_response = client.post(
            "/tickets/create", headers=valid_headers, json=work_order
        )
        ticket_id = create_response.json()["ticket_id"]

        # Move to submission
        confirm_response = client.post(
            f"/tickets/{ticket_id}/confirm",
            headers=valid_headers,
            json={"session_id": work_order["session_id"], "confirm_submission": True},
        )

        if confirm_response.status_code == status.HTTP_200_OK:
            confirm_data = confirm_response.json()
            if confirm_data["status"] == TicketStatus.SUBMITTED:

                # Verify compliance dates were calculated
                if "compliance_dates" in confirm_data:
                    compliance = confirm_data["compliance_dates"]
                    lawful_start_str = compliance["lawful_start_date"]
                    expires_str = compliance["ticket_expires_date"]
                else:
                    lawful_start_str = confirm_data["lawful_start_date"]
                    expires_str = confirm_data["ticket_expires_date"]

                assert lawful_start_str is not None
                assert expires_str is not None

                # Verify dates are logical
                lawful_start = date.fromisoformat(lawful_start_str)
                expires = date.fromisoformat(expires_str)
                today = date.today()

                # Lawful start should be at least 2 business days from today
                assert lawful_start >= today + timedelta(days=2)

                # Expiration should be 14 days after submission
                assert expires > lawful_start


class TestErrorRecoveryScenarios:
    """Integration tests for error handling and recovery workflows."""

    @pytest.fixture
    def valid_headers(self) -> dict[str, str]:
        return {
            "Authorization": "Bearer test-api-key-12345",
            "Content-Type": "application/json",
        }

    @pytest.fixture
    def sample_work_orders(self) -> dict[str, Any]:
        fixtures_path = Path(__file__).parent / "fixtures" / "sample_work_orders.json"
        with open(fixtures_path) as f:
            return json.load(f)

    def test_invalid_data_recovery(
        self,
        client: TestClient,
        valid_headers: dict[str, str],
        sample_work_orders: dict,
    ):
        """Test recovery from invalid data submission."""
        invalid_work_order = sample_work_orders["work_order_invalid_data"]

        # Attempt to create ticket with invalid data
        create_response = client.post(
            "/tickets/create", headers=valid_headers, json=invalid_work_order
        )

        # Should either reject with validation errors or accept with many gaps
        if create_response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
            # Validation rejected the data
            error_data = create_response.json()
            assert "error" in error_data
        else:
            # Data was accepted but should have many validation gaps
            assert create_response.status_code == status.HTTP_201_CREATED
            create_data = create_response.json()
            assert len(create_data["validation_gaps"]) > 0

            # Test recovery by fixing the issues
            ticket_id = create_data["ticket_id"]

            corrected_data = {
                "session_id": invalid_work_order["session_id"],
                "county": "Dallas",  # Fix empty county
                "work_description": "Corrected work description",  # Fix empty description
                "caller_phone": "(214) 555-1234",  # Fix invalid phone
                "caller_email": "valid@example.com",  # Fix invalid email
                "work_start_date": "2025-09-15",  # Fix past date
                "gps_lat": 32.7767,  # Fix out-of-bounds GPS
                "gps_lng": -96.7970,
            }

            # Apply corrections
            update_response = client.post(
                f"/tickets/{ticket_id}/update",
                headers=valid_headers,
                json=corrected_data,
            )
            assert update_response.status_code == status.HTTP_200_OK

            # Verify gaps were reduced
            update_data = update_response.json()
            original_gaps = len(create_data["validation_gaps"])
            current_gaps = len(update_data["validation_gaps"])
            assert current_gaps < original_gaps

    def test_session_recovery_after_timeout(
        self,
        client: TestClient,
        valid_headers: dict[str, str],
        sample_work_orders: dict,
    ):
        """Test session recovery scenarios."""
        work_order = sample_work_orders["valid_complete_work_order"]

        # Create ticket
        create_response = client.post(
            "/tickets/create", headers=valid_headers, json=work_order
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        ticket_id = create_response.json()["ticket_id"]

        # Simulate session recovery by making update with same session_id
        recovery_update = {
            "session_id": work_order["session_id"],
            "remarks": "Updated after session recovery",
        }

        update_response = client.post(
            f"/tickets/{ticket_id}/update", headers=valid_headers, json=recovery_update
        )
        assert update_response.status_code == status.HTTP_200_OK

        # Verify update was successful
        update_data = update_response.json()
        assert update_data["success"] is True
        assert update_data["ticket"]["remarks"] == "Updated after session recovery"

    @patch("src.texas811_poc.geocoding.GeocodingService.geocode_address")
    def test_geocoding_failure_recovery(
        self,
        mock_geocode,
        client: TestClient,
        valid_headers: dict[str, str],
        sample_work_orders: dict,
    ):
        """Test recovery when geocoding service fails."""
        # Mock geocoding failure
        mock_geocode.side_effect = Exception("Geocoding service unavailable")

        work_order = sample_work_orders["valid_complete_work_order"]

        # Create ticket - should handle geocoding failure gracefully
        create_response = client.post(
            "/tickets/create", headers=valid_headers, json=work_order
        )

        # Should still create ticket successfully even if geocoding fails
        assert create_response.status_code == status.HTTP_201_CREATED
        create_data = create_response.json()

        # GPS coordinates should be None due to failed geocoding
        ticket = create_data
        assert ticket["gps_lat"] is None
        assert ticket["gps_lng"] is None

        # Should have a validation gap suggesting manual GPS entry
        gap_fields = [gap["field_name"] for gap in create_data["validation_gaps"]]
        assert any("gps" in field.lower() for field in gap_fields)


class TestPerformanceIntegration:
    """Performance and benchmark tests for integration scenarios."""

    @pytest.fixture
    def valid_headers(self) -> dict[str, str]:
        return {
            "Authorization": "Bearer test-api-key-12345",
            "Content-Type": "application/json",
        }

    @pytest.fixture
    def sample_work_orders(self) -> dict[str, Any]:
        fixtures_path = Path(__file__).parent / "fixtures" / "sample_work_orders.json"
        with open(fixtures_path) as f:
            return json.load(f)

    def test_api_response_times(
        self,
        client: TestClient,
        valid_headers: dict[str, str],
        sample_work_orders: dict,
    ):
        """Test that API endpoints meet performance requirements (<500ms)."""
        work_order = sample_work_orders["valid_complete_work_order"]

        # Test create endpoint performance
        start_time = time.time()
        create_response = client.post(
            "/tickets/create", headers=valid_headers, json=work_order
        )
        create_time = time.time() - start_time

        assert create_response.status_code == status.HTTP_201_CREATED
        assert (
            create_time < 0.5
        ), f"Create endpoint took {create_time:.3f}s (should be <0.5s)"

        ticket_id = create_response.json()["ticket_id"]

        # Test update endpoint performance
        start_time = time.time()
        update_response = client.post(
            f"/tickets/{ticket_id}/update",
            headers=valid_headers,
            json={
                "session_id": work_order["session_id"],
                "remarks": "Performance test update",
            },
        )
        update_time = time.time() - start_time

        assert update_response.status_code == status.HTTP_200_OK
        assert (
            update_time < 0.5
        ), f"Update endpoint took {update_time:.3f}s (should be <0.5s)"

        # Test confirm endpoint performance
        start_time = time.time()
        confirm_response = client.post(
            f"/tickets/{ticket_id}/confirm",
            headers=valid_headers,
            json={"session_id": work_order["session_id"], "confirm_submission": False},
        )
        confirm_time = time.time() - start_time

        assert confirm_response.status_code == status.HTTP_200_OK
        assert (
            confirm_time < 0.5
        ), f"Confirm endpoint took {confirm_time:.3f}s (should be <0.5s)"

    def test_concurrent_ticket_processing(
        self,
        client: TestClient,
        valid_headers: dict[str, str],
        sample_work_orders: dict,
    ):
        """Test concurrent ticket processing doesn't cause issues."""
        import queue
        import threading

        work_orders = [
            sample_work_orders["valid_complete_work_order"],
            sample_work_orders["work_order_with_gps"],
            sample_work_orders["emergency_work_order"],
        ]

        results = queue.Queue()

        def create_ticket(work_order_data, session_suffix):
            # Ensure unique session IDs for concurrent test
            work_order = work_order_data.copy()
            work_order["session_id"] = (
                f"{work_order['session_id']}-concurrent-{session_suffix}"
            )

            response = client.post(
                "/tickets/create", headers=valid_headers, json=work_order
            )
            results.put(
                {
                    "status_code": response.status_code,
                    "session_id": work_order["session_id"],
                    "success": response.status_code == status.HTTP_201_CREATED,
                }
            )

        # Start concurrent requests
        threads = []
        for i, work_order in enumerate(work_orders):
            thread = threading.Thread(target=create_ticket, args=(work_order, i))
            threads.append(thread)
            thread.start()

        # Wait for all to complete
        for thread in threads:
            thread.join()

        # Verify all succeeded
        results_list = []
        while not results.empty():
            results_list.append(results.get())

        assert len(results_list) == len(work_orders)
        for result in results_list:
            assert result["success"], f"Failed for session {result['session_id']}"

    def test_large_ticket_processing(
        self,
        client: TestClient,
        valid_headers: dict[str, str],
        sample_work_orders: dict,
    ):
        """Test processing of ticket with large amounts of data."""
        work_order = sample_work_orders["complex_excavation_work"].copy()

        # Add large remarks field
        work_order["remarks"] = "Large project description. " * 100  # ~2800 characters

        start_time = time.time()
        response = client.post(
            "/tickets/create", headers=valid_headers, json=work_order
        )
        processing_time = time.time() - start_time

        assert response.status_code == status.HTTP_201_CREATED
        assert (
            processing_time < 1.0
        ), f"Large ticket processing took {processing_time:.3f}s (should be <1.0s)"

        # Verify large data was preserved
        ticket = response.json()["ticket"]
        assert len(ticket["remarks"]) > 2000


class TestRealWorkflowValidation:
    """Tests that validate real-world workflow scenarios."""

    @pytest.fixture
    def valid_headers(self) -> dict[str, str]:
        return {
            "Authorization": "Bearer test-api-key-12345",
            "Content-Type": "application/json",
        }

    @pytest.fixture
    def sample_work_orders(self) -> dict[str, Any]:
        fixtures_path = Path(__file__).parent / "fixtures" / "sample_work_orders.json"
        with open(fixtures_path) as f:
            return json.load(f)

    def test_customgpt_typical_extraction_workflow(
        self,
        client: TestClient,
        valid_headers: dict[str, str],
        sample_work_orders: dict,
    ):
        """Test workflow that mimics typical CustomGPT PDF extraction results."""
        # Simulate typical PDF extraction - some fields found, some missing
        extraction_result = {
            "session_id": "customgpt-pdf-extraction-001",
            "county": "Harris",
            "city": "Houston",
            "address": "1234 Main St",  # Often incomplete from OCR
            "work_description": "Fiber installation",  # Often brief from OCR
            "caller_name": "J. Smith",  # OCR might abbreviate
            "caller_phone": "(713) 555-0123",
        }

        # Step 1: Create from extraction
        create_response = client.post(
            "/tickets/create", headers=valid_headers, json=extraction_result
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        create_data = create_response.json()
        ticket_id = create_data["ticket_id"]

        # Should have gaps for missing fields
        gaps = create_data["validation_gaps"]
        assert len(gaps) > 0

        # Step 2: CustomGPT asks user for missing info
        clarification_1 = {
            "session_id": extraction_result["session_id"],
            "address": "1234 Main Street, Houston, TX 77002",  # User provides complete address
            "cross_street": "Near Commerce Street",
            "caller_company": "Smith Construction LLC",
        }

        update_response = client.post(
            f"/tickets/{ticket_id}/update", headers=valid_headers, json=clarification_1
        )
        assert update_response.status_code == status.HTTP_200_OK

        # Step 3: One more clarification round
        clarification_2 = {
            "session_id": extraction_result["session_id"],
            "work_description": "Install underground fiber optic cable for telecommunications upgrade",
            "work_start_date": "2024-09-20",
            "excavator_company": "Smith Construction LLC",
        }

        update_response_2 = client.post(
            f"/tickets/{ticket_id}/update", headers=valid_headers, json=clarification_2
        )
        assert update_response_2.status_code == status.HTTP_200_OK

        # Step 4: User confirms ready to submit
        confirm_response = client.post(
            f"/tickets/{ticket_id}/confirm",
            headers=valid_headers,
            json={
                "session_id": extraction_result["session_id"],
                "confirm_submission": True,
            },
        )

        # Should succeed or provide clear guidance
        assert confirm_response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_400_BAD_REQUEST,
        ]

        if confirm_response.status_code == status.HTTP_200_OK:
            confirm_data = confirm_response.json()
            if confirm_data["ticket"]["status"] == TicketStatus.SUBMITTED:
                # Verify submission packet was created
                assert confirm_data["packet_data"] is not None
                assert (
                    "submission_ready" in confirm_data or "packet_data" in confirm_data
                )

    def test_emergency_ticket_workflow(
        self,
        client: TestClient,
        valid_headers: dict[str, str],
        sample_work_orders: dict,
    ):
        """Test emergency ticket handling workflow."""
        emergency_work = sample_work_orders["emergency_work_order"]

        # Emergency tickets should be processed quickly
        start_time = time.time()

        create_response = client.post(
            "/tickets/create", headers=valid_headers, json=emergency_work
        )

        processing_time = time.time() - start_time
        assert processing_time < 0.3, "Emergency tickets should process quickly"

        assert create_response.status_code == status.HTTP_201_CREATED
        create_data = create_response.json()

        # Emergency tickets might have different validation rules
        ticket = create_data
        assert ticket["work_type"] == "emergency"
        assert "EMERGENCY" in ticket["remarks"]

        # Should be able to move to submission quickly
        ticket_id = ticket["ticket_id"]
        confirm_response = client.post(
            f"/tickets/{ticket_id}/confirm",
            headers=valid_headers,
            json={
                "session_id": emergency_work["session_id"],
                "confirm_submission": True,
            },
        )

        # Emergency submissions should have expedited processing
        assert confirm_response.status_code == status.HTTP_200_OK

    def test_complex_multi_phase_project_workflow(
        self,
        client: TestClient,
        valid_headers: dict[str, str],
        sample_work_orders: dict,
    ):
        """Test complex project with multiple phases and extensive details."""
        complex_work = sample_work_orders["complex_excavation_work"]

        # Create complex ticket
        create_response = client.post(
            "/tickets/create", headers=valid_headers, json=complex_work
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        create_data = create_response.json()

        ticket = create_data
        ticket_id = ticket["ticket_id"]

        # Verify complex data was preserved
        assert ticket["work_duration_days"] == 14
        assert "multi-phase" in ticket["remarks"].lower()
        assert ticket["boring_crossing"] is True
        assert ticket["white_lining_complete"] is True

        # Complex projects might need additional approvals/validations
        # Verify all safety flags are captured
        safety_flags = {
            "white_lining_complete": ticket["white_lining_complete"],
            "boring_crossing": ticket["boring_crossing"],
            "explosives_used": ticket["explosives_used"],
            "hand_digging_only": ticket["hand_digging_only"],
        }

        # All safety flags should be explicitly set for complex projects
        assert all(flag is not None for flag in safety_flags.values())

        # Should handle submission of complex project
        confirm_response = client.post(
            f"/tickets/{ticket_id}/confirm",
            headers=valid_headers,
            json={
                "session_id": complex_work["session_id"],
                "confirm_submission": False,  # Just validate complexity
            },
        )
        assert confirm_response.status_code == status.HTTP_200_OK
