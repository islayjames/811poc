# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-01-railway-deployment-cicd-#3/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Technical Requirements

### Railway Deployment Requirements
- Python 3.11+ runtime environment
- FastAPI application with Uvicorn ASGI server
- Support for environment variables via Railway dashboard
- Automatic port binding via PORT environment variable
- Health check endpoint monitoring
- Proper CORS configuration for production domains

### Persistent Storage Requirements
- Store and retrieve JSON files for tickets, sessions, and audit logs
- Automatic backup on write operations
- Restore data on container startup
- Handle approximately 1000 tickets (< 10MB total data for POC)
- Support atomic writes to prevent data corruption

### CI/CD Pipeline Requirements
- Trigger on pushes to main branch
- Run basic tests before deployment
- Secure handling of environment variables
- Zero-downtime deployment strategy
- Build caching for faster deployments
- Failure notifications

## Approach Options

### Storage Solution Options

**Option A: Railway Volumes**
- Pros: Native to Railway, simple setup, no external dependencies
- Cons: Limited to single container, requires volume mount configuration

**Option B: Google Cloud Storage (Selected)**
- Pros: Highly reliable, simple API, good free tier, survives container deletion
- Cons: Requires GCS setup and service account

**Option C: GitHub Repository Storage**
- Pros: Version controlled, free, simple git operations
- Cons: Not designed for frequent writes, API rate limits

**Rationale:** Google Cloud Storage provides the best balance of reliability, simplicity, and cost-effectiveness for POC needs. It survives container restarts/deletions and has a generous free tier.

### Deployment Strategy

**Option A: Railway GitHub Integration**
- Pros: Built-in, automatic, no additional configuration
- Cons: Less control over deployment process

**Option B: GitHub Actions with Railway CLI (Selected)**
- Pros: Full control, can run tests, manage secrets properly
- Cons: Requires more setup

**Rationale:** GitHub Actions provides better control over the deployment process, allowing us to run tests and manage secrets properly while still being automated.

## External Dependencies

### New Dependencies

**google-cloud-storage** - For persistent JSON storage
- **Justification:** Reliable object storage for JSON files that survives container restarts
- **Version:** ^2.10.0

**python-dotenv** - For environment variable management (already in project)
- **Justification:** Load environment variables from .env file in development
- **Version:** ^1.0.0

### Service Dependencies

**Google Cloud Platform**
- Create GCS bucket for JSON storage
- Service account with Storage Object Admin permission
- JSON key file for authentication

**Railway Platform**
- Railway account and project
- Environment variables configuration
- Custom start command configuration

**GitHub Actions**
- Secrets for Railway token and GCS credentials
- Workflow file in .github/workflows/

## Implementation Details

### Storage Architecture
```
Container Startup:
1. Check GCS connection
2. Download latest JSON files to /tmp/data/
3. Initialize storage layer with local cache
4. Start FastAPI application

During Operation:
1. Write to local /tmp/data/ first
2. Upload to GCS asynchronously
3. Maintain write-ahead log for recovery

On Shutdown:
1. Final sync to GCS
2. Clean shutdown signal
```

### Environment Variables Structure
```
# Railway Environment Variables
PORT=<auto-assigned>
GOOGLE_APPLICATION_CREDENTIALS_JSON=<service-account-json>
GCS_BUCKET_NAME=texas811-poc-storage
API_KEY=<production-api-key>
GEOCODING_API_KEY=<mapbox-key>
REDIS_URL=<optional-redis-url>
ENVIRONMENT=production

# GitHub Secrets
RAILWAY_TOKEN=<railway-api-token>
GCS_SERVICE_ACCOUNT=<base64-encoded-json>
```

### Deployment Flow
```
1. Developer pushes to main
2. GitHub Actions triggered
3. Run tests (pytest)
4. Build Docker image
5. Deploy to Railway via CLI
6. Health check verification
7. Notification of success/failure
```
