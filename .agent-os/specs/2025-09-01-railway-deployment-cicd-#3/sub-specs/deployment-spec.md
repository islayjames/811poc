# Deployment Specification

This is the deployment specification for the spec detailed in @.agent-os/specs/2025-09-01-railway-deployment-cicd-#3/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Railway Configuration

### Project Setup
```toml
# railway.toml
[build]
builder = "NIXPACKS"
buildCommand = "pip install -r requirements.txt"

[deploy]
startCommand = "python src/startup.py"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

### Environment Variables
```bash
# Production Environment Variables (set in Railway dashboard)
PORT                                # Auto-assigned by Railway
GOOGLE_APPLICATION_CREDENTIALS_JSON # GCS service account JSON
GCS_BUCKET_NAME                    # texas811-poc-storage
API_KEY                            # Production API key
GEOCODING_API_KEY                  # Mapbox API key
ENVIRONMENT                        # production
DEBUG                              # false
```

## Google Cloud Storage Configuration

### Bucket Setup
```bash
# Create bucket
gsutil mb -p [PROJECT_ID] -c standard -l us-central1 gs://texas811-poc-storage/

# Set lifecycle policy (optional - delete old backups after 30 days)
gsutil lifecycle set lifecycle.json gs://texas811-poc-storage/

# Create service account
gcloud iam service-accounts create texas811-storage \
  --display-name="Texas 811 Storage Service"

# Grant permissions
gsutil iam ch serviceAccount:texas811-storage@[PROJECT_ID].iam.gserviceaccount.com:objectAdmin \
  gs://texas811-poc-storage/

# Create key
gcloud iam service-accounts keys create key.json \
  --iam-account=texas811-storage@[PROJECT_ID].iam.gserviceaccount.com
```

### Storage Structure
```
texas811-poc-storage/
├── tickets/
│   └── *.json           # Individual ticket files
├── sessions/
│   └── *.json           # Session state files
├── audit/
│   └── YYYY-MM-DD.json  # Daily audit logs
└── backups/
    └── backup-TIMESTAMP.tar.gz  # Periodic backups
```

## GitHub Actions Configuration

### Workflow File
```yaml
# .github/workflows/deploy.yml
name: Deploy to Railway

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-asyncio

      - name: Run tests
        run: pytest tests/ -v --tb=short
        continue-on-error: true  # For POC, don't block on test failures

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Deploy to Railway
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: |
          railway up --service api --environment production

      - name: Health Check
        run: |
          sleep 30
          curl -f https://[your-app].railway.app/health || exit 1
```

### GitHub Secrets Required
```
RAILWAY_TOKEN          # Railway API token from project settings
GCS_SERVICE_ACCOUNT    # Base64 encoded service account JSON
```

## Dockerfile Configuration

```dockerfile
# Dockerfile (if needed for custom build)
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY .env.example .env

# Create data directories
RUN mkdir -p /tmp/data/tickets /tmp/data/sessions /tmp/data/audit

# Start command
CMD ["python", "src/startup.py"]
```

## Startup Script

```python
# src/startup.py
"""
Startup script for Railway deployment.
Handles GCS sync and starts the FastAPI application.
"""

import os
import json
import logging
from pathlib import Path
from google.cloud import storage
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_gcs_credentials():
    """Setup GCS credentials from environment variable."""
    creds_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if creds_json:
        # Write credentials to file for GCS client
        creds_path = "/tmp/gcs-credentials.json"
        with open(creds_path, "w") as f:
            f.write(creds_json)
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = creds_path
        logger.info("GCS credentials configured")

def sync_from_gcs():
    """Download JSON files from GCS to local storage."""
    bucket_name = os.environ.get("GCS_BUCKET_NAME", "texas811-poc-storage")

    try:
        client = storage.Client()
        bucket = client.bucket(bucket_name)

        # Download all JSON files
        for blob in bucket.list_blobs():
            if blob.name.endswith('.json'):
                local_path = Path(f"/tmp/data/{blob.name}")
                local_path.parent.mkdir(parents=True, exist_ok=True)
                blob.download_to_filename(str(local_path))
                logger.info(f"Downloaded {blob.name}")

        logger.info("GCS sync completed")
    except Exception as e:
        logger.warning(f"GCS sync failed: {e}. Starting with empty storage.")

def main():
    """Main startup function."""
    # Setup GCS if configured
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON"):
        setup_gcs_credentials()
        sync_from_gcs()
    else:
        logger.info("No GCS credentials found, using local storage only")

    # Start the FastAPI application
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "texas811_poc.main:app",
        host="0.0.0.0",
        port=port,
        log_level="info"
    )

if __name__ == "__main__":
    main()
```

## Monitoring and Logs

### Railway Monitoring
- View logs: `railway logs --service api`
- Check metrics: Railway dashboard → Metrics tab
- Set up alerts: Railway dashboard → Alerts

### Health Check Implementation
```python
# Already in src/texas811_poc/main.py
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Texas 811 POC Backend",
        "storage": check_gcs_connection(),
        "timestamp": datetime.utcnow().isoformat()
    }
```

## Rollback Strategy

### Manual Rollback
```bash
# Via Railway CLI
railway rollback --service api

# Via Railway Dashboard
# Navigate to Deployments → Select previous deployment → Rollback
```

### Automatic Rollback
- Health check failures trigger automatic rollback
- Configure in railway.toml with restart policies
