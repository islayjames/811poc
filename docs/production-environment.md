# Production Environment Configuration

## Required Environment Variables

### Core Application Settings
```bash
# Application configuration
DEBUG=false
ENVIRONMENT=production
PORT=8000
HOST=0.0.0.0

# Data storage (Railway volume mount)
DATA_ROOT=/data
```

### Redis Configuration
```bash
# Session management (Railway Redis addon or external)
REDIS_URL=redis://redis-production:6379/0
REDIS_SESSION_TTL=3600
```

### API Security
```bash
# CustomGPT Integration
API_KEY=your-production-api-key-here
ALLOWED_API_KEYS=key1,key2,key3

# Authentication tokens (if using JWT)
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### External Services
```bash
# Geocoding service
GEOCODING_API_KEY=your-mapbox-or-google-api-key
GEOCODING_SERVICE=mapbox

# Database (if/when implemented)
DATABASE_URL=postgresql://user:pass@host:5432/texas811_prod
```

### Texas 811 Configuration
```bash
# Compliance settings
TEXAS811_BUSINESS_DAYS_WAIT=2
TEXAS811_TICKET_VALIDITY_DAYS=14
TEXAS811_MARKING_VALIDITY_DAYS=14

# POC limits
MAX_TICKETS=100
```

### Monitoring & Logging
```bash
# Application monitoring
LOG_LEVEL=INFO
LOG_FORMAT=json
STRUCTURED_LOGGING=true

# Metrics (if Prometheus enabled)
METRICS_ENABLED=true
METRICS_PORT=9090
```

## Railway Deployment Variables

### Automatically Set by Railway
```bash
RAILWAY_ENVIRONMENT=production
RAILWAY_PUBLIC_DOMAIN=texas811-poc-production.up.railway.app
PORT=8000  # Railway sets this automatically
```

### Volume Configuration
```bash
# Persistent data storage
DATA_ROOT=/data  # Maps to Railway volume mount
```

## Security Considerations

### API Keys
- Use strong, randomly generated API keys
- Rotate keys regularly
- Store in Railway environment variables (encrypted at rest)

### CORS Configuration
```bash
# Production CORS origins
ALLOWED_ORIGINS=https://chatgpt.com,https://chat.openai.com
```

### Rate Limiting
```bash
# API rate limiting
RATE_LIMIT_PER_MINUTE=100
RATE_LIMIT_BURST=20
```

## Health Check Configuration

The application provides multiple health check endpoints:

- `GET /` - Basic service information
- `GET /health` - Detailed component health status
- `GET /ready` - Simple readiness check for load balancers

Railway uses `/health` endpoint with 30-second timeout.

## Logging Configuration

### Production Logging Levels
- `ERROR`: Critical errors requiring immediate attention
- `WARN`: Warning conditions that should be monitored
- `INFO`: General operational messages
- `DEBUG`: Disabled in production

### Structured Logging
When `STRUCTURED_LOGGING=true`, all logs are output in JSON format for better parsing by monitoring systems.

## Monitoring Integration

### Prometheus Metrics
If `METRICS_ENABLED=true`, metrics are exposed at `http://localhost:9090/metrics`:

- Request count and latency
- Active sessions
- Redis connection status
- Error rates by endpoint

### Health Monitoring
The `/health` endpoint provides detailed status for:
- Redis connectivity
- Data directory availability
- Session manager status
- Component health scores

## Deployment Checklist

### Pre-deployment
- [ ] All required environment variables set in Railway
- [ ] API keys generated and configured
- [ ] Redis addon enabled (or external Redis configured)
- [ ] Volume mount configured for persistent data

### Post-deployment
- [ ] Health checks passing
- [ ] API endpoints responding correctly
- [ ] CORS allowing CustomGPT connections
- [ ] Session management working
- [ ] Error handling functioning properly

### Monitoring Setup
- [ ] Health check alerts configured
- [ ] Log aggregation enabled
- [ ] Performance metrics baseline established
- [ ] Error rate thresholds set

## Troubleshooting

### Common Issues
1. **Port conflicts**: Railway sets PORT automatically, don't override
2. **Volume permissions**: Ensure DATA_ROOT is writable
3. **Redis connectivity**: Check REDIS_URL format and network access
4. **CORS errors**: Verify ALLOWED_ORIGINS includes CustomGPT domains

### Debug Commands
```bash
# Check health status
curl https://your-domain/health

# Test API endpoint
curl -H "Authorization: Bearer your-api-key" \
     -H "Content-Type: application/json" \
     -d '{"county":"Travis","city":"Austin"}' \
     https://your-domain/api/v1/validate

# Check logs (Railway CLI)
railway logs
```

## Environment Variable Validation

The application validates all environment variables at startup and will fail fast if required variables are missing or invalid.

Required variables for production:
- `API_KEY` or `ALLOWED_API_KEYS`
- `GEOCODING_API_KEY`
- `DATA_ROOT` (must be writable)

Optional but recommended:
- `REDIS_URL` (falls back to in-memory sessions)
- `SECRET_KEY` (for JWT token signing)
