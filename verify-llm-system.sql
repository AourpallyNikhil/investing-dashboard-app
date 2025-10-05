-- Verify LLM-Powered Sentiment System
-- Run these queries in Supabase SQL Editor to check system status

-- ========================================
-- 1. CHECK LLM-ANALYZED POSTS
-- ========================================

-- Check recent LLM-analyzed Reddit posts
SELECT 
  'Reddit LLM Analysis' as source,
  count(*) as total_posts,
  count(*) FILTER (WHERE llm_ticker IS NOT NULL) as posts_with_tickers,
  count(*) FILTER (WHERE llm_confidence > 0.5) as high_confidence_posts,
  round(avg(llm_confidence)::numeric, 3) as avg_confidence,
  round(avg(llm_sentiment_score)::numeric, 3) as avg_sentiment
FROM reddit_posts_raw 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Check recent LLM-analyzed Twitter posts  
SELECT 
  'Twitter LLM Analysis' as source,
  count(*) as total_posts,
  count(*) FILTER (WHERE llm_ticker IS NOT NULL) as posts_with_tickers,
  count(*) FILTER (WHERE llm_confidence > 0.5) as high_confidence_posts,
  round(avg(llm_confidence)::numeric, 3) as avg_confidence,
  round(avg(llm_sentiment_score)::numeric, 3) as avg_sentiment
FROM twitter_posts_raw 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- ========================================
-- 2. CHECK TICKER EXTRACTION
-- ========================================

-- Top tickers found by LLM in last 24h
SELECT 
  llm_ticker as ticker,
  count(*) as mentions,
  round(avg(llm_sentiment_score)::numeric, 3) as avg_sentiment,
  round(avg(llm_confidence)::numeric, 3) as avg_confidence,
  array_agg(DISTINCT llm_analysis_version) as analysis_versions
FROM (
  SELECT llm_ticker, llm_sentiment_score, llm_confidence, llm_analysis_version
  FROM reddit_posts_raw 
  WHERE created_at > NOW() - INTERVAL '24 hours' AND llm_ticker IS NOT NULL
  
  UNION ALL
  
  SELECT llm_ticker, llm_sentiment_score, llm_confidence, llm_analysis_version
  FROM twitter_posts_raw 
  WHERE created_at > NOW() - INTERVAL '24 hours' AND llm_ticker IS NOT NULL
) combined
GROUP BY llm_ticker
ORDER BY mentions DESC
LIMIT 10;

-- ========================================
-- 3. CHECK SENTIMENT AGGREGATIONS TABLE
-- ========================================

-- Check if aggregations are being created
SELECT 
  ticker,
  total_mentions,
  unique_posts,
  unique_authors,
  round(avg_sentiment::numeric, 3) as avg_sentiment,
  round(weighted_sentiment::numeric, 3) as weighted_sentiment,
  round(avg_confidence::numeric, 3) as avg_confidence,
  source_breakdown,
  calculated_at
FROM sentiment_aggregations 
ORDER BY calculated_at DESC, total_mentions DESC
LIMIT 15;

-- ========================================
-- 4. CHECK AGGREGATION FUNCTION WORKS
-- ========================================

-- Test the per-ticker aggregation function
SELECT update_sentiment_aggregation_for_ticker('NVDA') as nvda_test;
SELECT update_sentiment_aggregation_for_ticker('AAPL') as aapl_test;

-- ========================================
-- 5. SAMPLE LLM ANALYSIS DATA
-- ========================================

-- Show sample Reddit posts with LLM analysis
SELECT 
  'Reddit' as source,
  left(title, 80) as post_preview,
  llm_ticker,
  llm_sentiment_score,
  llm_sentiment_label,
  llm_confidence,
  llm_key_themes,
  llm_has_catalyst,
  left(llm_reasoning, 100) as reasoning_preview
FROM reddit_posts_raw 
WHERE llm_ticker IS NOT NULL 
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY llm_confidence DESC, created_at DESC
LIMIT 5;

-- Show sample Twitter posts with LLM analysis
SELECT 
  'Twitter' as source,
  left(text, 80) as post_preview,
  llm_ticker,
  llm_sentiment_score,
  llm_sentiment_label,
  llm_confidence,
  llm_key_themes,
  llm_has_catalyst,
  left(llm_reasoning, 100) as reasoning_preview
FROM twitter_posts_raw 
WHERE llm_ticker IS NOT NULL 
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY llm_confidence DESC, created_at DESC
LIMIT 5;

-- ========================================
-- 6. CHECK VIEW IS WORKING
-- ========================================

-- Test the v_post_sentiment view
SELECT 
  source,
  ticker,
  count(*) as posts,
  round(avg(sentiment_score)::numeric, 3) as avg_sentiment,
  round(avg(confidence)::numeric, 3) as avg_confidence
FROM v_post_sentiment 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY source, ticker
ORDER BY posts DESC
LIMIT 10;

-- ========================================
-- 7. SYSTEM HEALTH CHECK
-- ========================================

-- Overall system status
SELECT 
  'System Health Check' as status,
  (SELECT count(*) FROM reddit_posts_raw WHERE created_at > NOW() - INTERVAL '24 hours') as reddit_posts_24h,
  (SELECT count(*) FROM twitter_posts_raw WHERE created_at > NOW() - INTERVAL '24 hours') as twitter_posts_24h,
  (SELECT count(*) FROM reddit_posts_raw WHERE llm_ticker IS NOT NULL AND created_at > NOW() - INTERVAL '24 hours') as reddit_llm_analyzed,
  (SELECT count(*) FROM twitter_posts_raw WHERE llm_ticker IS NOT NULL AND created_at > NOW() - INTERVAL '24 hours') as twitter_llm_analyzed,
  (SELECT count(*) FROM sentiment_aggregations WHERE calculated_at > NOW() - INTERVAL '24 hours') as aggregations_24h,
  (SELECT count(DISTINCT ticker) FROM sentiment_aggregations WHERE calculated_at > NOW() - INTERVAL '24 hours') as unique_tickers;




































