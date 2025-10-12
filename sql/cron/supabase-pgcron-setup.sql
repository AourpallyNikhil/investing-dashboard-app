-- Complete pg_cron initialization for Supabase
-- Run these commands step by step in your Supabase SQL Editor

-- Step 1: Enable the pg_cron extension (should already be done)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Grant necessary permissions to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Step 3: Check if pg_cron scheduler is running
SELECT
  pid AS process_id,
  usename AS database_user,
  application_name,
  backend_start AS when_process_began,
  wait_event_type,
  state,
  query,
  backend_type
FROM pg_stat_activity
WHERE application_name ILIKE 'pg_cron scheduler';

-- If the above query returns no rows, the scheduler is not active
-- In that case, you may need to restart your Supabase instance

-- Step 4: Test if cron functions are available
-- This should work if pg_cron is properly initialized
SELECT cron.schedule(
  'test_job',
  '* * * * *',
  $$ SELECT now() $$
);

-- Step 5: Check if the test job was created
SELECT jobid, schedule, command, active, jobname 
FROM cron.job 
WHERE jobname = 'test_job';

-- Step 6: Check job execution (wait a minute, then run this)
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'test_job')
ORDER BY start_time DESC
LIMIT 5;

-- Step 7: Remove the test job
SELECT cron.unschedule('test_job');


