# Cloud-Based Cron Job Setup

This guide helps you set up the sentiment analysis cron job to run reliably in the cloud, even when your computer is asleep.

## Option 1: GitHub Actions (Recommended - Free)

### Setup Steps:

1. **Add Repository Secrets**:
   - Go to your GitHub repository
   - Navigate to Settings → Secrets and variables → Actions
   - Add these secrets:
     ```
     BASE_URL=https://your-app-domain.vercel.app
     CRON_SECRET=your_secure_secret_here
     ```

2. **Enable GitHub Actions**:
   - The workflow file is already created at `.github/workflows/daily-sentiment-analysis.yml`
   - It will run automatically daily at 9:00 AM UTC
   - You can also trigger it manually from the Actions tab

3. **Monitor Execution**:
   - Go to Actions tab in your GitHub repository
   - View logs and download artifacts for debugging

### Advantages:
- ✅ **Free** for public repositories
- ✅ **Reliable** - runs on GitHub's infrastructure
- ✅ **Easy to monitor** - logs available in GitHub UI
- ✅ **Version controlled** - workflow is part of your codebase

## Option 2: Vercel Cron Jobs (Easiest)

### Setup Steps:

1. **Deploy to Vercel**:
   ```bash
   npm install -g vercel
   vercel
   ```

2. **Configure Environment Variables**:
   - In Vercel dashboard, go to your project settings
   - Add environment variables:
     ```
     CRON_SECRET=your_secure_secret_here
     ```

3. **Deploy with Cron Configuration**:
   - The `vercel.json` file is already configured
   - Vercel will automatically set up the cron job
   - It calls your existing `/api/cron/sentiment-data` endpoint

### Advantages:
- ✅ **Easiest setup** - uses your existing API endpoint
- ✅ **Integrated** - runs on the same platform as your app
- ✅ **Automatic scaling** - Vercel handles infrastructure
- ✅ **Built-in monitoring** - logs available in Vercel dashboard

## Option 3: Railway Cron Jobs

### Setup Steps:

1. **Create Railway Account**:
   - Go to [railway.app](https://railway.app)
   - Connect your GitHub repository

2. **Deploy Cron Service**:
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login and deploy
   railway login
   railway up
   ```

3. **Configure Environment Variables**:
   - In Railway dashboard, add:
     ```
     BASE_URL=https://your-app-domain.vercel.app
     CRON_SECRET=your_secure_secret_here
     REQUEST_TIMEOUT=2700
     ```

### Advantages:
- ✅ **Dedicated cron service** - separate from your main app
- ✅ **Flexible scheduling** - easy to modify timing
- ✅ **Resource isolation** - doesn't affect your main app performance
- ✅ **Simple pricing** - pay only for what you use

## Option 4: Keep Computer Awake (Local Alternative)

If you prefer to keep using your local setup:

### macOS:
```bash
# Prevent sleep while plugged in
sudo pmset -c sleep 0

# Or use caffeinate to keep awake during specific times
# Add this to a script that runs before 9 AM:
caffeinate -s -t 3600  # Keep awake for 1 hour
```

### Create a "Keep Awake" Script:
```bash
#!/bin/bash
# save as keep_awake_for_cron.sh

# Run this at 8:50 AM to ensure computer is awake at 9:00 AM
caffeinate -s -t 1200 &  # Keep awake for 20 minutes
echo "Computer will stay awake for cron job execution"
```

Add to crontab:
```bash
50 8 * * * /path/to/keep_awake_for_cron.sh
```

## Recommended Approach

**For Production**: Use **Vercel Cron Jobs** (Option 2)
- Simplest setup since you're likely already using Vercel
- Uses your existing API endpoint
- No additional infrastructure to manage

**For Development/Testing**: Use **GitHub Actions** (Option 1)
- Free and reliable
- Good for testing before production deployment
- Version controlled workflow

## Migration Steps

1. **Choose your preferred option** from above
2. **Update your application URL** in the configuration to use your production domain instead of `localhost:3000`
3. **Test the setup** by triggering a manual run
4. **Disable the local cron job** once cloud version is working:
   ```bash
   crontab -e
   # Comment out or remove the local cron job line
   ```
5. **Monitor the first few runs** to ensure everything works correctly

## Troubleshooting

- **Check logs** in your chosen platform's dashboard
- **Verify environment variables** are set correctly
- **Test the API endpoint** manually to ensure it's accessible
- **Check timezone settings** - most services use UTC by default

Choose the option that best fits your workflow and infrastructure preferences!
