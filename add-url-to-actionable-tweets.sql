-- Add URL field to the top_actionable_tweets view
-- Run this in Supabase SQL Editor to fix missing URL field

-- First drop the existing view to avoid column mapping conflicts
DROP VIEW IF EXISTS public.top_actionable_tweets;

-- Then recreate it with the URL field
CREATE VIEW public.top_actionable_tweets AS
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
  tf.url,  -- Add URL field here
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
