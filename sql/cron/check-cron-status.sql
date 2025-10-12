-- Check current status of pg_cron jobs
-- Execute this to see if cron jobs are running

-- Check if pg_cron extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- List all active cron jobs
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
ORDER BY jobid;

-- Check recent cron job executions
SELECT 
  j.jobname,
  jrd.runid,
  jrd.job_pid,
  jrd.status,
  jrd.return_message,
  jrd.start_time,
  jrd.end_time,
  EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) as duration_seconds
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
ORDER BY jrd.start_time DESC
LIMIT 20;

-- Check Supabase Vault secrets (this will show if secrets exist, not their values)
SELECT name FROM vault.secrets WHERE name IN ('base_url', 'cron_secret');

-- Test if we can make HTTP requests (check net extension)
SELECT * FROM pg_extension WHERE extname = 'http';


