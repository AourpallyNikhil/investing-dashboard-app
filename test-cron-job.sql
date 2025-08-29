-- Test the sentiment data cron job manually
-- Run this to trigger the job immediately (for testing)

-- Manual test of the HTTP call
SELECT net.http_post(
  url := vault.read_secret('base_url') || '/api/cron/sentiment-data',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || vault.read_secret('cron_secret')
  ),
  body := jsonb_build_object()
);

-- Check if data was inserted after the test
SELECT COUNT(*) as total_posts FROM reddit_posts_raw;
SELECT COUNT(*) as total_comments FROM reddit_comments;
SELECT COUNT(*) as sentiment_records FROM sentiment_data;

-- View recent sentiment data
SELECT 
  ticker, 
  sentiment_score, 
  sentiment_label,
  mention_count, 
  created_at 
FROM sentiment_data 
ORDER BY created_at DESC 
LIMIT 10;

-- Check recent Reddit posts
SELECT 
  title, 
  subreddit, 
  score, 
  num_comments,
  array_length(extracted_tickers, 1) as ticker_count,
  retrieved_at
FROM reddit_posts_raw 
ORDER BY retrieved_at DESC 
LIMIT 5;
