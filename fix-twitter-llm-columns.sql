-- Fix Twitter Posts Table - Add Missing LLM Columns
-- Run this in Supabase SQL Editor to fix the twitter_posts_raw table

-- Add LLM analysis columns to Twitter posts table
ALTER TABLE public.twitter_posts_raw 
ADD COLUMN IF NOT EXISTS llm_ticker VARCHAR(10),
ADD COLUMN IF NOT EXISTS llm_sentiment_score DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS llm_sentiment_label VARCHAR(20),
ADD COLUMN IF NOT EXISTS llm_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS llm_key_themes TEXT[],
ADD COLUMN IF NOT EXISTS llm_actionability_score DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS llm_has_catalyst BOOLEAN,
ADD COLUMN IF NOT EXISTS llm_reasoning TEXT,
ADD COLUMN IF NOT EXISTS llm_analyzed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS llm_analysis_version VARCHAR(10) DEFAULT '1.0';

-- Create indexes for LLM-analyzed Twitter data
CREATE INDEX IF NOT EXISTS idx_twitter_posts_llm_ticker ON public.twitter_posts_raw(llm_ticker);
CREATE INDEX IF NOT EXISTS idx_twitter_posts_llm_analyzed ON public.twitter_posts_raw(llm_analyzed_at);
CREATE INDEX IF NOT EXISTS idx_twitter_posts_llm_confidence ON public.twitter_posts_raw(llm_confidence);

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'twitter_posts_raw' 
  AND column_name LIKE 'llm_%'
ORDER BY column_name;

-- Test insert to verify schema works
INSERT INTO public.twitter_posts_raw (
  tweet_id, text, author_username, author_id, created_at,
  llm_ticker, llm_sentiment_score, llm_confidence, llm_key_themes, llm_actionability_score,
  retrieved_at, updated_at
) VALUES (
  'test_schema_' || extract(epoch from now())::text,
  'Test tweet for schema validation',
  'test_user',
  'test_user_123',
  now(),
  'TEST',
  0.5,
  0.8,
  ARRAY['test'],
  0.7,
  now(),
  now()
) ON CONFLICT (tweet_id) DO NOTHING;

-- Clean up test data
DELETE FROM public.twitter_posts_raw WHERE tweet_id LIKE 'test_schema_%';

SELECT 'Twitter LLM columns added successfully!' as result;

































