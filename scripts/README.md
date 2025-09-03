# Scripts Directory

Utility scripts for Texas811 POC development.

## sync_tickets.py

Syncs scraped Texas811 tickets from JSON data to the backend API.

### Usage

```bash
# From project root directory
python scripts/sync_tickets.py

# Or use the example script with pre-flight checks
python scripts/usage_example.py

# Or test data transformation only
python scripts/test_sync.py
```

### Requirements

Install script dependencies:

```bash
pip install -r scripts/requirements.txt
```

Or if using the project's uv environment:

```bash
uv pip install requests python-dateutil
```

### Configuration

The script uses these default settings:

- **Source File**: `scrape/texas811-all-tickets-2025-09-03.json`
- **Backend API**: `http://localhost:8000`
- **API Key**: `test-api-key` (development default)
- **Timeout**: 30 seconds per request

### Data Transformation

The script transforms scraped ticket data to match the API requirements:

- **Dates**: Converts "September 02, 2025, 4:20 PM" format to ISO format
- **Duration**: Converts "1 Day", "3 MONTHS" strings to integer days
- **GPS**: Filters out placeholder coordinates and validates Texas bounds
- **Session ID**: Generated from ticket ID for consistency

### Output

The script provides:

- Progress logging during sync
- Statistics summary at completion
- Error details for failed tickets
- Skip reasons for invalid data

### Example Output

```
2025-09-03 12:00:00 - INFO - Texas811 Ticket Sync Tool
2025-09-03 12:00:00 - INFO - Loaded 21 tickets from scrape/texas811-all-tickets-2025-09-03.json
2025-09-03 12:00:00 - INFO - API connection verified
2025-09-03 12:00:00 - INFO - Processing 21 tickets...
2025-09-03 12:00:01 - INFO - Created ticket abc123 for session sync-2574581677
...
==================================================
SYNC STATISTICS
==================================================
Processed:    21
Created:      18
Updated:      0
Errors:       1
Skipped:      2
==================================================
```
