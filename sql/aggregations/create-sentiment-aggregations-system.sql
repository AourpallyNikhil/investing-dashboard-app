-- Sentiment Aggregations System
-- This creates a production-ready sentiment aggregation system with time-series tracking
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
  COALESCE(r.sentiment_score, 0.0) as sentiment_score, -- [-1,1]
  COALESCE(r.score, 0) as upvotes,
  COALESCE(r.num_comments, 0) as comments,
  r.upvote_ratio,
  r.subreddit,
  -- Weight: recency * engagement (Reddit formula)
  (exp(-extract(epoch from (now() - to_timestamp(r.created_utc)))/43200.0) * 
   log(1 + GREATEST(r.score, 0) + 0.5 * GREATEST(r.num_comments, 0)))::real as weight
FROM public.reddit_posts_raw r
CROSS JOIN LATERAL (
  SELECT unnest(COALESCE(r.extracted_tickers, ARRAY['UNKNOWN'])) as ticker
) ticker_data
WHERE r.created_at > NOW() - INTERVAL '35 days' -- Keep reasonable window

UNION ALL

SELECT
  'twitter'::text,
  t.tweet_id::text,
  COALESCE(t.author_id, t.author_username),
  COALESCE(ticker_data.ticker, 'UNKNOWN'),
  t.created_at,
  COALESCE(t.sentiment_score, 0.0),
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
-- 3. UPSERT FUNCTIONS FOR AGGREGATIONS
-- ========================================

-- Function to upsert 24-hour aggregations
CREATE OR REPLACE FUNCTION public.upsert_sentiment_24h()
RETURNS void AS $$
BEGIN
  WITH w AS (
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
    w.start_ts, 
    w.end_ts,
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
  CROSS JOIN w
  WHERE ps.created_at >= w.start_ts 
    AND ps.created_at < w.end_ts
    AND ps.ticker != 'UNKNOWN'
  GROUP BY ps.ticker, w.start_ts, w.end_ts
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
END;
$$ LANGUAGE plpgsql;

-- Function to upsert 7-day aggregations
CREATE OR REPLACE FUNCTION public.upsert_sentiment_7d()
RETURNS void AS $$
BEGIN
  WITH w AS (
    SELECT 
      date_trunc('day', now() - interval '7 days') as start_ts,
      date_trunc('day', now()) as end_ts
  )
  INSERT INTO public.sentiment_aggregations
    (ticker, aggregation_period, period_start, period_end,
     total_mentions, unique_posts, unique_authors,
     avg_sentiment, weighted_sentiment, sentiment_std_dev,
     total_upvotes, total_comments, avg_upvote_ratio,
     source_breakdown, subreddit_breakdown)
  SELECT
    ps.ticker,
    '7d' as aggregation_period,
    w.start_ts, 
    w.end_ts,
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
  CROSS JOIN w
  WHERE ps.created_at >= w.start_ts 
    AND ps.created_at < w.end_ts
    AND ps.ticker != 'UNKNOWN'
  GROUP BY ps.ticker, w.start_ts, w.end_ts
  HAVING count(*) >= 3 -- Require more mentions for 7d window
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
END;
$$ LANGUAGE plpgsql;

-- Function to upsert 30-day aggregations
CREATE OR REPLACE FUNCTION public.upsert_sentiment_30d()
RETURNS void AS $$
BEGIN
  WITH w AS (
    SELECT 
      date_trunc('day', now() - interval '30 days') as start_ts,
      date_trunc('day', now()) as end_ts
  )
  INSERT INTO public.sentiment_aggregations
    (ticker, aggregation_period, period_start, period_end,
     total_mentions, unique_posts, unique_authors,
     avg_sentiment, weighted_sentiment, sentiment_std_dev,
     total_upvotes, total_comments, avg_upvote_ratio,
     source_breakdown, subreddit_breakdown)
  SELECT
    ps.ticker,
    '30d' as aggregation_period,
    w.start_ts, 
    w.end_ts,
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
  CROSS JOIN w
  WHERE ps.created_at >= w.start_ts 
    AND ps.created_at < w.end_ts
    AND ps.ticker != 'UNKNOWN'
  GROUP BY ps.ticker, w.start_ts, w.end_ts
  HAVING count(*) >= 5 -- Require even more mentions for 30d window
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
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. TREND ANALYSIS FUNCTION
-- ========================================

-- Function to compute sentiment trends and momentum
CREATE OR REPLACE FUNCTION public.compute_sentiment_trends()
RETURNS void AS $$
BEGIN
  WITH trend_data AS (
    SELECT 
      id, 
      ticker, 
      aggregation_period, 
      period_start, 
      avg_sentiment, 
      total_mentions,
      LAG(avg_sentiment) OVER (
        PARTITION BY ticker, aggregation_period 
        ORDER BY period_start
      ) as prev_sentiment,
      LAG(total_mentions) OVER (
        PARTITION BY ticker, aggregation_period 
        ORDER BY period_start
      ) as prev_mentions
    FROM public.sentiment_aggregations
    WHERE calculated_at >= NOW() - INTERVAL '1 hour' -- Only update recent records
  )
  UPDATE public.sentiment_aggregations sa
  SET 
    sentiment_trend = CASE
      WHEN td.prev_sentiment IS NULL THEN NULL
      WHEN sa.avg_sentiment - td.prev_sentiment > 0.05 THEN 'up'
      WHEN sa.avg_sentiment - td.prev_sentiment < -0.05 THEN 'down'
      ELSE 'flat'
    END,
    momentum_score = CASE
      WHEN td.prev_sentiment IS NULL OR td.prev_mentions IS NULL THEN NULL
      ELSE round(
        (0.6 * (sa.avg_sentiment - td.prev_sentiment) +
         0.4 * ((sa.total_mentions - td.prev_mentions)::decimal / 
                NULLIF(td.prev_mentions, 0)))::numeric, 3
      )
    END
  FROM trend_data td
  WHERE td.id = sa.id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. MASTER AGGREGATION FUNCTION
-- ========================================

-- Function to run all aggregations and trend analysis
CREATE OR REPLACE FUNCTION public.refresh_sentiment_aggregations()
RETURNS void AS $$
BEGIN
  -- Run all aggregation windows
  PERFORM public.upsert_sentiment_24h();
  PERFORM public.upsert_sentiment_7d();
  PERFORM public.upsert_sentiment_30d();
  
  -- Compute trends after aggregations
  PERFORM public.compute_sentiment_trends();
  
  -- Log completion
  RAISE NOTICE 'Sentiment aggregations refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. INITIAL DATA POPULATION
-- ========================================

-- Run initial aggregation to populate the table
SELECT public.refresh_sentiment_aggregations();

-- ========================================
-- 7. OPTIONAL: SETUP CRON JOB
-- ========================================

-- Uncomment and run this if you want automatic updates every 15 minutes
-- Requires pg_cron extension to be enabled in Supabase

/*
-- Enable pg_cron extension (run this first if not already enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule sentiment aggregation refresh every 15 minutes
SELECT cron.schedule(
  'sentiment_aggregations_refresh',
  '*/15 * * * *',
  $$SELECT public.refresh_sentiment_aggregations();$$
);
*/

-- ========================================
-- 8. VERIFICATION QUERIES
-- ========================================

-- Check if data was populated
SELECT 
  ticker, 
  aggregation_period, 
  total_mentions, 
  avg_sentiment, 
  sentiment_trend,
  calculated_at
FROM public.sentiment_aggregations 
ORDER BY calculated_at DESC, total_mentions DESC 
LIMIT 10;

-- Check source breakdown
SELECT 
  ticker,
  aggregation_period,
  source_breakdown
FROM public.sentiment_aggregations 
WHERE aggregation_period = '24h'
ORDER BY total_mentions DESC 
LIMIT 5;
