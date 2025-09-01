# Deployment Guide

This guide covers deployment setup and configuration for the Texas 811 POC Backend.

## Railway Deployment

The application is deployed to Railway with automated CI/CD through GitHub Actions.

### Production URL
- **Live Application**: https://texas811-poc-production.up.railway.app
- **Health Check**: https://texas811-poc-production.up.railway.app/health
- **API Documentation**: https://texas811-poc-production.up.railway.app/docs

## GitHub Actions CI/CD Pipeline

The deployment pipeline includes:
- **Test Stage**: Run linting, type checking, and unit tests
- **Build Stage**: Create Docker image for deployment validation
- **Deploy Stage**: Deploy to Railway production environment
- **Health Check**: Verify deployment health and API availability
- **Notification**: Report deployment status

### Required GitHub Secrets

To enable automated deployment, configure these secrets in your GitHub repository:

#### RAILWAY_TOKEN

**Purpose**: Authenticates GitHub Actions with Railway for automated deployments

**Setup Steps**:

1. **Generate Railway Token**:
   ```bash
   # Install Railway CLI locally
   curl -fsSL https://railway.app/install.sh | sh

   # Login to Railway
   railway login

   # Generate deployment token
   railway auth
   ```

2. **Add Secret to GitHub**:
   - Go to your GitHub repository
   - Navigate to **Settings** > **Secrets and variables** > **Actions**
   - Click **New repository secret**
   - Name: `RAILWAY_TOKEN`
   - Value: Copy the token from Railway CLI
   - Click **Add secret**

3. **Verify Token Access**:
   ```bash
   # Test token works (run locally)
   railway login --token YOUR_TOKEN_HERE
   railway status
   ```

**Security Notes**:
- Railway tokens have full access to your Railway account
- Only use tokens in GitHub Secrets, never commit to code
- Rotate tokens periodically for security
- Use environment-specific tokens when possible

#### Optional: CODECOV_TOKEN

**Purpose**: Upload test coverage reports to Codecov (optional but recommended)

**Setup Steps**:
1. Sign up at [codecov.io](https://codecov.io) with your GitHub account
2. Add your repository to Codecov
3. Copy the repository token from Codecov dashboard
4. Add as GitHub secret named `CODECOV_TOKEN`

## Environment Protection

The deployment workflow uses GitHub Environment protection:

1. **Configure Production Environment**:
   - Go to **Settings** > **Environments**
   - Create environment named `production`
   - Add protection rules:
     - Required reviewers (recommended)
     - Deployment branches: `main` only
     - Environment secrets: `RAILWAY_TOKEN`

2. **Benefits**:
   - Prevents accidental production deployments
   - Provides deployment approval workflow
   - Isolates production secrets

## Manual Deployment

For emergency deployments or testing:

```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Login with your token
railway login --token $RAILWAY_TOKEN

# Deploy current branch
railway up --service api

# Check deployment status
railway status

# View logs
railway logs
```

## Health Check Validation

The deployment includes comprehensive health checks:

```bash
# Test health endpoint
curl https://texas811-poc-production.up.railway.app/health

# Expected response
{
  "status": "healthy",
  "service": "Texas 811 POC API",
  "version": "1.0.0",
  "components": {
    "database": "connected",
    "redis": "available",
    "geocoding": "ready"
  }
}
```

## Troubleshooting Deployment

### Common Issues

**1. Railway Token Invalid**
```
Error: authentication failed
```
Solution: Regenerate Railway token and update GitHub secret

**2. Health Check Fails**
```
❌ Health check failed after 10 attempts
```
Solution: Check Railway logs for application errors:
```bash
railway logs --service api
```

**3. Build Failures**
```
Error: uv not found
```
Solution: Verify workflow uses correct Python/uv setup steps

**4. Deployment Timeout**
```
Error: deployment timed out
```
Solution: Check Railway dashboard for resource limits or scaling issues

### Debug Steps

1. **Check Workflow Logs**:
   - GitHub > Actions > Failed workflow
   - Review each step output
   - Look for error messages in deploy step

2. **Check Railway Logs**:
   ```bash
   railway logs --service api --lines 100
   ```

3. **Test Health Endpoint**:
   ```bash
   curl -v https://texas811-poc-production.up.railway.app/health
   ```

4. **Verify Environment Variables**:
   - Railway Dashboard > Project > Variables
   - Ensure all required variables are set

### Manual Recovery

If automated deployment fails:

```bash
# Emergency manual deployment
railway login --token $RAILWAY_TOKEN
railway up --service api --detach

# Force restart service
railway restart --service api

# Check status
railway status --json | jq '.deployment'
```

## Development Workflow

### Branch Strategy
- **Main branch**: Production deployments only
- **Feature branches**: Development and testing
- **Pull requests**: Required for main branch changes

### Deployment Process
1. Create feature branch
2. Develop and test locally
3. Create pull request to main
4. Code review and approval
5. Merge to main triggers deployment
6. Monitor deployment health checks
7. Verify production functionality

### Testing Deployment

Before merging to main:

```bash
# Run full test suite
python -m pytest tests/ -v --cov

# Test deployment workflow components
python -m pytest tests/test_deployment_workflow.py -v

# Validate health check
python -m pytest tests/test_deployment.py::test_health_check_endpoint -v
```

## Security Considerations

- **Secrets Management**: Never commit tokens or API keys to code
- **Environment Separation**: Use different Railway projects for staging/production
- **Access Control**: Limit Railway team access to necessary personnel
- **Token Rotation**: Regularly rotate deployment tokens
- **Audit Logging**: Monitor deployment logs for suspicious activity

## Support

For deployment issues:
- Check GitHub Actions logs for CI/CD failures
- Review Railway dashboard for application errors
- Consult Railway documentation for platform-specific issues
- Contact development team for application-specific problems
