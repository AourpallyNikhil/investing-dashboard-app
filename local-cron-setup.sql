-- Local development cron setup for sentiment data collection
-- Since you're running the app locally, we have a few options:

-- Option 1: Use ngrok or similar tunnel service
-- If you're using ngrok to expose your local app:
-- 1. Start your local app: npm run dev (usually runs on http://localhost:3000)
-- 2. Start ngrok: ngrok http 3000
-- 3. Use the ngrok URL (e.g., https://abc123.ngrok.io) as your base_url

-- Option 2: Use a public staging/test deployment
-- Deploy to Vercel for testing purposes and use that URL

-- Option 3: Manual testing approach (Recommended for local dev)
-- Skip the automated cron and run the endpoint manually when needed

-- For now, let's set up manual testing:
-- You can call your local endpoint directly from the database

-- Remove any existing cron job
SELECT cron.unschedule('daily-sentiment-fetch');

-- Manual trigger query (modify the URL to match your setup)
-- Replace 'http://localhost:3000' with your actual local URL
-- You'll need to add a CRON_SECRET to your .env.local file first

-- Example manual trigger (don't run this yet - need to set up secrets first):
/*
SELECT net.http_post(
  url := 'http://localhost:3000/api/cron/sentiment-data',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer your-local-cron-secret'
  ),
  body := jsonb_build_object()
);
*/

-- Check current vault secrets
SELECT name FROM vault.secrets WHERE name IN ('base_url', 'cron_secret');

-- For local development, you might want to create a test secret:
-- Go to Supabase Vault and add:
-- Name: local_cron_secret, Value: test-secret-123

