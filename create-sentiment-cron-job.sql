-- Create the production sentiment data cron job (No Vault Required)
-- Run this in Supabase SQL Editor after Railway deployment is complete

-- IMPORTANT: Replace these values with your actual Railway URL and cron secret:
-- 1. Replace 'YOUR_RAILWAY_URL_HERE' with your actual Railway app URL
-- 2. The cron secret is already set: R+4asd5JITElFBC59X/jsMkJEkOcq30B7a72i1vlkFg=

-- Remove any existing sentiment job (to avoid duplicates)
SELECT cron.unschedule('daily-sentiment-fetch');

-- Create the daily sentiment data collection job (6 AM UTC)
SELECT cron.schedule(
  'daily-sentiment-fetch',
  '0 6 * * *', -- Every day at 6:00 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://investing-dashboard-app-production.up.railway.app/api/cron/sentiment-data',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer R+4asd5JITElFBC59X/jsMkJEkOcq30B7a72i1vlkFg='
    ),
    body := jsonb_build_object()
  );
  $$
);

-- Verify the cron job was created
SELECT 
  jobid,
  schedule,
  command,
  active,
  jobname
FROM cron.job 
WHERE jobname = 'daily-sentiment-fetch';
