"""
Tests for data migration utilities and schema changes.

Following TDD approach for Task 2.6: Data Migration Utilities.
"""

import json
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path

import pytest

from texas811_poc.migrations import (
    DataMigrator,
    MigrationManager,
    SchemaVersion,
)
from texas811_poc.models import AuditAction, TicketModel
from texas811_poc.storage import AuditStorage, TicketStorage


class TestSchemaVersion:
    """Tests for schema versioning."""

    def test_schema_version_creation(self):
        """Test creating schema version."""
        version = SchemaVersion(major=1, minor=2, patch=3)

        assert version.major == 1
        assert version.minor == 2
        assert version.patch == 3
        assert str(version) == "1.2.3"

    def test_schema_version_comparison(self):
        """Test schema version comparison."""
        v1_0_0 = SchemaVersion(1, 0, 0)
        v1_1_0 = SchemaVersion(1, 1, 0)
        v2_0_0 = SchemaVersion(2, 0, 0)

        assert v1_0_0 < v1_1_0
        assert v1_1_0 < v2_0_0
        assert v2_0_0 > v1_0_0
        assert v1_0_0 == SchemaVersion(1, 0, 0)

    def test_schema_version_from_string(self):
        """Test parsing schema version from string."""
        version = SchemaVersion.from_string("2.1.5")

        assert version.major == 2
        assert version.minor == 1
        assert version.patch == 5

    def test_schema_version_invalid_string(self):
        """Test invalid version string raises error."""
        with pytest.raises(ValueError):
            SchemaVersion.from_string("invalid.version")

        with pytest.raises(ValueError):
            SchemaVersion.from_string("1.2")  # Missing patch


class TestMigrationManager:
    """Tests for migration management."""

    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.manager = MigrationManager(base_path=Path(self.temp_dir))

    def teardown_method(self):
        """Clean up temporary directory."""
        shutil.rmtree(self.temp_dir)

    def test_migration_manager_init(self):
        """Test migration manager initialization."""
        assert self.manager.base_path == Path(self.temp_dir)
        assert self.manager.migrations_dir.exists()

    def test_get_current_schema_version_fresh(self):
        """Test getting schema version from fresh installation."""
        version = self.manager.get_current_schema_version()

        # Should default to 1.0.0 for fresh install
        assert version == SchemaVersion(1, 0, 0)

    def test_set_schema_version(self):
        """Test setting current schema version."""
        new_version = SchemaVersion(1, 2, 3)

        self.manager.set_schema_version(new_version)
        retrieved_version = self.manager.get_current_schema_version()

        assert retrieved_version == new_version

    def test_needs_migration(self):
        """Test checking if migration is needed."""
        current = SchemaVersion(1, 0, 0)
        target = SchemaVersion(1, 1, 0)

        self.manager.set_schema_version(current)

        assert self.manager.needs_migration(target) is True
        assert self.manager.needs_migration(current) is False

    def test_list_available_migrations(self):
        """Test listing available migration scripts."""
        # Create mock migration files
        migration_files = [
            "001_initial_schema.py",
            "002_add_geometry_field.py",
            "003_audit_improvements.py",
        ]

        for filename in migration_files:
            (self.manager.migrations_dir / filename).touch()

        migrations = self.manager.list_available_migrations()

        assert len(migrations) == 3
        assert all(name in str(migrations) for name in migration_files)

    def test_create_backup_before_migration(self):
        """Test that backup is created before migration."""
        # Create some test data files
        tickets_dir = Path(self.temp_dir) / "tickets"
        tickets_dir.mkdir()

        test_file = tickets_dir / "test_ticket.json"
        test_data = {"ticket_id": "test", "county": "Test"}
        with open(test_file, "w") as f:
            json.dump(test_data, f)

        # Create backup
        backup_path = self.manager.create_pre_migration_backup()

        assert backup_path.exists()
        assert backup_path.is_dir()

        # Verify backup contains the data
        backup_tickets_dir = backup_path / "tickets"
        backup_file = backup_tickets_dir / "test_ticket.json"
        assert backup_file.exists()


class TestDataMigrator:
    """Tests for data migration operations."""

    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.migrator = DataMigrator(base_path=Path(self.temp_dir))

        # Create storage instances
        self.ticket_storage = TicketStorage(Path(self.temp_dir))
        self.audit_storage = AuditStorage(Path(self.temp_dir))

    def teardown_method(self):
        """Clean up temporary directory."""
        shutil.rmtree(self.temp_dir)

    def test_migrate_ticket_add_field(self):
        """Test adding new field to ticket data."""
        # Create old format ticket (missing some field)
        old_ticket_data = {
            "ticket_id": "old_ticket_123",
            "session_id": "session_old",
            "county": "Harris",
            "city": "Houston",
            "address": "123 Old St",
            "work_description": "Old work description",
            "status": "draft",
            "created_at": "2025-01-01T12:00:00Z",
            "updated_at": "2025-01-01T12:00:00Z",
            # Missing new fields that might be added in schema update
        }

        # Save old format ticket directly to file
        ticket_file = self.ticket_storage.get_ticket_file_path("old_ticket_123")
        with open(ticket_file, "w") as f:
            json.dump(old_ticket_data, f)

        # Perform migration (add default values for missing fields)
        self.migrator.migrate_tickets_add_defaults()

        # Load and verify ticket can be parsed with new schema
        migrated_ticket = self.ticket_storage.load_ticket("old_ticket_123")

        assert migrated_ticket is not None
        assert migrated_ticket.ticket_id == "old_ticket_123"
        assert migrated_ticket.county == "Harris"
        # New fields should have default values
        assert migrated_ticket.validation_gaps == []  # Default empty list

    def test_migrate_audit_events_format(self):
        """Test migrating audit events to new format."""
        # Create old format audit event
        old_event_data = {
            "event_id": "old_event_123",
            "ticket_id": "ticket_456",
            "action": "ticket_created",
            "user_id": "user_789",
            "timestamp": "2025-01-01T12:00:00Z",
            # Missing new fields that might be added
        }

        # Save old format event to daily log
        today = datetime.now(UTC).date()
        daily_file = self.audit_storage.get_daily_audit_file(today)
        daily_log = {"date": today.isoformat(), "events": [old_event_data]}
        with open(daily_file, "w") as f:
            json.dump(daily_log, f)

        # Perform migration
        self.migrator.migrate_audit_events_add_defaults()

        # Verify migration worked
        events = self.audit_storage.get_audit_events(ticket_id="ticket_456")

        assert len(events) == 1
        event = events[0]
        assert event.event_id == "old_event_123"
        assert event.action == AuditAction.TICKET_CREATED

    def test_validate_data_integrity(self):
        """Test data integrity validation after migration."""
        # Create valid ticket
        ticket = TicketModel(
            session_id="validation_session",
            county="Travis",
            city="Austin",
            address="123 Validation St",
            work_description="Validation test",
        )
        self.ticket_storage.save_ticket(ticket)

        # Run integrity check
        issues = self.migrator.validate_data_integrity()

        # Should find no issues with valid data
        assert len(issues) == 0

    def test_validate_data_integrity_finds_issues(self):
        """Test that integrity validation finds data issues."""
        # Create invalid ticket file (corrupted JSON)
        ticket_file = self.ticket_storage.get_ticket_file_path("corrupted_ticket")
        with open(ticket_file, "w") as f:
            f.write("{ invalid json }")

        # Run integrity check
        issues = self.migrator.validate_data_integrity()

        # Should find the corrupted file
        assert len(issues) > 0
        assert any("corrupted_ticket" in issue for issue in issues)

    def test_rollback_migration(self):
        """Test rolling back a migration."""
        # Create some data
        ticket = TicketModel(
            session_id="rollback_session",
            county="Dallas",
            city="Dallas",
            address="123 Rollback St",
            work_description="Rollback test",
        )
        self.ticket_storage.save_ticket(ticket)

        # Create backup
        backup_path = Path(self.temp_dir) / "backups" / "pre_migration_20250901"
        backup_path.mkdir(parents=True)

        # Copy current data to backup
        shutil.copytree(Path(self.temp_dir) / "tickets", backup_path / "tickets")

        # Create backup manifest
        manifest = {
            "backup_name": "pre_migration_20250901",
            "created_at": "2025-09-01T12:00:00Z",
            "source_path": str(self.temp_dir),
            "schema_version": "1.0.0",
            "data_directories": ["tickets"],
        }

        with open(backup_path / "backup_manifest.json", "w") as f:
            json.dump(manifest, f)

        # Modify data (simulate migration)
        ticket.status = "modified_status"  # This would be invalid
        modified_data = {"ticket_id": ticket.ticket_id, "invalid": "data"}
        ticket_file = self.ticket_storage.get_ticket_file_path(ticket.ticket_id)
        with open(ticket_file, "w") as f:
            json.dump(modified_data, f)

        # Rollback migration
        self.migrator.rollback_from_backup(backup_path)

        # Verify rollback worked
        restored_ticket = self.ticket_storage.load_ticket(ticket.ticket_id)
        assert restored_ticket is not None
        assert restored_ticket.county == "Dallas"  # Original data restored


class TestMigrationIntegration:
    """Integration tests for complete migration workflows."""

    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.manager = MigrationManager(base_path=Path(self.temp_dir))
        self.migrator = DataMigrator(base_path=Path(self.temp_dir))

    def teardown_method(self):
        """Clean up temporary directory."""
        shutil.rmtree(self.temp_dir)

    def test_complete_migration_workflow(self):
        """Test complete migration from one schema version to another."""
        # Start with schema v1.0.0
        self.manager.set_schema_version(SchemaVersion(1, 0, 0))

        # Create some v1.0.0 format data
        ticket_storage = TicketStorage(Path(self.temp_dir))
        old_ticket = TicketModel(
            session_id="migration_test",
            county="Fort Bend",
            city="Sugar Land",
            address="123 Migration St",
            work_description="Migration test work",
        )
        ticket_storage.save_ticket(old_ticket)

        # Perform migration to v1.1.0
        target_version = SchemaVersion(1, 1, 0)

        # Check if migration is needed
        assert self.manager.needs_migration(target_version) is True

        # Create backup
        backup_path = self.manager.create_pre_migration_backup()
        assert backup_path.exists()

        # Run data migrations
        self.migrator.migrate_tickets_add_defaults()

        # Validate data integrity
        issues = self.migrator.validate_data_integrity()
        assert len(issues) == 0

        # Update schema version
        self.manager.set_schema_version(target_version)

        # Verify migration completed
        assert self.manager.get_current_schema_version() == target_version
        assert self.manager.needs_migration(target_version) is False

        # Verify data still loads correctly
        migrated_ticket = ticket_storage.load_ticket(old_ticket.ticket_id)
        assert migrated_ticket is not None
        assert migrated_ticket.county == "Fort Bend"

    def test_migration_with_rollback_on_failure(self):
        """Test migration rollback when data validation fails."""
        # Start with v1.0.0
        self.manager.set_schema_version(SchemaVersion(1, 0, 0))

        # Create backup
        backup_path = self.manager.create_pre_migration_backup()

        # Simulate migration that corrupts data
        ticket_file = Path(self.temp_dir) / "tickets" / "corrupt.json"
        ticket_file.parent.mkdir(exist_ok=True)
        with open(ticket_file, "w") as f:
            f.write("{ corrupt: json }")

        # Try to validate (should fail)
        issues = self.migrator.validate_data_integrity()

        if issues:  # If validation fails, rollback
            self.migrator.rollback_from_backup(backup_path)

            # Verify rollback
            assert not ticket_file.exists()  # Corrupted file should be gone

            # Schema version should remain unchanged
            assert self.manager.get_current_schema_version() == SchemaVersion(1, 0, 0)
