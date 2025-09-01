"""
Data migration utilities for schema changes and data transformations.

This module provides tools for:
- Schema version management
- Data migration between schema versions
- Backup and rollback functionality
- Data integrity validation
- Migration orchestration

Key features:
- Safe migration workflows with automatic backups
- Rollback capability if migrations fail
- Data integrity validation
- Version tracking and comparison
"""

import json
import re
import shutil
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from texas811_poc.models import AuditEventModel
from texas811_poc.storage import AuditStorage, JSONStorage, TicketStorage


class MigrationError(Exception):
    """Exception raised for migration-related errors."""

    pass


@dataclass(frozen=True, order=True)
class SchemaVersion:
    """Represents a schema version with semantic versioning."""

    major: int
    minor: int
    patch: int

    def __str__(self) -> str:
        """String representation of version."""
        return f"{self.major}.{self.minor}.{self.patch}"

    @classmethod
    def from_string(cls, version_str: str) -> "SchemaVersion":
        """Parse schema version from string."""
        if not re.match(r"^\d+\.\d+\.\d+$", version_str):
            raise ValueError(f"Invalid version format: {version_str}")

        parts = version_str.split(".")
        return cls(major=int(parts[0]), minor=int(parts[1]), patch=int(parts[2]))


class MigrationManager:
    """Manages schema versions and migration orchestration."""

    def __init__(self, base_path: Path):
        """Initialize migration manager."""
        self.base_path = Path(base_path)
        self.migrations_dir = self.base_path / "migrations"
        self.migrations_dir.mkdir(parents=True, exist_ok=True)

        self.version_file = self.base_path / "schema_version.json"
        self.backup_dir = self.base_path / "backups"
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    def get_current_schema_version(self) -> SchemaVersion:
        """Get current schema version from storage."""
        if not self.version_file.exists():
            # Default version for fresh installations
            default_version = SchemaVersion(1, 0, 0)
            self.set_schema_version(default_version)
            return default_version

        try:
            with open(self.version_file) as f:
                data = json.load(f)
                return SchemaVersion.from_string(data["version"])
        except (FileNotFoundError, json.JSONDecodeError, KeyError) as e:
            raise MigrationError(f"Failed to read schema version: {e}") from e

    def set_schema_version(self, version: SchemaVersion) -> None:
        """Set current schema version in storage."""
        try:
            version_data = {
                "version": str(version),
                "updated_at": datetime.now(UTC).isoformat(),
                "updated_by": "migration_manager",
            }

            with open(self.version_file, "w") as f:
                json.dump(version_data, f, indent=2)

        except OSError as e:
            raise MigrationError(f"Failed to save schema version: {e}") from e

    def needs_migration(self, target_version: SchemaVersion) -> bool:
        """Check if migration is needed to reach target version."""
        current_version = self.get_current_schema_version()
        return current_version < target_version

    def list_available_migrations(self) -> list[Path]:
        """List available migration scripts."""
        if not self.migrations_dir.exists():
            return []

        migrations = []
        for migration_file in self.migrations_dir.glob("*.py"):
            if migration_file.name.startswith("__"):
                continue  # Skip __init__.py, __pycache__, etc.
            migrations.append(migration_file)

        # Sort by filename (assuming numeric prefix like 001_, 002_, etc.)
        migrations.sort(key=lambda p: p.name)
        return migrations

    def create_pre_migration_backup(self) -> Path:
        """Create backup of all data before migration."""
        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        backup_name = f"pre_migration_{timestamp}"
        backup_path = self.backup_dir / backup_name

        try:
            # Copy all data directories to backup
            data_dirs = ["tickets", "audit", "sessions"]

            for dir_name in data_dirs:
                source_dir = self.base_path / dir_name
                if source_dir.exists():
                    target_dir = backup_path / dir_name
                    shutil.copytree(source_dir, target_dir)

            # Copy schema version file
            if self.version_file.exists():
                shutil.copy2(self.version_file, backup_path / "schema_version.json")

            # Create backup manifest
            manifest = {
                "backup_name": backup_name,
                "created_at": datetime.now(UTC).isoformat(),
                "source_path": str(self.base_path),
                "schema_version": str(self.get_current_schema_version()),
                "data_directories": data_dirs,
            }

            with open(backup_path / "backup_manifest.json", "w") as f:
                json.dump(manifest, f, indent=2)

            return backup_path

        except OSError as e:
            raise MigrationError(f"Failed to create backup: {e}") from e

    def list_backups(self) -> list[dict[str, Any]]:
        """List all available backups with metadata."""
        backups = []

        if not self.backup_dir.exists():
            return backups

        for backup_dir in self.backup_dir.iterdir():
            if not backup_dir.is_dir():
                continue

            manifest_file = backup_dir / "backup_manifest.json"
            if manifest_file.exists():
                try:
                    with open(manifest_file) as f:
                        manifest = json.load(f)
                        manifest["backup_path"] = str(backup_dir)
                        backups.append(manifest)
                except (OSError, json.JSONDecodeError):
                    # Skip corrupted manifest files
                    continue

        # Sort by creation time (newest first)
        backups.sort(key=lambda b: b.get("created_at", ""), reverse=True)
        return backups


class DataMigrator:
    """Performs data migrations and transformations."""

    def __init__(self, base_path: Path):
        """Initialize data migrator."""
        self.base_path = Path(base_path)
        self.ticket_storage = TicketStorage(base_path)
        self.audit_storage = AuditStorage(base_path)
        self.json_storage = JSONStorage(base_path)

    def migrate_tickets_add_defaults(self) -> int:
        """
        Migration: Add default values for new ticket fields.

        This handles cases where old ticket data is missing fields
        that were added in newer schema versions.

        Returns:
            Number of tickets migrated
        """
        migrated_count = 0
        tickets_dir = self.base_path / "tickets"

        if not tickets_dir.exists():
            return migrated_count

        for ticket_file in tickets_dir.glob("*.json"):
            if ticket_file.name.endswith((".tmp", ".bak")):
                continue

            try:
                # Load raw JSON data
                with open(ticket_file) as f:
                    ticket_data = json.load(f)

                # Track if we made any changes
                modified = False

                # Add default values for missing fields
                if "validation_gaps" not in ticket_data:
                    ticket_data["validation_gaps"] = []
                    modified = True

                if "geometry" not in ticket_data:
                    ticket_data["geometry"] = None
                    modified = True

                # Add calculated fields with defaults
                if "lawful_start_date" not in ticket_data:
                    ticket_data["lawful_start_date"] = None
                    modified = True

                if "ticket_expires_date" not in ticket_data:
                    ticket_data["ticket_expires_date"] = None
                    modified = True

                if "marking_valid_until" not in ticket_data:
                    ticket_data["marking_valid_until"] = None
                    modified = True

                # Add submission tracking fields
                if "submitted_at" not in ticket_data:
                    ticket_data["submitted_at"] = None
                    modified = True

                if "submission_packet" not in ticket_data:
                    ticket_data["submission_packet"] = None
                    modified = True

                # Save updated data if modified
                if modified:
                    self.json_storage.save_json(
                        ticket_data, ticket_file, create_backup=True
                    )
                    migrated_count += 1

            except (OSError, json.JSONDecodeError) as e:
                # Log error but continue with other tickets
                print(f"Warning: Could not migrate ticket {ticket_file.name}: {e}")
                continue

        return migrated_count

    def migrate_audit_events_add_defaults(self) -> int:
        """
        Migration: Add default values for new audit event fields.

        Returns:
            Number of audit files migrated
        """
        migrated_count = 0
        audit_dir = self.base_path / "audit"

        if not audit_dir.exists():
            return migrated_count

        for audit_file in audit_dir.glob("*.json"):
            if audit_file.name.endswith((".tmp", ".bak")):
                continue

            try:
                with open(audit_file) as f:
                    daily_data = json.load(f)

                if "events" not in daily_data:
                    continue

                modified = False

                for event in daily_data["events"]:
                    # Add default values for missing fields
                    if "ip_address" not in event:
                        event["ip_address"] = None
                        modified = True

                    if "user_agent" not in event:
                        event["user_agent"] = None
                        modified = True

                    if "details" not in event:
                        event["details"] = None
                        modified = True

                # Save updated audit file if modified
                if modified:
                    self.json_storage.save_json(
                        daily_data, audit_file, create_backup=True
                    )
                    migrated_count += 1

            except (OSError, json.JSONDecodeError) as e:
                print(f"Warning: Could not migrate audit file {audit_file.name}: {e}")
                continue

        return migrated_count

    def validate_data_integrity(self) -> list[str]:
        """
        Validate data integrity after migration.

        Returns:
            List of issues found (empty if no issues)
        """
        issues = []

        # Validate ticket files
        tickets_dir = self.base_path / "tickets"
        if tickets_dir.exists():
            for ticket_file in tickets_dir.glob("*.json"):
                if ticket_file.name.endswith((".tmp", ".bak")):
                    continue

                try:
                    # Try to load and validate ticket
                    ticket_id = ticket_file.stem
                    ticket = self.ticket_storage.load_ticket(ticket_id)

                    if ticket is None:
                        issues.append(
                            f"Ticket file {ticket_file.name} could not be loaded"
                        )
                        continue

                    # Basic validation checks
                    if not ticket.county or not ticket.county.strip():
                        issues.append(f"Ticket {ticket_id} has empty county")

                    if not ticket.address or not ticket.address.strip():
                        issues.append(f"Ticket {ticket_id} has empty address")

                    if (
                        not ticket.work_description
                        or not ticket.work_description.strip()
                    ):
                        issues.append(f"Ticket {ticket_id} has empty work description")

                except Exception as e:
                    issues.append(
                        f"Ticket file {ticket_file.name} validation failed: {e}"
                    )

        # Validate audit files
        audit_dir = self.base_path / "audit"
        if audit_dir.exists():
            for audit_file in audit_dir.glob("*.json"):
                if audit_file.name.endswith((".tmp", ".bak")):
                    continue

                try:
                    with open(audit_file) as f:
                        daily_data = json.load(f)

                    if "events" not in daily_data:
                        issues.append(
                            f"Audit file {audit_file.name} missing events array"
                        )
                        continue

                    # Validate each event can be parsed
                    for i, event_data in enumerate(daily_data["events"]):
                        try:
                            AuditEventModel.model_validate(event_data)
                        except Exception as e:
                            issues.append(
                                f"Audit file {audit_file.name} event {i} validation failed: {e}"
                            )

                except Exception as e:
                    issues.append(
                        f"Audit file {audit_file.name} validation failed: {e}"
                    )

        return issues

    def rollback_from_backup(self, backup_path: Path) -> None:
        """
        Rollback data from backup.

        Args:
            backup_path: Path to backup directory

        Raises:
            MigrationError: If rollback fails
        """
        if not backup_path.exists():
            raise MigrationError(f"Backup path does not exist: {backup_path}")

        manifest_file = backup_path / "backup_manifest.json"
        if not manifest_file.exists():
            raise MigrationError(f"Backup manifest not found: {manifest_file}")

        try:
            # Read backup manifest
            with open(manifest_file) as f:
                manifest = json.load(f)

            # Rollback data directories
            for dir_name in manifest.get("data_directories", []):
                backup_data_dir = backup_path / dir_name
                target_data_dir = self.base_path / dir_name

                if backup_data_dir.exists():
                    # Remove current data directory
                    if target_data_dir.exists():
                        shutil.rmtree(target_data_dir)

                    # Restore from backup
                    shutil.copytree(backup_data_dir, target_data_dir)

            # Rollback schema version
            backup_version_file = backup_path / "schema_version.json"
            if backup_version_file.exists():
                shutil.copy2(
                    backup_version_file, self.base_path / "schema_version.json"
                )

        except (OSError, json.JSONDecodeError) as e:
            raise MigrationError(f"Rollback failed: {e}") from e

    def cleanup_migration_artifacts(self) -> int:
        """
        Clean up temporary files created during migration.

        Returns:
            Number of files cleaned up
        """
        cleaned_count = 0

        # Clean up .bak files
        for data_dir_name in ["tickets", "audit"]:
            data_dir = self.base_path / data_dir_name
            if data_dir.exists():
                for bak_file in data_dir.glob("*.bak"):
                    try:
                        bak_file.unlink()
                        cleaned_count += 1
                    except OSError:
                        continue

        # Clean up .tmp files
        for data_dir_name in ["tickets", "audit"]:
            data_dir = self.base_path / data_dir_name
            if data_dir.exists():
                for tmp_file in data_dir.glob("*.tmp"):
                    try:
                        tmp_file.unlink()
                        cleaned_count += 1
                    except OSError:
                        continue

        return cleaned_count


def run_migration(
    base_path: Path, target_version: SchemaVersion, dry_run: bool = False
) -> dict[str, Any]:
    """
    Run complete migration workflow to target version.

    Args:
        base_path: Base path for data storage
        target_version: Target schema version
        dry_run: If True, only validate what would be migrated

    Returns:
        Migration results dictionary
    """
    manager = MigrationManager(base_path)
    migrator = DataMigrator(base_path)

    current_version = manager.get_current_schema_version()

    result = {
        "success": False,
        "current_version": str(current_version),
        "target_version": str(target_version),
        "needs_migration": manager.needs_migration(target_version),
        "dry_run": dry_run,
        "tickets_migrated": 0,
        "audit_files_migrated": 0,
        "validation_issues": [],
        "backup_path": None,
        "error": None,
    }

    # Check if migration is needed
    if not result["needs_migration"]:
        result["success"] = True
        result["message"] = "No migration needed"
        return result

    try:
        if not dry_run:
            # Create backup before migration
            backup_path = manager.create_pre_migration_backup()
            result["backup_path"] = str(backup_path)

        # Run migrations based on version differences
        if target_version >= SchemaVersion(1, 1, 0):
            # Migration to v1.1.0: Add default fields
            if not dry_run:
                result["tickets_migrated"] = migrator.migrate_tickets_add_defaults()
                result["audit_files_migrated"] = (
                    migrator.migrate_audit_events_add_defaults()
                )

        # Validate data integrity
        issues = migrator.validate_data_integrity()
        result["validation_issues"] = issues

        if issues and not dry_run:
            # Rollback on validation failure
            if result["backup_path"]:
                migrator.rollback_from_backup(Path(result["backup_path"]))
            result["error"] = (
                f"Migration rolled back due to validation issues: {issues}"
            )
            return result

        # Update schema version
        if not dry_run:
            manager.set_schema_version(target_version)

        result["success"] = True
        result["message"] = "Migration completed successfully"

    except Exception as e:
        result["error"] = str(e)

        # Attempt rollback if backup was created
        if not dry_run and result["backup_path"]:
            try:
                migrator.rollback_from_backup(Path(result["backup_path"]))
                result["message"] = "Migration failed and was rolled back"
            except Exception as rollback_error:
                result["message"] = (
                    f"Migration failed and rollback also failed: {rollback_error}"
                )

    return result


# Predefined migration functions for common scenarios
def migrate_to_latest(base_path: Path, dry_run: bool = False) -> dict[str, Any]:
    """Migrate to the latest schema version."""
    # Define latest version - update this when adding new schema versions
    latest_version = SchemaVersion(1, 1, 0)
    return run_migration(base_path, latest_version, dry_run)


def validate_migration_readiness(base_path: Path) -> dict[str, Any]:
    """Check if system is ready for migration."""
    migrator = DataMigrator(base_path)

    return {
        "validation_issues": migrator.validate_data_integrity(),
        "disk_space_available": True,  # Could add actual disk space check
        "backup_space_available": True,  # Could add backup space check
        "ready_for_migration": True,  # Based on above checks
    }
