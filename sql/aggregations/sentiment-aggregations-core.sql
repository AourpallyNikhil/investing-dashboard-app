-- Sentiment Aggregations System - Core Setup (No Cron)
-- Run this first to set up the basic system
-- Run this in Supabase SQL Editor

-- ========================================
-- 1. CREATE SENTIMENT_AGGREGATIONS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS public.sentiment_aggregations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Aggregation keys
  ticker VARCHAR(10) NOT NULL,
  aggregation_period VARCHAR(10) NOT NULL, -- '24h', '7d', '30d'
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Core metrics
  total_mentions INTEGER NOT NULL DEFAULT 0,
  unique_posts INTEGER NOT NULL DEFAULT 0,
  unique_authors INTEGER NOT NULL DEFAULT 0,
  
  -- Sentiment metrics
  avg_sentiment DECIMAL(5,3), -- Average sentiment score
  weighted_sentiment DECIMAL(5,3), -- Weighted by engagement
  sentiment_std_dev DECIMAL(5,3), -- Standard deviation
  
  -- Engagement metrics
  total_upvotes INTEGER DEFAULT 0,
  total_comments INTEGER DEFAULT 0,
  avg_upvote_ratio DECIMAL(3,2),
  
  -- Source breakdown
  source_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb, -- Reddit vs Twitter breakdown
  subreddit_breakdown JSONB DEFAULT '{}'::jsonb, -- Per-subreddit data
  
  -- Trend analysis
  sentiment_trend VARCHAR(10), -- 'up', 'down', 'flat'
  momentum_score DECIMAL(5,3), -- Change momentum
  
  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint for upserts
  UNIQUE(ticker, aggregation_period, period_start)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sentiment_agg_ticker_period ON public.sentiment_aggregations(ticker, aggregation_period);
CREATE INDEX IF NOT EXISTS idx_sentiment_agg_period_start ON public.sentiment_aggregations(period_start DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_agg_calculated_at ON public.sentiment_aggregations(calculated_at DESC);

-- ========================================
-- 2. CREATE NORMALIZED POST VIEW
-- ========================================

-- This view unifies Reddit and Twitter posts into a single queryable format
CREATE OR REPLACE VIEW public.v_post_sentiment AS
SELECT
  'reddit'::text as source,
  r.post_id::text as post_id,
  r.author as author_id,
  COALESCE(ticker_data.ticker, 'UNKNOWN') as ticker,
  to_timestamp(r.created_utc) as created_at,
  0.0 as sentiment_score, -- Will be populated later by AI analysis
  COALESCE(r.score, 0) as upvotes,
  COALESCE(r.num_comments, 0) as comments,
  r.upvote_ratio,
  r.subreddit,
  -- Weight: recency * engagement (Reddit formula)
  (exp(-extract(epoch from (now() - to_timestamp(r.created_utc)))/43200.0) * 
   log(1 + GREATEST(r.score, 0) + 0.5 * GREATEST(r.num_comments, 0)))::real as weight
FROM public.reddit_posts_raw r
CROSS JOIN LATERAL (
  -- Extract tickers from title and selftext using regex
  SELECT unnest(
    COALESCE(
      (SELECT array_agg(DISTINCT upper(matches[1])) 
       FROM regexp_matches(r.title || ' ' || COALESCE(r.selftext, ''), '\$([A-Z]{1,5})\b', 'g') AS matches
       WHERE length(matches[1]) BETWEEN 1 AND 5
         AND matches[1] NOT IN ('THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD', 'HER', 'WAS', 'ONE')
      ),
      ARRAY['UNKNOWN']
    )
  ) as ticker
) ticker_data
WHERE to_timestamp(r.created_utc) > NOW() - INTERVAL '35 days' -- Keep reasonable window

UNION ALL

SELECT
  'twitter'::text,
  t.tweet_id::text,
  COALESCE(t.author_id, t.author_username),
  COALESCE(ticker_data.ticker, 'UNKNOWN'),
  t.created_at,
  0.0, -- Will be populated later by AI analysis
  COALESCE(t.like_count, 0), -- Map to "upvotes"
  COALESCE(t.reply_count, 0), -- Map to "comments"
  NULL::numeric, -- No upvote ratio for Twitter
  NULL::text, -- No subreddit for Twitter
  -- Weight: Twitter gets slight boost, includes retweets
  (1.1 * exp(-extract(epoch from (now() - t.created_at))/43200.0) *
   log(1 + GREATEST(t.like_count, 0) + 2 * GREATEST(t.retweet_count, 0) + 0.5 * GREATEST(t.reply_count, 0)))::real
FROM public.twitter_posts_raw t
CROSS JOIN LATERAL (
  SELECT unnest(COALESCE(t.cashtags, ARRAY['UNKNOWN'])) as ticker
) ticker_data
WHERE t.created_at > NOW() - INTERVAL '35 days';

-- ========================================
-- 3. SIMPLE AGGREGATION FUNCTION
-- ========================================

-- Master function to refresh all sentiment aggregations
CREATE OR REPLACE FUNCTION public.refresh_sentiment_aggregations()
RETURNS TABLE(result_summary text) AS $$
BEGIN
  -- 24-hour aggregations
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
    round(avg(ps.sentiment_score)::numeric, 3) as avg_sentiment,
    round((sum(ps.weight * ps.sentiment_score) / nullif(sum(ps.weight),0))::numeric, 3) as weighted_sentiment,
    round(stddev_pop(ps.sentiment_score)::numeric, 3) as sentiment_std_dev,
    coalesce(sum(ps.upvotes),0)::int as total_upvotes,
    coalesce(sum(ps.comments),0)::int as total_comments,
    round(avg(ps.upvote_ratio)::numeric, 2) as avg_upvote_ratio,
    -- Source breakdown
    jsonb_build_object(
      'reddit', jsonb_build_object(
        'mentions', sum(case when ps.source='reddit' then 1 else 0 end),
        'avg_sentiment', round(avg(case when ps.source='reddit' then ps.sentiment_score end)::numeric,3)
      ),
      'twitter', jsonb_build_object(
        'mentions', sum(case when ps.source='twitter' then 1 else 0 end),
        'avg_sentiment', round(avg(case when ps.source='twitter' then ps.sentiment_score end)::numeric,3)
      )
    ) as source_breakdown,
    -- Subreddit breakdown (only for Reddit posts)
    jsonb_object_agg(ps.subreddit, count(*)) filter (where ps.subreddit is not null) as subreddit_breakdown
  FROM public.v_post_sentiment ps
  CROSS JOIN w24
  WHERE ps.created_at >= w24.start_ts 
    AND ps.created_at < w24.end_ts
    AND ps.ticker != 'UNKNOWN'
  GROUP BY ps.ticker, w24.start_ts, w24.end_ts
  HAVING count(*) >= 2 -- Only include tickers with at least 2 mentions
  ON CONFLICT (ticker, aggregation_period, period_start) 
  DO UPDATE SET
    period_end = EXCLUDED.period_end,
    total_mentions = EXCLUDED.total_mentions,
    unique_posts = EXCLUDED.unique_posts,
    unique_authors = EXCLUDED.unique_authors,
    avg_sentiment = EXCLUDED.avg_sentiment,
    weighted_sentiment = EXCLUDED.weighted_sentiment,
    sentiment_std_dev = EXCLUDED.sentiment_std_dev,
    total_upvotes = EXCLUDED.total_upvotes,
    total_comments = EXCLUDED.total_comments,
    avg_upvote_ratio = EXCLUDED.avg_upvote_ratio,
    source_breakdown = EXCLUDED.source_breakdown,
    subreddit_breakdown = COALESCE(sentiment_aggregations.subreddit_breakdown,'{}'::jsonb) 
                          || COALESCE(EXCLUDED.subreddit_breakdown,'{}'::jsonb),
    calculated_at = NOW();

  RETURN QUERY SELECT '24h aggregations completed'::text;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. RUN INITIAL POPULATION
-- ========================================

-- Populate the table with initial data
SELECT * FROM public.refresh_sentiment_aggregations();

-- ========================================
-- 5. VERIFICATION QUERIES
-- ========================================

-- Check if data was populated
SELECT 
  'Data Check: ' || count(*)::text || ' aggregation records created' as status
FROM public.sentiment_aggregations;

-- Show sample data
SELECT 
  ticker, 
  aggregation_period, 
  total_mentions, 
  round(avg_sentiment::numeric, 3) as avg_sentiment,
  source_breakdown->'reddit'->>'mentions' as reddit_mentions,
  source_breakdown->'twitter'->>'mentions' as twitter_mentions,
  calculated_at
FROM public.sentiment_aggregations 
ORDER BY total_mentions DESC 
LIMIT 5;
