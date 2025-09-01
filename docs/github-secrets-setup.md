# GitHub Secrets Setup for CI/CD Pipeline

## Required Secrets

### RAILWAY_TOKEN

The GitHub Actions workflow requires a Railway authentication token to deploy the application.

#### How to Get Your Railway Token

1. **Login to Railway Dashboard**
   - Go to [railway.app](https://railway.app)
   - Sign in to your account

2. **Access Account Settings**
   - Click on your profile in the top right
   - Select "Account Settings"

3. **Generate API Token**
   - Navigate to the "Tokens" tab
   - Click "Create Token"
   - Give it a descriptive name like "GitHub Actions CI/CD"
   - Copy the generated token (you won't see it again!)

#### How to Add the Secret to GitHub

1. **Go to Your Repository**
   - Navigate to your GitHub repository
   - Click on "Settings" tab

2. **Access Secrets and Variables**
   - In the left sidebar, click "Secrets and variables"
   - Click "Actions"

3. **Add New Repository Secret**
   - Click "New repository secret"
   - Name: `RAILWAY_TOKEN`
   - Value: Paste your Railway API token
   - Click "Add secret"

#### Alternative: Using Railway CLI

You can also get your token via the Railway CLI:

```bash
# Login if not already logged in
railway login

# Get your auth token
railway auth

# This will display your token that you can copy
```

## Verification

Once you've added the secret:

1. The GitHub Actions workflow will automatically trigger on pushes to the `main` branch
2. You can verify the secret is working by checking the "Actions" tab in your repository
3. The deployment job should complete successfully if the token is correct

## Security Notes

- **Never commit tokens to your repository**
- **Use GitHub repository secrets for sensitive data**
- **Regularly rotate your API tokens**
- **Limit token permissions to only what's needed**

## Troubleshooting

### "Invalid token" Error
- Verify the token was copied correctly (no extra spaces)
- Check that the token hasn't expired
- Regenerate a new token if needed

### "Permission denied" Error
- Ensure your Railway account has access to the project
- Check that the project exists and is properly configured

### Deployment URL Not Found
- Verify your Railway service is named "api" (as configured in railway.json)
- Check that the service has a domain or public URL configured
