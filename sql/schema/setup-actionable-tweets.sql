-- =====================================================
-- Actionable Tweet Ranking System - Complete Setup
-- =====================================================
-- This script creates a sophisticated tweet ranking system that surfaces
-- the most valuable, actionable tweets from your 850+ daily tweets.
-- 
-- Run this script in your Supabase SQL Editor to set up the complete system.

-- =====================================================
-- Step 0: Create twitter_authors table (for follower count normalization)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.twitter_authors (
  author_id VARCHAR(50) PRIMARY KEY,
  author_username VARCHAR(100) UNIQUE,
  author_name TEXT,
  follower_count INT NOT NULL DEFAULT 0,
  following_count INT NOT NULL DEFAULT 0,
  tweet_count INT NOT NULL DEFAULT 0,
  listed_count INT NOT NULL DEFAULT 0,
  profile_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_twitter_authors_username ON public.twitter_authors(author_username);

COMMENT ON TABLE public.twitter_authors IS 'Stores Twitter author profiles for engagement velocity normalization';

-- =====================================================
-- Step 1: Backfill/normalize cashtags (in case some rows don't have them)
-- =====================================================

UPDATE public.twitter_posts_raw r
SET cashtags = (
  SELECT array_agg(DISTINCT upper(m[1]))
  FROM regexp_matches(r.text, '\$([A-Za-z]{1,5})', 'g') m
)
WHERE (r.cashtags IS NULL OR array_length(r.cashtags,1)=0)
  AND r.created_at > NOW() - INTERVAL '7 days';

-- =====================================================
-- Step 2: Feature view over your raw table
-- =====================================================

CREATE OR REPLACE VIEW public.tweet_features AS
WITH base AS (
  SELECT
    r.tweet_id,
    r.text,
    r.author_username,
    r.author_id,
    r.author_name,
    r.created_at,
    COALESCE((r.raw_json->>'is_retweet')::boolean, false) as is_retweet,
    r.url,
    r.raw_json,
    COALESCE(r.cashtags,
             (SELECT array_agg(DISTINCT upper(m[1]))
              FROM regexp_matches(r.text, '\$([A-Za-z]{1,5})', 'g') m)
    ) AS tickers,
    (COALESCE(r.like_count,0)
     + COALESCE(r.retweet_count,0)
     + COALESCE(r.reply_count,0)
     + COALESCE(r.quote_count,0))::int AS engagement
  FROM public.twitter_posts_raw r
  WHERE r.created_at > NOW() - INTERVAL '36 hours'
)
SELECT
  b.*,
  COALESCE(a.follower_count, 1) AS follower_count,
  -- engagement velocity: (eng / followers) per minute since post
  ((b.engagement::float / GREATEST(1, COALESCE(a.follower_count,1)::float))
    / GREATEST(1, EXTRACT(epoch FROM (NOW()-b.created_at))/60.0)) AS velocity,
  -- simple flags
  (b.text ~* '(^|[^A-Za-z])(\$?\d{1,5}(\.\d+)?)(\s*(target|pt|tp|stop|risk|at|above|below))') AS has_numbers,
  (b.text ~* '(entry|bought|added|starter|trimmed|long|short|calls|puts|stop|target|pt|tp|breakout|breakdown|support|resistance|ath|sweep|unusual|iv|gamma|delta|roll)') AS has_action_words,
  ((b.url IS NOT NULL AND b.url <> '')
     OR EXISTS (SELECT 1 FROM jsonb_path_query(b.raw_json, '$.entities.urls[*]'))) AS has_link,
  EXISTS (SELECT 1 FROM jsonb_path_query(b.raw_json, '$.includes.media[*] ? (@.type == "photo" || @.type == "video")')) AS has_chart
FROM base b
LEFT JOIN public.twitter_authors a ON a.author_id = b.author_id;

COMMENT ON VIEW public.tweet_features IS 'Extracts actionability features from raw tweets including engagement velocity, action words, and ticker mentions';

-- =====================================================
-- Step 3: Baselines & consensus (materialized views)
-- =====================================================

-- Author velocity baseline (last 14d)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.author_velocity_baseline AS
SELECT
  author_id,
  AVG(velocity) AS velocity_mean,
  STDDEV_POP(velocity) AS velocity_std,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY velocity) AS velocity_p50
FROM public.tweet_features
WHERE created_at > NOW() - INTERVAL '14 days'
GROUP BY author_id;

CREATE INDEX IF NOT EXISTS mv_idx_author_velocity_author ON public.author_velocity_baseline(author_id);

COMMENT ON MATERIALIZED VIEW public.author_velocity_baseline IS 'Author engagement velocity baselines for z-score calculation (refresh every 5 minutes)';

-- Per-ticker per-minute distinct authors (last 36h)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.ticker_minute_mentions AS
SELECT
  upper(t) AS ticker,
  date_trunc('minute', tf.created_at) AS minute_bucket,
  COUNT(DISTINCT tf.author_id) AS authors
FROM (
  SELECT tweet_id, author_id, created_at, unnest(COALESCE(tickers,'{}'::text[])) AS t
  FROM public.tweet_features
) x
JOIN public.tweet_features tf ON tf.tweet_id = x.tweet_id
GROUP BY 1,2;

CREATE INDEX IF NOT EXISTS mv_idx_tmm_ticker_time ON public.ticker_minute_mentions(ticker, minute_bucket);

COMMENT ON MATERIALIZED VIEW public.ticker_minute_mentions IS 'Per-ticker per-minute author mentions for consensus detection (refresh every 5 minutes)';

-- =====================================================
-- Step 4: Final ranked view: top_actionable_tweets
-- =====================================================

CREATE OR REPLACE VIEW public.top_actionable_tweets AS
WITH tf AS (
  SELECT *
  FROM public.tweet_features
  WHERE created_at > NOW() - INTERVAL '24 hours'
    AND array_length(tickers,1) >= 1
    AND COALESCE(is_retweet,false) = false
)
SELECT
  tf.tweet_id,
  tf.author_username,
  tf.author_id,
  tf.author_name,
  tf.text,
  tf.tickers,
  tf.created_at,
  tf.follower_count,
  tf.engagement,
  tf.velocity,
  COALESCE(b.velocity_mean, 0.0) AS author_velocity_mean,
  COALESCE(NULLIF(b.velocity_std,0.0), 0.0001) AS author_velocity_std,
  -- z-score of engagement velocity vs author's norm
  GREATEST(-3, LEAST(5, (tf.velocity - COALESCE(b.velocity_mean,0.0)) / COALESCE(NULLIF(b.velocity_std,0.0),0.0001))) AS velocity_z,
  -- cross-influencer consensus in ±60m (max per ticker to avoid double-counting)
  COALESCE((
    SELECT MAX(s.authors_60m) FROM (
      SELECT m.ticker, SUM(m.authors) AS authors_60m
      FROM public.ticker_minute_mentions m
      WHERE m.ticker = ANY(tf.tickers)
        AND m.minute_bucket BETWEEN tf.created_at - INTERVAL '60 min' AND tf.created_at + INTERVAL '60 min'
      GROUP BY m.ticker
    ) s
  ), 0) AS authors_60m,
  -- actionability & catalysts
  ((CASE WHEN tf.has_action_words THEN 1 ELSE 0 END)
   + (CASE WHEN tf.has_numbers THEN 1 ELSE 0 END)
   + (CASE WHEN (tf.has_link OR tf.has_chart) THEN 1 ELSE 0 END)) AS actionability_score,
  LEAST(2,
    (CASE WHEN tf.text ~* '(earnings|guidance|upgrade|downgrade|pt |price target|fda|pdufa|contract|award|halt|8-k|10-q|s-1|press release|^pr\b|\bir\b)' THEN 1 ELSE 0 END)
  + (CASE WHEN tf.text ~* '(short interest|squeeze|gamma)' THEN 1 ELSE 0 END)
  ) AS catalyst_score,
  -- author novelty (didn't talk about this ticker in last 7d before this tweet)
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM public.twitter_posts_raw p2
    WHERE p2.author_id = tf.author_id
      AND p2.created_at BETWEEN (tf.created_at - INTERVAL '7 days') AND tf.created_at
      AND COALESCE(p2.cashtags, '{}'::text[]) && tf.tickers
  ) THEN 1.0 ELSE 0.0 END AS author_novelty,
  -- simple author skill (followers only; add hit-rate later)
  (0.5 * (log(GREATEST(1, tf.follower_count)) / log(1000000)) + 0.5 * 0.5) AS author_skill_score,
  -- freshness
  exp( - EXTRACT(epoch FROM (NOW()-tf.created_at))/60.0 / 240.0 ) AS time_decay,
  -- final priority score
  (
    0.30 * GREATEST(-3, LEAST(5, (tf.velocity - COALESCE(b.velocity_mean,0.0)) / COALESCE(NULLIF(b.velocity_std,0.0),0.0001)))
  + 0.20 * log(1 + COALESCE((
        SELECT MAX(s2.authors_60m) FROM (
          SELECT m2.ticker, SUM(m2.authors) AS authors_60m
          FROM public.ticker_minute_mentions m2
          WHERE m2.ticker = ANY(tf.tickers)
            AND m2.minute_bucket BETWEEN tf.created_at - INTERVAL '60 min' AND tf.created_at + INTERVAL '60 min'
          GROUP BY m2.ticker
        ) s2
      ), 0))
  + 0.15 * ((CASE WHEN tf.has_action_words THEN 1 ELSE 0 END)
          + (CASE WHEN tf.has_numbers THEN 1 ELSE 0 END)
          + (CASE WHEN (tf.has_link OR tf.has_chart) THEN 1 ELSE 0 END))
  + 0.10 * CASE WHEN NOT EXISTS (
              SELECT 1 FROM public.twitter_posts_raw p3
              WHERE p3.author_id = tf.author_id
                AND p3.created_at BETWEEN (tf.created_at - INTERVAL '7 days') AND tf.created_at
                AND COALESCE(p3.cashtags, '{}'::text[]) && tf.tickers
            ) THEN 1.0 ELSE 0.0 END
  + 0.10 * LEAST(2,
            (CASE WHEN tf.text ~* '(earnings|guidance|upgrade|downgrade|pt |price target|fda|pdufa|contract|award|halt|8-k|10-q|s-1|press release|^pr\b|\bir\b)' THEN 1 ELSE 0 END)
          + (CASE WHEN tf.text ~* '(short interest|squeeze|gamma)' THEN 1 ELSE 0 END))
  + 0.10 * (0.5 * (log(GREATEST(1, tf.follower_count)) / log(1000000)) + 0.5 * 0.5)
  + 0.05 * exp( - EXTRACT(epoch FROM (NOW()-tf.created_at))/60.0 / 240.0 )
  ) AS score
FROM tf
LEFT JOIN public.author_velocity_baseline b USING(author_id)
WHERE (tf.has_action_words OR tf.has_numbers OR tf.has_link OR tf.has_chart)
ORDER BY score DESC;

COMMENT ON VIEW public.top_actionable_tweets IS 'Ranks tweets by actionability score combining velocity z-score, consensus, catalysts, and author novelty';

-- =====================================================
-- Step 5: Additional indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_tpr_author_time ON public.twitter_posts_raw(author_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tpr_cashtags_gin ON public.twitter_posts_raw USING gin(cashtags);
CREATE INDEX IF NOT EXISTS idx_tpr_created_at ON public.twitter_posts_raw(created_at);

-- =====================================================
-- Step 6: Create a function to refresh materialized views
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_actionable_tweets_mvs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Refresh materialized views for actionable tweets system
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.author_velocity_baseline;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.ticker_minute_mentions;
END;
$$;

COMMENT ON FUNCTION refresh_actionable_tweets_mvs() IS 'Refreshes materialized views for actionable tweets ranking system. Call this every 5 minutes via cron.';

-- =====================================================
-- Step 7: Test the system with sample data
-- =====================================================

-- Check if we have any twitter_posts_raw data
DO $$
DECLARE
  tweet_count INTEGER;
  author_count INTEGER;
  actionable_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tweet_count FROM public.twitter_posts_raw;
  SELECT COUNT(*) INTO author_count FROM public.twitter_authors;
  SELECT COUNT(*) INTO actionable_count FROM public.top_actionable_tweets;
  
  RAISE NOTICE 'Setup Complete! Status:';
  RAISE NOTICE '- Raw tweets: %', tweet_count;
  RAISE NOTICE '- Authors: %', author_count;
  RAISE NOTICE '- Actionable tweets: %', actionable_count;
  
  IF tweet_count = 0 THEN
    RAISE NOTICE 'No tweets found. Run your cron job to populate twitter_posts_raw first.';
  ELSIF actionable_count = 0 THEN
    RAISE NOTICE 'No actionable tweets found. This is normal if tweets lack tickers or action words.';
  ELSE
    RAISE NOTICE 'System ready! Use: SELECT * FROM top_actionable_tweets LIMIT 10;';
  END IF;
END;
$$;

-- =====================================================
-- Usage Examples
-- =====================================================

/*
-- Example 1: Get top 15 actionable tweets for your frontend
SELECT 
  tweet_id, 
  author_username, 
  author_name, 
  text, 
  tickers, 
  created_at, 
  score, 
  velocity_z, 
  authors_60m, 
  actionability_score, 
  catalyst_score, 
  author_novelty, 
  time_decay
FROM public.top_actionable_tweets 
LIMIT 15;

-- Example 2: Refresh materialized views (run every 5 minutes)
SELECT refresh_actionable_tweets_mvs();

-- Example 3: Check system health
SELECT 
  'Raw Tweets' as table_name, 
  COUNT(*) as count,
  MAX(created_at) as latest_tweet
FROM public.twitter_posts_raw
UNION ALL
SELECT 
  'Authors' as table_name, 
  COUNT(*) as count,
  MAX(updated_at) as latest_update
FROM public.twitter_authors
UNION ALL
SELECT 
  'Actionable Tweets' as table_name, 
  COUNT(*) as count,
  MAX(created_at) as latest_tweet
FROM public.top_actionable_tweets;

-- Example 4: Top authors by actionable tweet count
SELECT 
  author_username,
  COUNT(*) as actionable_tweets,
  AVG(score) as avg_score,
  MAX(score) as max_score
FROM public.top_actionable_tweets 
GROUP BY author_username 
ORDER BY actionable_tweets DESC 
LIMIT 10;
*/


















