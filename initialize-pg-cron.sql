-- Initialize pg_cron properly in Supabase
-- Run this first to set up the cron system

-- Enable pg_cron extension (should already be done)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable http extension for making HTTP requests
CREATE EXTENSION IF NOT EXISTS http;

-- Grant permissions to postgres user for cron operations
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Initialize cron if not already done (this creates the cron.job table)
-- This might need to be done by Supabase support, but let's try
DO $$
BEGIN
  -- Check if cron schema exists and create basic structure if needed
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'cron' AND table_name = 'job') THEN
    RAISE NOTICE 'Cron tables do not exist. This may need to be enabled by Supabase support.';
  END IF;
END $$;

-- Test if we can access cron functions
SELECT cron.schedule('test-job', '* * * * *', 'SELECT 1;');
SELECT cron.unschedule('test-job');

