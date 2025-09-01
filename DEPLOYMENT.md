# Railway Deployment Guide

## Manual Deployment Steps

Since Railway CLI authentication requires interactive login, here are the manual deployment steps:

### 1. Login to Railway Dashboard
1. Go to https://railway.app/login
2. Use the provided token: `ab6fcdd5-c960-43de-bd8e-c47893bd3cac`
3. Access your Railway dashboard

### 2. Create New Project
1. Click "New Project"
2. Choose "Deploy from GitHub repo" or "Empty Project"
3. If using GitHub, connect your repository
4. If using empty project, you'll deploy via CLI later

### 3. Configure Environment Variables
Set these environment variables in Railway dashboard:
- `DATA_ROOT=/data`
- `DEBUG=false`
- `PORT` (automatically set by Railway)
- `REDIS_URL` (optional, set when Redis service is added)

### 4. Add Volume (Important for Data Persistence)
1. Go to your service settings
2. Add a volume mount at `/data`
3. This ensures ticket data persists across deployments

### 5. Deploy Using CLI (After Interactive Login)
```bash
# Login interactively (browser required)
railway login

# Link to project
railway link [PROJECT_ID]

# Deploy
railway up
```

### 6. Alternative: Deploy via GitHub Integration
1. Push code to GitHub repository
2. Connect Railway to your GitHub repo
3. Railway will automatically build and deploy using our Dockerfile

## Deployment Files Created

1. **railway.toml** - Railway configuration
2. **Dockerfile** - Container build instructions
3. **requirements.txt** - Python dependencies
4. **src/startup.py** - Container startup script

## Health Check Endpoints

After deployment, verify these endpoints:
- `/health` - Detailed health status
- `/ready` - Simple readiness check
- `/` - API information

## Volume Configuration

The application expects data to be stored at `/data` with these subdirectories:
- `/data/tickets` - Ticket JSON files
- `/data/sessions` - Session data
- `/data/audit` - Audit logs

If no volume is mounted, it falls back to `/app/data`.

## Environment Variables Reference

Required for production:
- `PORT` - Set automatically by Railway
- `DATA_ROOT=/data` - Data storage location
- `DEBUG=false` - Disable debug mode

Optional:
- `REDIS_URL` - Redis connection string
- `GEOCODING_API_KEY` - Mapbox token for geocoding
- `API_KEY` - API security key

## Troubleshooting

1. **Health check fails**: Check that PORT environment variable is set
2. **Data not persisting**: Ensure volume is mounted at `/data`
3. **Import errors**: Verify all dependencies are in requirements.txt
4. **Permission errors**: Dockerfile uses non-root user for security
