-- Add per-ticker aggregation function for real-time updates
-- Run this AFTER running llm-ticker-extraction-system.sql

CREATE OR REPLACE FUNCTION public.update_sentiment_aggregation_for_ticker(
  p_ticker VARCHAR(10),
  p_period_start TIMESTAMPTZ DEFAULT date_trunc('hour', now() - interval '24 hours'),
  p_period_end TIMESTAMPTZ DEFAULT date_trunc('hour', now())
) RETURNS TEXT AS $$
DECLARE
  aggregation_data RECORD;
  affected_rows INTEGER;
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
        AND ps2.key_themes IS NOT NULL
      LIMIT 10
    ) themes WHERE theme IS NOT NULL) as top_themes,
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
  
  -- Check if we have data for this ticker
  IF aggregation_data.ticker IS NULL THEN
    RETURN 'No data found for ticker ' || p_ticker || ' with sufficient confidence';
  END IF;
  
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

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  RETURN 'Updated aggregation for ticker ' || p_ticker || 
         ' (mentions: ' || aggregation_data.total_mentions || 
         ', sentiment: ' || aggregation_data.avg_sentiment || 
         ', confidence: ' || aggregation_data.avg_confidence || ')';
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT public.update_sentiment_aggregation_for_ticker('TEST') as test_result;





































