-- Create the production sentiment data cron job
-- Run this in Supabase SQL Editor after setting up Vault secrets

-- First, you need to set up these secrets in Supabase Vault:
-- Go to: https://supabase.com/dashboard/project/yfqdtjwgvsixnhyseqbi/settings/vault
-- Add:
-- 1. Name: base_url, Value: https://your-vercel-app.vercel.app
-- 2. Name: cron_secret, Value: a-secure-random-string-123

-- Remove any existing sentiment job (to avoid duplicates)
SELECT cron.unschedule('daily-sentiment-fetch');

-- Create the daily sentiment data collection job (6 AM UTC)
SELECT cron.schedule(
  'daily-sentiment-fetch',
  '0 6 * * *', -- Every day at 6:00 AM UTC
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
  active,
  jobname
FROM cron.job 
WHERE jobname = 'daily-sentiment-fetch';

-- Check if vault secrets exist (this shows secret names, not values)
SELECT name FROM vault.secrets WHERE name IN ('base_url', 'cron_secret');
