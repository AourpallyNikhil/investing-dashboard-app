-- Real-time Aggregation with Database Triggers
-- This approach updates aggregations immediately when LLM-analyzed posts are inserted

-- ========================================
-- 1. CREATE INCREMENTAL AGGREGATION FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION public.update_sentiment_aggregation_for_ticker(
  p_ticker VARCHAR(10),
  p_period_start TIMESTAMPTZ DEFAULT date_trunc('hour', now() - interval '24 hours'),
  p_period_end TIMESTAMPTZ DEFAULT date_trunc('hour', now())
) RETURNS VOID AS $$
DECLARE
  aggregation_data RECORD;
BEGIN
  -- Calculate aggregated metrics for this specific ticker
  SELECT
    p_ticker as ticker,
    '24h' as aggregation_period,
    p_period_start as period_start,
    p_period_end as period_end,
    count(*)::int as total_mentions,
    count(distinct ps.post_id)::int as unique_posts,
    count(distinct ps.author_id)::int as unique_authors,
    round(avg(ps.sentiment_score)::numeric, 3) as avg_sentiment,
    round((sum(ps.weight * ps.sentiment_score) / nullif(sum(ps.weight),0))::numeric, 3) as weighted_sentiment,
    round(stddev_pop(ps.sentiment_score)::numeric, 3) as sentiment_std_dev,
    round(avg(ps.confidence)::numeric, 2) as avg_confidence,
    coalesce(sum(ps.upvotes),0)::int as total_upvotes,
    coalesce(sum(ps.comments),0)::int as total_comments,
    round(avg(ps.upvote_ratio)::numeric, 2) as avg_upvote_ratio,
    -- Aggregate themes
    (SELECT array_agg(DISTINCT theme) FROM (
      SELECT unnest(ps2.key_themes) as theme
      FROM public.v_post_sentiment ps2 
      WHERE ps2.ticker = p_ticker 
        AND ps2.created_at >= p_period_start
        AND ps2.created_at < p_period_end
      LIMIT 10
    ) themes) as top_themes,
    -- Sentiment distribution
    jsonb_build_object(
      'positive', sum(case when ps.sentiment_score > 0.1 then 1 else 0 end),
      'neutral', sum(case when ps.sentiment_score between -0.1 and 0.1 then 1 else 0 end),
      'negative', sum(case when ps.sentiment_score < -0.1 then 1 else 0 end)
    ) as sentiment_distribution,
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
    ) as source_breakdown
  INTO aggregation_data
  FROM public.v_post_sentiment ps
  WHERE ps.ticker = p_ticker
    AND ps.created_at >= p_period_start 
    AND ps.created_at < p_period_end
    AND ps.ticker IS NOT NULL
  HAVING count(*) >= 1 AND avg(ps.confidence) > 0.3;
  
  -- UPSERT the aggregation
  INSERT INTO public.sentiment_aggregations
    (ticker, aggregation_period, period_start, period_end,
     total_mentions, unique_posts, unique_authors,
     avg_sentiment, weighted_sentiment, sentiment_std_dev, avg_confidence,
     total_upvotes, total_comments, avg_upvote_ratio,
     top_themes, sentiment_distribution, source_breakdown)
  VALUES
    (aggregation_data.ticker, aggregation_data.aggregation_period, 
     aggregation_data.period_start, aggregation_data.period_end,
     aggregation_data.total_mentions, aggregation_data.unique_posts, aggregation_data.unique_authors,
     aggregation_data.avg_sentiment, aggregation_data.weighted_sentiment, 
     aggregation_data.sentiment_std_dev, aggregation_data.avg_confidence,
     aggregation_data.total_upvotes, aggregation_data.total_comments, aggregation_data.avg_upvote_ratio,
     aggregation_data.top_themes, aggregation_data.sentiment_distribution, aggregation_data.source_breakdown)
  ON CONFLICT (ticker, aggregation_period, period_start) 
  DO UPDATE SET
    total_mentions = EXCLUDED.total_mentions,
    unique_posts = EXCLUDED.unique_posts,
    unique_authors = EXCLUDED.unique_authors,
    avg_sentiment = EXCLUDED.avg_sentiment,
    weighted_sentiment = EXCLUDED.weighted_sentiment,
    sentiment_std_dev = EXCLUDED.sentiment_std_dev,
    avg_confidence = EXCLUDED.avg_confidence,
    total_upvotes = EXCLUDED.total_upvotes,
    total_comments = EXCLUDED.total_comments,
    avg_upvote_ratio = EXCLUDED.avg_upvote_ratio,
    top_themes = EXCLUDED.top_themes,
    sentiment_distribution = EXCLUDED.sentiment_distribution,
    source_breakdown = EXCLUDED.source_breakdown,
    calculated_at = NOW();

  -- Log the update
  RAISE NOTICE 'Updated aggregation for ticker: % (mentions: %)', p_ticker, aggregation_data.total_mentions;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. CREATE TRIGGER FUNCTIONS
-- ========================================

-- Trigger function for Reddit posts
CREATE OR REPLACE FUNCTION public.trigger_reddit_aggregation_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if LLM analysis is present and confident
  IF NEW.llm_ticker IS NOT NULL AND NEW.llm_confidence > 0.3 THEN
    -- Update aggregation for this ticker
    PERFORM public.update_sentiment_aggregation_for_ticker(NEW.llm_ticker);
    
    RAISE NOTICE 'Reddit post trigger: Updated aggregation for ticker %', NEW.llm_ticker;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for Twitter posts  
CREATE OR REPLACE FUNCTION public.trigger_twitter_aggregation_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if LLM analysis is present and confident
  IF NEW.llm_ticker IS NOT NULL AND NEW.llm_confidence > 0.3 THEN
    -- Update aggregation for this ticker
    PERFORM public.update_sentiment_aggregation_for_ticker(NEW.llm_ticker);
    
    RAISE NOTICE 'Twitter post trigger: Updated aggregation for ticker %', NEW.llm_ticker;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. CREATE DATABASE TRIGGERS
-- ========================================

-- Trigger on Reddit posts INSERT/UPDATE
DROP TRIGGER IF EXISTS reddit_aggregation_trigger ON public.reddit_posts_raw;
CREATE TRIGGER reddit_aggregation_trigger
  AFTER INSERT OR UPDATE OF llm_ticker, llm_sentiment_score, llm_confidence
  ON public.reddit_posts_raw
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_reddit_aggregation_update();

-- Trigger on Twitter posts INSERT/UPDATE  
DROP TRIGGER IF EXISTS twitter_aggregation_trigger ON public.twitter_posts_raw;
CREATE TRIGGER twitter_aggregation_trigger
  AFTER INSERT OR UPDATE OF llm_ticker, llm_sentiment_score, llm_confidence
  ON public.twitter_posts_raw
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_twitter_aggregation_update();

-- ========================================
-- 4. TEST THE TRIGGERS
-- ========================================

-- Test with sample Reddit post
INSERT INTO public.reddit_posts_raw (
  post_id, title, author, subreddit, score, created_utc,
  llm_ticker, llm_sentiment_score, llm_confidence, llm_key_themes,
  retrieved_at, created_at, updated_at
) VALUES (
  'test_reddit_' || extract(epoch from now())::text,
  'NVIDIA earnings look amazing!',
  'test_user',
  'investing',
  25,
  extract(epoch from now())::bigint,
  'NVDA',
  0.8,
  0.9,
  ARRAY['earnings', 'AI'],
  now(),
  now(),
  now()
);

-- Test with sample Twitter post
INSERT INTO public.twitter_posts_raw (
  tweet_id, text, author_username, author_id, created_at,
  llm_ticker, llm_sentiment_score, llm_confidence, llm_key_themes,
  retrieved_at, updated_at
) VALUES (
  'test_twitter_' || extract(epoch from now())::text,
  'Apple iPhone sales crushing it this quarter 🚀',
  'test_trader',
  'test_trader_123',
  now(),
  'AAPL',
  0.7,
  0.85,
  ARRAY['sales', 'iPhone'],
  now(),
  now()
);

-- Check if aggregations were created
SELECT 
  ticker, 
  total_mentions, 
  avg_sentiment, 
  avg_confidence,
  top_themes,
  calculated_at
FROM public.sentiment_aggregations 
WHERE ticker IN ('NVDA', 'AAPL')
ORDER BY calculated_at DESC;

-- ========================================
-- 5. PERFORMANCE OPTIMIZATION
-- ========================================

-- Add partial index for faster trigger lookups
CREATE INDEX IF NOT EXISTS idx_reddit_llm_ticker_confidence 
ON public.reddit_posts_raw(llm_ticker) 
WHERE llm_ticker IS NOT NULL AND llm_confidence > 0.3;

CREATE INDEX IF NOT EXISTS idx_twitter_llm_ticker_confidence
ON public.twitter_posts_raw(llm_ticker)
WHERE llm_ticker IS NOT NULL AND llm_confidence > 0.3;

-- Add index for aggregation queries
CREATE INDEX IF NOT EXISTS idx_sentiment_agg_ticker_calc_at
ON public.sentiment_aggregations(ticker, calculated_at DESC);

COMMENT ON FUNCTION public.update_sentiment_aggregation_for_ticker IS 
'Updates sentiment aggregation for a specific ticker in real-time. Called by database triggers when LLM-analyzed posts are inserted.';

COMMENT ON FUNCTION public.trigger_reddit_aggregation_update IS 
'Database trigger function that updates aggregations when Reddit posts with LLM analysis are inserted/updated.';

COMMENT ON FUNCTION public.trigger_twitter_aggregation_update IS 
'Database trigger function that updates aggregations when Twitter posts with LLM analysis are inserted/updated.';




































