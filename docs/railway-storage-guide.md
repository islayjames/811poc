# Railway Volume Storage Guide

## Overview

This guide covers the persistent storage configuration for the Texas 811 POC backend deployed on Railway, including volume mount configuration, backup procedures, and data persistence validation.

## Volume Configuration

### Railway Volume Mount

The application uses Railway's volume mounting feature to ensure data persistence across container restarts and deployments.

**Configuration Location**: `railway.json`

```json
{
  "services": [
    {
      "name": "api",
      "volumes": [
        {
          "mount": "/data",
          "name": "texas811-data"
        }
      ]
    }
  ],
  "deploy": {
    "environmentVariables": {
      "DATA_ROOT": "/data"
    }
  }
}
```

### Directory Structure

The persistent volume at `/data` contains:

```
/data/
├── tickets/          # Individual ticket JSON files
├── audit/           # Daily audit log files
├── sessions/        # Session state (if using file-based sessions)
└── backups/         # Manual backup files
```

## Storage Implementation

### Atomic Write Operations

The storage system uses atomic write operations to prevent data corruption:

1. **Temporary File**: Data is first written to `filename.tmp`
2. **Atomic Move**: File is atomically moved to final location
3. **Backup Creation**: Optional backup of existing file before overwrite

### Backup Mechanisms

The system provides multiple backup strategies:

#### 1. Automatic Backups
- Created when `create_backup=True` is passed to save operations
- Backup files use `.bak` extension
- Example: `ticket-123.json.bak`

#### 2. Manual Backups
- Use the `BackupManager` class for explicit backup creation
- Timestamped backup files in `/data/backups/`
- Example: `ticket-123.json.20250901_143022.bak`

#### 3. Cleanup Operations
- Old backups can be cleaned up automatically
- Configurable retention period (default: 30 days)

## Backup and Restore Procedures

### Creating Manual Backups

```python
from texas811_poc.storage import BackupManager
from pathlib import Path

# Initialize backup manager
backup_manager = BackupManager(Path("/data"))

# Create backup of specific file
backup_path = backup_manager.create_backup(
    Path("/data/tickets/ticket-123.json")
)

# List all backups
backups = backup_manager.list_backups()
```

### Restoring from Backup

```python
# Restore file from backup
backup_manager.restore_from_backup(
    backup_path,
    Path("/data/tickets/ticket-123.json")
)
```

### Railway Volume Backup via CLI

#### 1. Connect to Running Container

```bash
# Connect to Railway container
railway shell

# Navigate to data directory
cd /data

# List data contents
ls -la
```

#### 2. Export Data Locally

```bash
# Create archive of all data
tar -czf /tmp/texas811-backup-$(date +%Y%m%d).tar.gz -C /data .

# Download via Railway CLI (if supported)
railway files download /tmp/texas811-backup-*.tar.gz ./
```

#### 3. Restore Data to Volume

```bash
# Upload backup to container
railway files upload ./texas811-backup-20250901.tar.gz /tmp/

# Extract to data directory
tar -xzf /tmp/texas811-backup-20250901.tar.gz -C /data
```

## Data Validation and Testing

### Volume Persistence Testing

To validate that data persists across container restarts:

1. **Create Test Data**
   ```bash
   # Create test ticket via API
   curl -X POST https://your-domain.railway.app/api/tickets \
     -H "Content-Type: application/json" \
     -d '{"county": "Harris", "city": "Houston", "address": "Test St"}'
   ```

2. **Trigger Container Restart**
   ```bash
   # Force new deployment (restarts container)
   railway deploy
   ```

3. **Verify Data Persistence**
   ```bash
   # Check that ticket still exists
   curl https://your-domain.railway.app/api/tickets
   ```

### Storage System Health Check

The application includes storage system validation in the health endpoint:

```bash
curl https://your-domain.railway.app/health
```

This endpoint checks:
- Data directory accessibility
- Write permissions
- Available disk space
- Backup directory status

## Monitoring and Maintenance

### Disk Space Monitoring

Monitor volume usage to prevent storage issues:

```bash
# Check disk usage in container
railway shell
df -h /data
du -sh /data/*
```

### Log Analysis

Audit logs provide insights into storage operations:

- **Location**: `/data/audit/YYYY-MM-DD.json`
- **Contents**: All ticket operations, field updates, status changes
- **Retention**: Configurable (default: indefinite)

### Backup Cleanup

Regular cleanup prevents disk space exhaustion:

```python
# Cleanup backups older than 30 days
cleaned_count = backup_manager.cleanup_old_backups(max_age_days=30)
print(f"Cleaned up {cleaned_count} old backup files")
```

## Configuration Options

### Environment Variables

- `DATA_ROOT`: Base path for all storage operations (default: `/data`)
- `BACKUP_RETENTION_DAYS`: Days to keep backups (default: 30)
- `AUDIT_LOG_RETENTION_DAYS`: Days to keep audit logs (default: 365)

### Storage Limits

Railway volume limits:
- **Volume Size**: Check Railway dashboard for current limits
- **File Count**: No specific limit, but performance may degrade with many small files
- **Concurrent Access**: Atomic operations prevent corruption

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Ensure container user has write access to `/data`
   - Check volume mount configuration in `railway.json`

2. **Data Not Persisting**
   - Verify `DATA_ROOT` environment variable is set to `/data`
   - Confirm volume is properly mounted (check Railway service logs)

3. **Backup Failures**
   - Check available disk space on volume
   - Verify backup directory permissions

### Debug Commands

```bash
# Check volume mount
railway shell
mount | grep data

# Test write permissions
echo "test" > /data/write-test.txt
cat /data/write-test.txt

# Check storage configuration
python -c "from texas811_poc.config import settings; print(f'DATA_ROOT: {settings.data_root}')"
```

## Security Considerations

### Data Protection
- Volume data is encrypted at rest by Railway
- No sensitive data should be stored in logs
- API keys and secrets use environment variables, not file storage

### Access Control
- Container runs as non-root user (`appuser`)
- Data directory has restricted permissions
- No SSH access to volumes from outside Railway

### Compliance
- All ticket operations are logged for audit compliance
- Data retention follows configurable policies
- Backup procedures meet compliance requirements

## Railway-Specific Features

### Volume Snapshots
Railway may provide volume snapshot features:
- Check Railway dashboard for snapshot options
- Automated snapshots for disaster recovery

### Volume Migration
For moving between Railway projects:
1. Create full backup using procedures above
2. Create new Railway project with volume
3. Restore data using backup procedures

### Scaling Considerations
- Single volume per service instance
- Consider database storage for multi-instance deployments
- Monitor performance with large datasets

---

**Last Updated**: 2025-09-01
**Version**: 1.0.0
**Tested With**: Railway Platform, Python 3.11+
