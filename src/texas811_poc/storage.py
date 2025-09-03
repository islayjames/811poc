"""
JSON file storage implementation with atomic writes and backups.

This module provides persistent storage for Texas811 POC data using JSON files
with atomic write operations, backup management, and query capabilities.

Key features:
- Atomic writes to prevent data corruption
- Automatic backup creation
- Type-safe data loading with Pydantic models
- Search and query functionality
- Daily audit log rotation
"""

import json
import os
import shutil
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from texas811_poc.models import (
    AuditAction,
    AuditEventModel,
    MemberResponseDetail,
    TicketModel,
    TicketStatus,
)


def json_serializer(obj: Any) -> str:
    """JSON serializer for datetime and other objects."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, date):
        return obj.isoformat()
    elif hasattr(obj, "__dict__"):
        return obj.__dict__
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


class StorageError(Exception):
    """Exception raised for storage-related errors."""

    pass


class JSONStorage:
    """Base class for JSON file storage with atomic writes."""

    def __init__(self, base_path: Path):
        """Initialize storage with base directory path."""
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def save_json(
        self, data: dict[str, Any], file_path: Path, create_backup: bool = False
    ) -> None:
        """
        Save data to JSON file with atomic write operation.

        Args:
            data: Data to save (must be JSON serializable)
            file_path: Path to save file
            create_backup: Whether to create backup of existing file

        Raises:
            StorageError: If save operation fails
        """
        try:
            # Create parent directories if needed
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Create backup if requested and file exists
            if create_backup and file_path.exists():
                backup_path = file_path.with_suffix(f"{file_path.suffix}.bak")
                shutil.copy2(file_path, backup_path)

            # Atomic write using temporary file
            temp_path = file_path.with_suffix(f"{file_path.suffix}.tmp")

            try:
                with open(temp_path, "w", encoding="utf-8") as f:
                    json.dump(
                        data, f, indent=2, ensure_ascii=False, default=json_serializer
                    )
                    f.flush()
                    os.fsync(f.fileno())  # Force write to disk

                # Atomic move (rename is atomic on most filesystems)
                temp_path.replace(file_path)

            except Exception:
                # Clean up temp file if something went wrong
                if temp_path.exists():
                    temp_path.unlink()
                raise

        except (OSError, TypeError) as e:
            raise StorageError(f"Failed to save JSON to {file_path}: {e}") from e

    def load_json(self, file_path: Path) -> dict[str, Any] | None:
        """
        Load data from JSON file.

        Args:
            file_path: Path to load from

        Returns:
            Loaded data or None if file doesn't exist

        Raises:
            StorageError: If load operation fails
        """
        if not file_path.exists():
            return None

        try:
            with open(file_path, encoding="utf-8") as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            raise StorageError(f"Failed to load JSON from {file_path}: {e}") from e


class TicketStorage(JSONStorage):
    """Storage operations for tickets."""

    def __init__(self, base_path: Path):
        """Initialize ticket storage."""
        super().__init__(base_path)
        self.tickets_dir = self.base_path / "tickets"
        self.tickets_dir.mkdir(parents=True, exist_ok=True)

    def save_ticket(self, ticket: TicketModel, create_backup: bool = False) -> None:
        """
        Save ticket to storage.

        Args:
            ticket: Ticket model to save
            create_backup: Whether to create backup if file exists
        """
        file_path = self.get_ticket_file_path(ticket.ticket_id)
        ticket_data = ticket.model_dump(mode="json")
        self.save_json(ticket_data, file_path, create_backup=create_backup)

    def load_ticket(self, ticket_id: str) -> TicketModel | None:
        """
        Load ticket from storage.

        Args:
            ticket_id: ID of ticket to load

        Returns:
            Ticket model or None if not found
        """
        file_path = self.get_ticket_file_path(ticket_id)
        ticket_data = self.load_json(file_path)

        if ticket_data is None:
            return None

        try:
            return TicketModel.model_validate(ticket_data)
        except Exception as e:
            raise StorageError(f"Failed to parse ticket {ticket_id}: {e}") from e

    def list_tickets(self) -> list[TicketModel]:
        """
        List all tickets in storage.

        Returns:
            List of all ticket models
        """
        tickets: list[dict[str, Any]] = []

        if not self.tickets_dir.exists():
            return tickets

        for ticket_file in self.tickets_dir.glob("*.json"):
            if ticket_file.name.endswith(".tmp") or ticket_file.name.endswith(".bak"):
                continue  # Skip temporary and backup files

            ticket_id = ticket_file.stem
            try:
                ticket = self.load_ticket(ticket_id)
                if ticket:
                    tickets.append(ticket)
            except StorageError:
                # Log error but continue processing other tickets
                continue

        # Sort by creation date (newest first)
        tickets.sort(key=lambda t: t.created_at, reverse=True)
        return tickets

    def delete_ticket(self, ticket_id: str) -> bool:
        """
        Delete ticket from storage.

        Args:
            ticket_id: ID of ticket to delete

        Returns:
            True if ticket was deleted, False if not found
        """
        file_path = self.get_ticket_file_path(ticket_id)

        if not file_path.exists():
            return False

        try:
            file_path.unlink()
            return True
        except OSError as e:
            raise StorageError(f"Failed to delete ticket {ticket_id}: {e}") from e

    def search_tickets(
        self,
        status: TicketStatus | None = None,
        session_id: str | None = None,
        county: str | None = None,
        limit: int | None = None,
    ) -> list[TicketModel]:
        """
        Search tickets by various criteria.

        Args:
            status: Filter by ticket status
            session_id: Filter by session ID
            county: Filter by county
            limit: Maximum number of results

        Returns:
            List of matching ticket models
        """
        tickets = self.list_tickets()

        # Apply filters
        if status is not None:
            tickets = [t for t in tickets if t.status == status]

        if session_id is not None:
            tickets = [t for t in tickets if t.session_id == session_id]

        if county is not None:
            tickets = [t for t in tickets if t.county.lower() == county.lower()]

        # Apply limit
        if limit is not None:
            tickets = tickets[:limit]

        return tickets

    def get_ticket_file_path(self, ticket_id: str) -> Path:
        """Get file path for ticket JSON file."""
        return self.tickets_dir / f"{ticket_id}.json"


class AuditStorage(JSONStorage):
    """Storage operations for audit events."""

    def __init__(self, base_path: Path):
        """Initialize audit storage."""
        super().__init__(base_path)
        self.audit_dir = self.base_path / "audit"
        self.audit_dir.mkdir(parents=True, exist_ok=True)

    def save_audit_event(self, event: AuditEventModel) -> None:
        """
        Save audit event to daily log file.

        Args:
            event: Audit event to save
        """
        event_date = event.timestamp.date()
        daily_file = self.get_daily_audit_file(event_date)

        # Load existing events for the day
        existing_events = []
        if daily_file.exists():
            daily_data = self.load_json(daily_file)
            if daily_data and "events" in daily_data:
                existing_events = daily_data["events"]

        # Add new event
        event_data = event.model_dump(mode="json")
        existing_events.append(event_data)

        # Save updated daily log
        daily_log = {"date": event_date.isoformat(), "events": existing_events}
        self.save_json(daily_log, daily_file)

    def get_audit_events(
        self,
        ticket_id: str | None = None,
        action: AuditAction | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[AuditEventModel]:
        """
        Get audit events by various filters.

        Args:
            ticket_id: Filter by ticket ID
            action: Filter by action type
            start_date: Filter events from this date
            end_date: Filter events up to this date

        Returns:
            List of matching audit events
        """
        events = []

        # Determine date range to search
        if start_date is None:
            start_date = date(2024, 1, 1)  # Default start date to cover test events
        if end_date is None:
            end_date = date.today() + timedelta(days=1)  # Include today

        # Load events from daily files in date range
        current_date = start_date
        while current_date <= end_date:
            daily_file = self.get_daily_audit_file(current_date)
            if daily_file.exists():
                daily_data = self.load_json(daily_file)
                if daily_data and "events" in daily_data:
                    for event_data in daily_data["events"]:
                        try:
                            event = AuditEventModel.model_validate(event_data)
                            events.append(event)
                        except Exception:
                            continue  # Skip invalid events

            # Move to next date
            current_date = date.fromordinal(current_date.toordinal() + 1)

        # Apply filters
        if ticket_id is not None:
            events = [e for e in events if e.ticket_id == ticket_id]

        if action is not None:
            events = [e for e in events if e.action == action]

        # Sort by timestamp (newest first)
        events.sort(key=lambda e: e.timestamp, reverse=True)
        return events

    def get_daily_audit_file(self, date: date) -> Path:
        """Get file path for daily audit log."""
        return self.audit_dir / f"{date.isoformat()}.json"


class BackupManager:
    """Manages backup operations for storage files."""

    def __init__(self, base_path: Path):
        """Initialize backup manager."""
        self.base_path = Path(base_path)
        self.backup_dir = self.base_path / "backups"
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    def create_backup(self, file_path: Path, backup_suffix: str | None = None) -> Path:
        """
        Create backup of file.

        Args:
            file_path: Path to file to backup
            backup_suffix: Optional suffix for backup file

        Returns:
            Path to backup file

        Raises:
            StorageError: If backup creation fails
        """
        if not file_path.exists():
            raise StorageError(f"Cannot backup non-existent file: {file_path}")

        # Generate backup filename
        if backup_suffix is None:
            timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
            backup_suffix = f".{timestamp}.bak"

        backup_path = self.backup_dir / f"{file_path.name}{backup_suffix}"

        try:
            shutil.copy2(file_path, backup_path)
            return backup_path
        except OSError as e:
            raise StorageError(f"Failed to create backup: {e}") from e

    def restore_from_backup(self, backup_path: Path, target_path: Path) -> None:
        """
        Restore file from backup.

        Args:
            backup_path: Path to backup file
            target_path: Path to restore to

        Raises:
            StorageError: If restore operation fails
        """
        if not backup_path.exists():
            raise StorageError(f"Backup file not found: {backup_path}")

        try:
            # Create target directory if needed
            target_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(backup_path, target_path)
        except OSError as e:
            raise StorageError(f"Failed to restore from backup: {e}") from e

    def list_backups(self) -> list[Path]:
        """List all backup files."""
        if not self.backup_dir.exists():
            return []

        backups = []
        for backup_file in self.backup_dir.iterdir():
            if backup_file.is_file():
                backups.append(backup_file)

        # Sort by modification time (newest first)
        backups.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        return backups

    def cleanup_old_backups(self, max_age_days: int = 30) -> int:
        """
        Clean up backup files older than specified days.

        Args:
            max_age_days: Maximum age in days for backup files

        Returns:
            Number of files cleaned up
        """
        if max_age_days <= 0:
            raise ValueError("max_age_days must be positive")

        cutoff_time = datetime.now(UTC).timestamp() - (max_age_days * 24 * 3600)
        cleaned_count = 0

        for backup_file in self.list_backups():
            try:
                if backup_file.stat().st_mtime < cutoff_time:
                    backup_file.unlink()
                    cleaned_count += 1
            except OSError:
                continue  # Skip files that can't be deleted

        return cleaned_count


# Utility functions for common storage operations
class MemberResponseStorage(JSONStorage):
    """Storage operations for member responses."""

    def __init__(self, base_path: Path):
        """Initialize member response storage."""
        super().__init__(base_path)
        self.responses_dir = self.base_path / "responses"
        self.responses_dir.mkdir(parents=True, exist_ok=True)

    def save_response(self, response: MemberResponseDetail) -> None:
        """
        Save member response to storage.

        Args:
            response: Member response to save
        """
        file_path = self.get_response_file_path(
            response.ticket_id, response.member_code
        )
        response_data = response.model_dump(mode="json")
        self.save_json(response_data, file_path, create_backup=True)

    def load_response(
        self, ticket_id: str, member_code: str
    ) -> MemberResponseDetail | None:
        """
        Load member response from storage.

        Args:
            ticket_id: ID of associated ticket
            member_code: Member code of responding utility

        Returns:
            Member response model or None if not found
        """
        file_path = self.get_response_file_path(ticket_id, member_code)

        if not file_path.exists():
            return None

        try:
            response_data = self.load_json(file_path)
            if response_data:
                return MemberResponseDetail(**response_data)
            return None
        except Exception:
            return None

    def load_ticket_responses(self, ticket_id: str) -> list[MemberResponseDetail]:
        """
        Load all responses for a specific ticket.

        Args:
            ticket_id: ID of ticket

        Returns:
            List of member responses for the ticket
        """
        responses = []
        ticket_responses_dir = self.responses_dir / ticket_id

        if not ticket_responses_dir.exists():
            return responses

        for response_file in ticket_responses_dir.iterdir():
            if response_file.is_file() and response_file.suffix == ".json":
                try:
                    response_data = self.load_json(response_file)
                    if response_data:
                        responses.append(MemberResponseDetail(**response_data))
                except Exception:
                    continue  # Skip corrupted response files

        return responses

    def delete_response(self, ticket_id: str, member_code: str) -> bool:
        """
        Delete member response from storage.

        Args:
            ticket_id: ID of associated ticket
            member_code: Member code of responding utility

        Returns:
            True if response was deleted, False if not found
        """
        file_path = self.get_response_file_path(ticket_id, member_code)

        if not file_path.exists():
            return False

        try:
            file_path.unlink()

            # Clean up empty ticket directory
            ticket_dir = file_path.parent
            if ticket_dir.exists() and not any(ticket_dir.iterdir()):
                ticket_dir.rmdir()

            return True
        except OSError as e:
            raise StorageError(
                f"Failed to delete response {ticket_id}/{member_code}: {e}"
            ) from e

    def get_response_file_path(self, ticket_id: str, member_code: str) -> Path:
        """Get file path for member response JSON file."""
        ticket_dir = self.responses_dir / ticket_id
        ticket_dir.mkdir(parents=True, exist_ok=True)
        return ticket_dir / f"{member_code.upper()}.json"


def create_storage_instances(
    base_path: str | Path,
) -> tuple[TicketStorage, AuditStorage, MemberResponseStorage, BackupManager]:
    """
    Create all storage instances with shared base path.

    Args:
        base_path: Base directory for all storage

    Returns:
        Tuple of (ticket_storage, audit_storage, response_storage, backup_manager)
    """
    path = Path(base_path)
    return (
        TicketStorage(path),
        AuditStorage(path),
        MemberResponseStorage(path),
        BackupManager(path),
    )


def migrate_storage_format(old_path: Path, new_path: Path) -> None:
    """
    Migrate storage files from old format to new format.

    This function provides a framework for future schema migrations.

    Args:
        old_path: Path to old storage location
        new_path: Path to new storage location
    """
    # This would contain migration logic for schema changes
    # For now, it's a placeholder for future use
    raise NotImplementedError("Storage migration not yet implemented")


class DataQueryUtils:
    """Utility class for advanced data querying and analysis."""

    def __init__(self, ticket_storage: TicketStorage, audit_storage: AuditStorage):
        """Initialize query utils with storage instances."""
        self.ticket_storage = ticket_storage
        self.audit_storage = audit_storage

    def get_tickets_with_audit(self, ticket_id: str) -> dict[str, Any]:
        """
        Get ticket with its complete audit trail.

        Args:
            ticket_id: ID of ticket to retrieve

        Returns:
            Dictionary with ticket data and audit events
        """
        ticket = self.ticket_storage.load_ticket(ticket_id)
        if ticket is None:
            return {"ticket": None, "audit_events": []}

        audit_events = self.audit_storage.get_audit_events(ticket_id=ticket_id)

        return {"ticket": ticket, "audit_events": audit_events}

    def get_dashboard_summary(self) -> dict[str, Any]:
        """
        Get summary data for dashboard display.

        Returns:
            Dictionary with dashboard metrics
        """
        tickets = self.ticket_storage.list_tickets()

        status_counts = {}
        for status in TicketStatus:
            status_counts[status.value] = len(
                [t for t in tickets if t.status == status]
            )

        return {
            "total_tickets": len(tickets),
            "status_counts": status_counts,
            "recent_tickets": tickets[:10],  # Most recent 10
            "last_updated": datetime.now(UTC).isoformat(),
        }

    def search_tickets_advanced(
        self,
        query: str | None = None,
        status: TicketStatus | None = None,
        county: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict[str, Any]:
        """
        Advanced ticket search with pagination and text search.

        Args:
            query: Text to search in description, address, etc.
            status: Filter by status
            county: Filter by county
            date_from: Filter tickets created after this date
            date_to: Filter tickets created before this date
            limit: Maximum results per page
            offset: Number of results to skip

        Returns:
            Dictionary with search results and pagination info
        """
        tickets = self.ticket_storage.list_tickets()

        # Apply filters
        if status is not None:
            tickets = [t for t in tickets if t.status == status]

        if county is not None:
            tickets = [t for t in tickets if t.county.lower() == county.lower()]

        if date_from is not None:
            tickets = [t for t in tickets if t.created_at.date() >= date_from]

        if date_to is not None:
            tickets = [t for t in tickets if t.created_at.date() <= date_to]

        if query is not None:
            query_lower = query.lower()
            tickets = [
                t
                for t in tickets
                if (
                    query_lower in t.work_description.lower()
                    if t.work_description
                    else False
                )
                or (query_lower in t.address.lower() if t.address else False)
                or (query_lower in t.county.lower() if t.county else False)
                or (query_lower in t.city.lower() if t.city else False)
            ]

        # Apply pagination
        total_count = len(tickets)
        paginated_tickets = tickets[offset : offset + limit]

        return {
            "tickets": paginated_tickets,
            "total_count": total_count,
            "page": (offset // limit) + 1,
            "page_size": limit,
            "has_next": offset + limit < total_count,
            "has_prev": offset > 0,
        }
