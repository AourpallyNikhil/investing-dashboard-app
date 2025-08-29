-- Setup Supabase pg_cron jobs for sentiment data collection
-- Execute this in Supabase SQL Editor: https://supabase.com/dashboard/project/yfqdtjwgvsixnhyseqbi/sql

-- First, enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant necessary permissions to the postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Check if cron jobs already exist
SELECT * FROM cron.job WHERE jobname = 'daily-sentiment-fetch';

-- Remove existing job if it exists (to avoid duplicates)
SELECT cron.unschedule('daily-sentiment-fetch');

-- Set up secrets in Supabase Vault (you'll need to do this manually in the dashboard)
-- Go to: https://supabase.com/dashboard/project/yfqdtjwgvsixnhyseqbi/settings/vault
-- Add these secrets:
-- 1. base_url: https://your-vercel-app.vercel.app (replace with your actual Vercel URL)
-- 2. cron_secret: generate a random string for authentication

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

-- Verify the cron job was created
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job 
WHERE jobname = 'daily-sentiment-fetch';

-- Check cron job history (if any executions have run)
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'daily-sentiment-fetch')
ORDER BY start_time DESC
LIMIT 10;
