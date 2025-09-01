"""
Tests for JSON file storage with atomic writes and backups.

Following TDD approach for Task 2.3: JSON File Storage Implementation.
"""

import json
import shutil
import tempfile
from datetime import UTC, date, datetime
from pathlib import Path
from unittest.mock import patch

import pytest
from texas811_poc.models import (
    AuditAction,
    AuditEventModel,
    TicketModel,
    TicketStatus,
)
from texas811_poc.storage import (
    AuditStorage,
    BackupManager,
    JSONStorage,
    StorageError,
    TicketStorage,
)


class TestJSONStorage:
    """Tests for the base JSONStorage class."""

    def setup_method(self):
        """Set up test environment with temporary directory."""
        self.temp_dir = tempfile.mkdtemp()
        self.storage = JSONStorage(base_path=Path(self.temp_dir))

    def teardown_method(self):
        """Clean up temporary directory."""
        shutil.rmtree(self.temp_dir)

    def test_json_storage_init(self):
        """Test JSON storage initialization."""
        assert self.storage.base_path == Path(self.temp_dir)
        assert self.storage.base_path.exists()

    def test_save_json_atomic_write(self):
        """Test atomic write ensures file consistency."""
        test_data = {"key": "value", "number": 42}
        file_path = Path(self.temp_dir) / "test.json"

        # Save data
        self.storage.save_json(test_data, file_path)

        # Verify file exists and contains correct data
        assert file_path.exists()
        with open(file_path) as f:
            loaded_data = json.load(f)
        assert loaded_data == test_data

    def test_save_json_creates_directories(self):
        """Test that save_json creates parent directories."""
        test_data = {"nested": "data"}
        file_path = Path(self.temp_dir) / "nested" / "deep" / "test.json"

        self.storage.save_json(test_data, file_path)

        assert file_path.exists()
        assert file_path.parent.exists()

    def test_save_json_backup_creation(self):
        """Test that backup is created when overwriting existing file."""
        test_data_1 = {"version": 1}
        test_data_2 = {"version": 2}
        file_path = Path(self.temp_dir) / "test.json"
        backup_path = file_path.with_suffix(".json.bak")

        # Save initial data
        self.storage.save_json(test_data_1, file_path)

        # Save new data (should create backup)
        self.storage.save_json(test_data_2, file_path, create_backup=True)

        # Verify current file has new data
        with open(file_path) as f:
            current_data = json.load(f)
        assert current_data == test_data_2

        # Verify backup has old data
        assert backup_path.exists()
        with open(backup_path) as f:
            backup_data = json.load(f)
        assert backup_data == test_data_1

    def test_load_json_file_exists(self):
        """Test loading existing JSON file."""
        test_data = {"test": "value"}
        file_path = Path(self.temp_dir) / "test.json"

        # Create file
        with open(file_path, "w") as f:
            json.dump(test_data, f)

        # Load and verify
        loaded_data = self.storage.load_json(file_path)
        assert loaded_data == test_data

    def test_load_json_file_missing(self):
        """Test loading non-existent JSON file returns None."""
        file_path = Path(self.temp_dir) / "missing.json"
        loaded_data = self.storage.load_json(file_path)
        assert loaded_data is None

    def test_save_json_invalid_data(self):
        """Test that save_json handles non-serializable data gracefully."""
        # Non-serializable object (set is not JSON serializable)
        test_data = {"set": {1, 2, 3}}
        file_path = Path(self.temp_dir) / "test.json"

        with pytest.raises(StorageError):
            self.storage.save_json(test_data, file_path)

    def test_save_json_permission_error(self):
        """Test handling of permission errors."""
        test_data = {"test": "value"}

        # Try to save to read-only directory (simulated)
        with patch("builtins.open", side_effect=PermissionError("Permission denied")):
            file_path = Path(self.temp_dir) / "test.json"
            with pytest.raises(StorageError) as exc_info:
                self.storage.save_json(test_data, file_path)
            assert "Permission denied" in str(exc_info.value)


class TestTicketStorage:
    """Tests for ticket-specific storage operations."""

    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.storage = TicketStorage(base_path=Path(self.temp_dir))

    def teardown_method(self):
        """Clean up temporary directory."""
        shutil.rmtree(self.temp_dir)

    def test_save_ticket(self):
        """Test saving a ticket to storage."""
        ticket = TicketModel(
            session_id="test_session",
            county="Harris",
            city="Houston",
            address="123 Main St",
            work_description="Test work",
        )

        self.storage.save_ticket(ticket)

        # Verify file was created
        ticket_file = self.storage.get_ticket_file_path(ticket.ticket_id)
        assert ticket_file.exists()

        # Verify content
        with open(ticket_file) as f:
            saved_data = json.load(f)
        assert saved_data["ticket_id"] == ticket.ticket_id
        assert saved_data["county"] == "Harris"

    def test_load_ticket(self):
        """Test loading a ticket from storage."""
        ticket = TicketModel(
            session_id="test_session",
            county="Travis",
            city="Austin",
            address="456 Congress Ave",
            work_description="Install fiber",
        )

        # Save ticket
        self.storage.save_ticket(ticket)

        # Load ticket
        loaded_ticket = self.storage.load_ticket(ticket.ticket_id)

        assert loaded_ticket is not None
        assert loaded_ticket.ticket_id == ticket.ticket_id
        assert loaded_ticket.county == "Travis"
        assert loaded_ticket.city == "Austin"

    def test_load_ticket_missing(self):
        """Test loading non-existent ticket returns None."""
        loaded_ticket = self.storage.load_ticket("nonexistent_id")
        assert loaded_ticket is None

    def test_list_tickets_empty(self):
        """Test listing tickets when none exist."""
        tickets = self.storage.list_tickets()
        assert tickets == []

    def test_list_tickets_multiple(self):
        """Test listing multiple tickets."""
        # Create multiple tickets
        tickets = []
        for i in range(3):
            ticket = TicketModel(
                session_id=f"session_{i}",
                county="Dallas",
                city="Dallas",
                address=f"{100+i} Test St",
                work_description=f"Work {i}",
            )
            tickets.append(ticket)
            self.storage.save_ticket(ticket)

        # List tickets
        loaded_tickets = self.storage.list_tickets()

        assert len(loaded_tickets) == 3
        ticket_ids = [t.ticket_id for t in loaded_tickets]
        for original_ticket in tickets:
            assert original_ticket.ticket_id in ticket_ids

    def test_delete_ticket(self):
        """Test deleting a ticket from storage."""
        ticket = TicketModel(
            session_id="test_session",
            county="Collin",
            city="Plano",
            address="789 Test Dr",
            work_description="Delete test",
        )

        # Save ticket
        self.storage.save_ticket(ticket)
        ticket_file = self.storage.get_ticket_file_path(ticket.ticket_id)
        assert ticket_file.exists()

        # Delete ticket
        result = self.storage.delete_ticket(ticket.ticket_id)

        assert result is True
        assert not ticket_file.exists()

    def test_delete_ticket_missing(self):
        """Test deleting non-existent ticket."""
        result = self.storage.delete_ticket("nonexistent_id")
        assert result is False

    def test_get_ticket_file_path(self):
        """Test ticket file path generation."""
        ticket_id = "test-ticket-123"
        expected_path = Path(self.temp_dir) / "tickets" / f"{ticket_id}.json"

        actual_path = self.storage.get_ticket_file_path(ticket_id)

        assert actual_path == expected_path

    def test_search_tickets_by_status(self):
        """Test searching tickets by status."""
        # Create tickets with different statuses
        draft_ticket = TicketModel(
            session_id="session_draft",
            county="Harris",
            city="Houston",
            address="123 Draft St",
            work_description="Draft work",
            status=TicketStatus.DRAFT,
        )

        ready_ticket = TicketModel(
            session_id="session_ready",
            county="Harris",
            city="Houston",
            address="456 Ready St",
            work_description="Ready work",
            status=TicketStatus.READY,
        )

        self.storage.save_ticket(draft_ticket)
        self.storage.save_ticket(ready_ticket)

        # Search by status
        draft_tickets = self.storage.search_tickets(status=TicketStatus.DRAFT)
        ready_tickets = self.storage.search_tickets(status=TicketStatus.READY)

        assert len(draft_tickets) == 1
        assert draft_tickets[0].ticket_id == draft_ticket.ticket_id

        assert len(ready_tickets) == 1
        assert ready_tickets[0].ticket_id == ready_ticket.ticket_id

    def test_search_tickets_by_session_id(self):
        """Test searching tickets by session ID."""
        session_id = "session_123"

        # Create tickets with same session
        for i in range(2):
            ticket = TicketModel(
                session_id=session_id,
                county="Travis",
                city="Austin",
                address=f"{200+i} Session St",
                work_description=f"Session work {i}",
            )
            self.storage.save_ticket(ticket)

        # Create ticket with different session
        other_ticket = TicketModel(
            session_id="other_session",
            county="Travis",
            city="Austin",
            address="999 Other St",
            work_description="Other work",
        )
        self.storage.save_ticket(other_ticket)

        # Search by session
        session_tickets = self.storage.search_tickets(session_id=session_id)

        assert len(session_tickets) == 2
        for ticket in session_tickets:
            assert ticket.session_id == session_id


class TestAuditStorage:
    """Tests for audit event storage operations."""

    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.storage = AuditStorage(base_path=Path(self.temp_dir))

    def teardown_method(self):
        """Clean up temporary directory."""
        shutil.rmtree(self.temp_dir)

    def test_save_audit_event(self):
        """Test saving audit event to storage."""
        event = AuditEventModel(
            ticket_id="ticket_123",
            action=AuditAction.TICKET_CREATED,
            user_id="user_456",
            details={"test": "data"},
        )

        self.storage.save_audit_event(event)

        # Verify daily audit file was created
        today = datetime.now(UTC).date()
        audit_file = self.storage.get_daily_audit_file(today)
        assert audit_file.exists()

    def test_get_audit_events_by_ticket(self):
        """Test retrieving audit events for specific ticket."""
        ticket_id = "ticket_123"

        # Create multiple events for ticket
        events = [
            AuditEventModel(
                ticket_id=ticket_id, action=AuditAction.TICKET_CREATED, user_id="user_1"
            ),
            AuditEventModel(
                ticket_id=ticket_id, action=AuditAction.FIELD_UPDATED, user_id="user_2"
            ),
            AuditEventModel(
                ticket_id="other_ticket",
                action=AuditAction.TICKET_CREATED,
                user_id="user_3",
            ),
        ]

        for event in events:
            self.storage.save_audit_event(event)

        # Get events for specific ticket
        ticket_events = self.storage.get_audit_events(ticket_id=ticket_id)

        assert len(ticket_events) == 2
        for event in ticket_events:
            assert event.ticket_id == ticket_id

    def test_get_daily_audit_file(self):
        """Test daily audit file path generation."""
        test_date = date(2025, 9, 1)
        expected_path = Path(self.temp_dir) / "audit" / "2025-09-01.json"

        actual_path = self.storage.get_daily_audit_file(test_date)

        assert actual_path == expected_path


class TestBackupManager:
    """Tests for backup management functionality."""

    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.backup_manager = BackupManager(base_path=Path(self.temp_dir))

    def teardown_method(self):
        """Clean up temporary directory."""
        shutil.rmtree(self.temp_dir)

    def test_create_backup(self):
        """Test creating backup of file."""
        # Create original file
        original_file = Path(self.temp_dir) / "test.json"
        test_data = {"version": 1}
        with open(original_file, "w") as f:
            json.dump(test_data, f)

        # Create backup
        backup_path = self.backup_manager.create_backup(original_file)

        assert backup_path.exists()
        with open(backup_path) as f:
            backup_data = json.load(f)
        assert backup_data == test_data

    def test_restore_from_backup(self):
        """Test restoring file from backup."""
        original_file = Path(self.temp_dir) / "test.json"
        original_data = {"version": 1}
        modified_data = {"version": 2}

        # Create original file and backup
        with open(original_file, "w") as f:
            json.dump(original_data, f)
        backup_path = self.backup_manager.create_backup(original_file)

        # Modify original file
        with open(original_file, "w") as f:
            json.dump(modified_data, f)

        # Restore from backup
        self.backup_manager.restore_from_backup(backup_path, original_file)

        # Verify restoration
        with open(original_file) as f:
            restored_data = json.load(f)
        assert restored_data == original_data

    def test_cleanup_old_backups(self):
        """Test cleanup of old backup files."""
        # This test would create multiple backup files with different
        # timestamps and verify that old ones are cleaned up
        # Implementation would depend on backup retention policy
        pass


class TestStorageIntegration:
    """Integration tests for storage components working together."""

    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.ticket_storage = TicketStorage(base_path=Path(self.temp_dir))
        self.audit_storage = AuditStorage(base_path=Path(self.temp_dir))

    def teardown_method(self):
        """Clean up temporary directory."""
        shutil.rmtree(self.temp_dir)

    def test_ticket_lifecycle_with_audit(self):
        """Test complete ticket lifecycle with audit trail."""
        # Create ticket
        ticket = TicketModel(
            session_id="integration_session",
            county="Fort Bend",
            city="Sugar Land",
            address="123 Integration St",
            work_description="Integration test work",
        )

        # Save ticket and log creation
        self.ticket_storage.save_ticket(ticket)

        creation_event = AuditEventModel(
            ticket_id=ticket.ticket_id,
            action=AuditAction.TICKET_CREATED,
            user_id="integration_test",
            details={"initial_status": ticket.status.value},
        )
        self.audit_storage.save_audit_event(creation_event)

        # Update ticket status
        ticket.status = TicketStatus.VALIDATED
        self.ticket_storage.save_ticket(ticket, create_backup=True)

        # Log status change
        status_event = AuditEventModel(
            ticket_id=ticket.ticket_id,
            action=AuditAction.STATUS_CHANGED,
            user_id="integration_test",
            details={"old_status": "draft", "new_status": "validated"},
        )
        self.audit_storage.save_audit_event(status_event)

        # Verify ticket was saved with correct status
        loaded_ticket = self.ticket_storage.load_ticket(ticket.ticket_id)
        assert loaded_ticket.status == TicketStatus.VALIDATED

        # Verify audit trail
        audit_events = self.audit_storage.get_audit_events(ticket_id=ticket.ticket_id)
        assert len(audit_events) == 2

        actions = [event.action for event in audit_events]
        assert AuditAction.TICKET_CREATED in actions
        assert AuditAction.STATUS_CHANGED in actions
