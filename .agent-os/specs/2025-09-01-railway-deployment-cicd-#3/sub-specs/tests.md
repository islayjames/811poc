# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-09-01-railway-deployment-cicd-#3/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Test Coverage

### Unit Tests

**Storage Persistence Layer**
- Test GCS connection initialization with valid credentials
- Test GCS connection failure fallback to local storage
- Test JSON file upload to GCS bucket
- Test JSON file download from GCS bucket
- Test atomic write operations
- Test concurrent access handling

**Startup Script**
- Test credential setup from environment variable
- Test sync from GCS on startup
- Test graceful handling of missing GCS credentials
- Test port configuration from environment

**Environment Configuration**
- Test loading production environment variables
- Test API key validation in production mode
- Test health check endpoint response

### Integration Tests

**End-to-End Storage Flow**
- Create ticket → Save locally → Upload to GCS
- Restart container → Sync from GCS → Verify data intact
- Multiple concurrent writes → Verify no data loss
- Network failure during upload → Verify retry mechanism

**Deployment Pipeline**
- GitHub push → Action triggered → Tests run → Deployment initiated
- Environment variables properly passed to Railway
- Health check passes after deployment
- Rollback triggered on health check failure

### Manual Testing Checklist

**Railway Deployment**
- [ ] Railway project created successfully
- [ ] Environment variables set in Railway dashboard
- [ ] Custom start command configured
- [ ] Application builds without errors
- [ ] Application starts and binds to PORT
- [ ] Health endpoint responds with 200 OK
- [ ] API endpoints accessible via Railway URL

**GCS Integration**
- [ ] GCS bucket created with correct permissions
- [ ] Service account has necessary access
- [ ] Files upload successfully from application
- [ ] Files persist across container restarts
- [ ] Files download on container startup
- [ ] Backup mechanism working

**GitHub Actions**
- [ ] Workflow triggers on push to main
- [ ] Tests run successfully (or continue on failure)
- [ ] Railway CLI authenticates properly
- [ ] Deployment completes successfully
- [ ] Health check verification passes
- [ ] Failure notifications working

### Performance Tests

**Storage Performance**
- Measure GCS upload latency (target: <1s for JSON files)
- Measure GCS download on startup (target: <5s for 100 files)
- Test with 1000 tickets to validate POC scale

**API Response Times**
- Health endpoint: <100ms
- Ticket creation with GCS save: <500ms
- Ticket retrieval: <200ms

### Mocking Requirements

**GCS Client Mocking**
- Mock google.cloud.storage.Client for unit tests
- Mock bucket operations (upload, download, list)
- Simulate network failures and retries

**Environment Variable Mocking**
- Mock os.environ for configuration tests
- Test with missing and invalid values

**Railway API Mocking**
- Mock deployment status checks
- Mock rollback operations for testing

## Test Commands

```bash
# Run all tests
pytest tests/ -v

# Run deployment-specific tests
pytest tests/test_deployment.py -v

# Run storage tests
pytest tests/test_storage_gcs.py -v

# Run with coverage
pytest tests/ --cov=src --cov-report=html

# Run integration tests (requires GCS credentials)
GOOGLE_APPLICATION_CREDENTIALS=key.json pytest tests/integration/ -v
```

## Continuous Testing Strategy

### Pre-Deployment Tests
1. Unit tests must pass (storage, configuration)
2. Critical API endpoint tests must pass
3. Health check endpoint must respond

### Post-Deployment Tests
1. Automated health check via curl
2. Smoke test of critical endpoints
3. Verify GCS connectivity
4. Check logs for startup errors

### Monitoring Tests
- Health check every 5 minutes
- Storage connectivity check hourly
- Alert on repeated failures

## Test Data Requirements

### Sample JSON Files
```json
// test_data/sample_ticket.json
{
  "ticket_id": "test-001",
  "status": "validated",
  "data": {
    "caller_name": "Test User",
    "work_description": "Test work"
  }
}

// test_data/sample_session.json
{
  "session_id": "test-session",
  "ticket_ids": ["test-001"],
  "created_at": "2025-09-01T00:00:00Z"
}
```

### Environment File for Testing
```bash
# .env.test
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account"...}
GCS_BUCKET_NAME=texas811-poc-test
API_KEY=test-key-123
ENVIRONMENT=test
```
