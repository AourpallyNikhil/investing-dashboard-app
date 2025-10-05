-- Improve ticker extraction and exclude GENERAL
-- Run this to update the view with better ticker extraction

-- ========================================
-- 1. UPDATE VIEW WITH BETTER TICKER EXTRACTION
-- ========================================

-- Drop and recreate view with improved ticker extraction
DROP VIEW IF EXISTS public.v_post_sentiment;
CREATE VIEW public.v_post_sentiment AS

-- Reddit posts with improved ticker extraction
SELECT
  'reddit'::text as source,
  r.post_id::text as post_id,
  r.author as author_id,
  -- Improved ticker extraction from Reddit titles and content
  COALESCE(
    -- First try explicit cashtags ($TICKER)
    (SELECT upper(matches[1]) 
     FROM regexp_matches(r.title || ' ' || COALESCE(r.selftext, ''), '\$([A-Z]{2,5})\b', 'gi') AS matches 
     WHERE length(matches[1]) BETWEEN 2 AND 5
       AND matches[1] NOT IN ('THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD', 'HER', 'WAS', 'ONE', 'NOW', 'GET', 'WHO', 'HOW', 'NEW', 'OLD', 'SEE', 'TWO', 'USE')
     LIMIT 1),
    -- Then try common stock patterns (TICKER stock, TICKER earnings, etc.)
    (SELECT upper(matches[1])
     FROM regexp_matches(r.title || ' ' || COALESCE(r.selftext, ''), '\b([A-Z]{2,5})\s+(stock|earnings|calls|puts|options|price|target|analysis|DD|YOLO)\b', 'gi') AS matches
     WHERE length(matches[1]) BETWEEN 2 AND 5
       AND matches[1] NOT IN ('THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD', 'HER', 'WAS', 'ONE', 'NOW', 'GET', 'WHO', 'HOW', 'NEW', 'OLD', 'SEE', 'TWO', 'USE', 'STOCK', 'CALL', 'PUTS')
     LIMIT 1),
    -- Finally try standalone tickers in investment subreddits (more risky)
    CASE 
      WHEN r.subreddit IN ('wallstreetbets', 'stocks', 'investing', 'SecurityAnalysis', 'ValueInvesting', 'StockMarket') THEN
        (SELECT upper(matches[1])
         FROM regexp_matches(r.title, '\b([A-Z]{3,5})\b', 'g') AS matches
         WHERE length(matches[1]) BETWEEN 3 AND 5
           AND matches[1] NOT IN ('THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD', 'HER', 'WAS', 'ONE', 'NOW', 'GET', 'WHO', 'HOW', 'NEW', 'OLD', 'SEE', 'TWO', 'USE', 'WSB', 'GME', 'AMC', 'YOLO', 'HODL', 'MOON', 'APE', 'BUY', 'SELL')
         LIMIT 1)
      ELSE NULL
    END
  ) as ticker,
  to_timestamp(r.created_utc) as created_at,
  0.0 as sentiment_score,
  COALESCE(r.score, 0) as upvotes,
  COALESCE(r.num_comments, 0) as comments,
  r.upvote_ratio,
  r.subreddit,
  1.0::real as weight
FROM public.reddit_posts_raw r
WHERE to_timestamp(r.created_utc) > NOW() - INTERVAL '30 days'
  AND r.score >= 0

UNION ALL

-- Twitter posts with improved ticker extraction
SELECT
  'twitter'::text as source,
  t.tweet_id::text as post_id,
  COALESCE(t.author_username, t.author_id)::text as author_id,
  -- Extract ticker from Twitter cashtags or text
  COALESCE(
    -- First try cashtags array
    CASE WHEN array_length(t.cashtags, 1) > 0 THEN upper(t.cashtags[1]) ELSE NULL END,
    -- Then try cashtags in text
    (SELECT upper(matches[1]) 
     FROM regexp_matches(t.text, '\$([A-Z]{2,5})\b', 'gi') AS matches 
     WHERE length(matches[1]) BETWEEN 2 AND 5
       AND matches[1] NOT IN ('THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD', 'HER', 'WAS', 'ONE')
     LIMIT 1)
  ) as ticker,
  t.created_at,
  0.0 as sentiment_score,
  COALESCE(t.like_count, 0) as upvotes,
  COALESCE(t.reply_count, 0) as comments,
  NULL::numeric as upvote_ratio,
  NULL::text as subreddit,
  1.1::real as weight -- Twitter gets slight boost
FROM public.twitter_posts_raw t
WHERE t.created_at > NOW() - INTERVAL '30 days';

-- ========================================
-- 2. REFRESH AGGREGATIONS (EXCLUDE GENERAL)
-- ========================================

-- Clear old aggregations
DELETE FROM public.sentiment_aggregations WHERE ticker = 'GENERAL' OR calculated_at < NOW() - INTERVAL '2 hours';

-- Run new aggregation with improved tickers (exclude NULL tickers)
WITH w24 AS (
  SELECT 
    date_trunc('hour', now() - interval '24 hours') as start_ts,
    date_trunc('hour', now()) as end_ts
)
INSERT INTO public.sentiment_aggregations
  (ticker, aggregation_period, period_start, period_end,
   total_mentions, unique_posts, unique_authors,
   avg_sentiment, weighted_sentiment, sentiment_std_dev,
   total_upvotes, total_comments, avg_upvote_ratio,
   source_breakdown, subreddit_breakdown)
SELECT
  ps.ticker,
  '24h' as aggregation_period,
  w24.start_ts, 
  w24.end_ts,
  count(*)::int as total_mentions,
  count(distinct ps.post_id)::int as unique_posts,
  count(distinct ps.author_id)::int as unique_authors,
  0.0 as avg_sentiment,
  0.0 as weighted_sentiment,
  0.0 as sentiment_std_dev,
  coalesce(sum(ps.upvotes),0)::int as total_upvotes,
  coalesce(sum(ps.comments),0)::int as total_comments,
  round(avg(ps.upvote_ratio)::numeric, 2) as avg_upvote_ratio,
  -- Source breakdown
  jsonb_build_object(
    'reddit', jsonb_build_object(
      'mentions', sum(case when ps.source='reddit' then 1 else 0 end),
      'avg_sentiment', 0.0
    ),
    'twitter', jsonb_build_object(
      'mentions', sum(case when ps.source='twitter' then 1 else 0 end),
      'avg_sentiment', 0.0
    )
  ) as source_breakdown,
  '{}'::jsonb as subreddit_breakdown
FROM public.v_post_sentiment ps
CROSS JOIN w24
WHERE ps.created_at >= w24.start_ts 
  AND ps.created_at < w24.end_ts
  AND ps.ticker IS NOT NULL  -- Exclude posts without tickers
  AND ps.ticker != ''        -- Exclude empty tickers
GROUP BY ps.ticker, w24.start_ts, w24.end_ts
HAVING count(*) >= 1
ON CONFLICT (ticker, aggregation_period, period_start) 
DO UPDATE SET
  total_mentions = EXCLUDED.total_mentions,
  unique_posts = EXCLUDED.unique_posts,
  unique_authors = EXCLUDED.unique_authors,
  total_upvotes = EXCLUDED.total_upvotes,
  total_comments = EXCLUDED.total_comments,
  source_breakdown = EXCLUDED.source_breakdown,
  calculated_at = NOW();

-- ========================================
-- 3. SHOW RESULTS
-- ========================================

-- Show updated aggregations
SELECT 
  ticker, 
  total_mentions,
  unique_posts,
  unique_authors,
  total_upvotes,
  source_breakdown->'reddit'->>'mentions' as reddit_mentions,
  source_breakdown->'twitter'->>'mentions' as twitter_mentions,
  calculated_at
FROM public.sentiment_aggregations 
WHERE aggregation_period = '24h'
ORDER BY total_mentions DESC;

-- Show sample posts from view to verify ticker extraction
SELECT 
  'Sample extracted tickers:' as info,
  string_agg(DISTINCT ticker, ', ') as tickers_found
FROM public.v_post_sentiment 
WHERE ticker IS NOT NULL;

SELECT 
  source, ticker, author_id, upvotes, comments, 
  CASE WHEN subreddit IS NOT NULL THEN subreddit ELSE 'twitter' END as platform
FROM public.v_post_sentiment 
WHERE ticker IS NOT NULL
ORDER BY upvotes DESC
LIMIT 10;



































