# 🕐 Cron Job Setup Instructions

## Current Status
- ✅ **Database Tables**: All sentiment analysis tables are created
- ✅ **Cron Endpoint**: `/api/cron/sentiment-data` exists and is ready
- ❓ **Cron Jobs**: Need to be set up in Supabase

## Step 1: Check Current Cron Status

Run this in **Supabase SQL Editor**:
```sql
-- Check if pg_cron extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- List all active cron jobs
SELECT jobid, schedule, command, active, jobname FROM cron.job ORDER BY jobid;

-- Check recent executions
SELECT j.jobname, jrd.status, jrd.return_message, jrd.start_time 
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
ORDER BY jrd.start_time DESC LIMIT 10;
```

## Step 2: Set Up Secrets in Supabase Vault

1. Go to: **https://supabase.com/dashboard/project/yfqdtjwgvsixnhyseqbi/settings/vault**
2. Add these secrets:
   - **Name**: `base_url` **Value**: `https://your-vercel-app.vercel.app` (replace with your actual Vercel URL)
   - **Name**: `cron_secret` **Value**: Generate a strong random string (e.g., `cron_secret_abc123xyz789`)

## Step 3: Create the Cron Job

Run this in **Supabase SQL Editor**:
```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any existing job (to avoid duplicates)
SELECT cron.unschedule('daily-sentiment-fetch');

-- Schedule daily sentiment data collection at 6 AM UTC
SELECT cron.schedule(
  'daily-sentiment-fetch',
  '0 6 * * *', -- Daily at 6 AM UTC
  $$
  SELECT net.http_post(
    url := vault.read_secret('base_url') || '/api/cron/sentiment-data',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || vault.read_secret('cron_secret')
    ),
    body := jsonb_build_object()
  );
  $$
);
```

## Step 4: Update Your Environment Variables

Add the cron secret to your Vercel environment variables:
```bash
CRON_SECRET=cron_secret_abc123xyz789  # Same value as in Supabase Vault
```

## Step 5: Test the Setup

### Manual Test (Optional)
You can manually trigger the cron job for testing:
```sql
-- Manually execute the cron job once
SELECT net.http_post(
  url := vault.read_secret('base_url') || '/api/cron/sentiment-data',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || vault.read_secret('cron_secret')
  ),
  body := jsonb_build_object()
);
```

### Check Results
```sql
-- Check if data was inserted
SELECT COUNT(*) as total_posts FROM reddit_posts_raw;
SELECT COUNT(*) as total_comments FROM reddit_comments;
SELECT COUNT(*) as sentiment_records FROM sentiment_data;

-- Check recent data
SELECT ticker, sentiment_score, mention_count, created_at 
FROM sentiment_data 
ORDER BY created_at DESC LIMIT 10;
```

## What the Cron Job Does

Every day at 6 AM UTC, the cron job will:

1. **Fetch Reddit Posts** (~100 posts from investment subreddits)
2. **Fetch Reddit Comments** (for high-engagement posts with 5+ comments)
3. **AI Sentiment Analysis** (using Gemini Flash to analyze sentiment)
4. **Save to Database**:
   - Raw posts → `reddit_posts_raw` table
   - Raw comments → `reddit_comments` table  
   - Processed sentiment → `sentiment_data` table
   - Top posts → `reddit_posts` table (for UI)
5. **Cleanup Old Data** (removes data older than 30 days)

## Monitoring

- **Supabase Dashboard**: Check the cron job execution history
- **Vercel Logs**: Monitor the `/api/cron/sentiment-data` endpoint
- **Database**: Query the tables to see fresh data

## Next Steps

1. Run the status check SQL to see current state
2. Set up the Supabase Vault secrets  
3. Create the cron job
4. Add environment variable to Vercel
5. Wait for 6 AM UTC or manually test

The system is ready - just needs the final cron job configuration! 🚀
