-- Add missing LLM analysis columns to reddit_comments table
-- Run this in Supabase SQL Editor

-- Add core LLM analysis columns that exist in posts but missing in comments
ALTER TABLE public.reddit_comments 
ADD COLUMN IF NOT EXISTS llm_confidence NUMERIC,
ADD COLUMN IF NOT EXISTS llm_actionability_score NUMERIC,
ADD COLUMN IF NOT EXISTS llm_analysis_version VARCHAR(50) DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS llm_analyzed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS llm_has_catalyst BOOLEAN,
ADD COLUMN IF NOT EXISTS llm_reasoning TEXT;

-- Add comment-specific LLM columns for enhanced analysis
ALTER TABLE public.reddit_comments 
ADD COLUMN IF NOT EXISTS llm_thread_context_score NUMERIC,
ADD COLUMN IF NOT EXISTS llm_argument_strength NUMERIC;

-- Add indexes for performance on LLM analysis queries
CREATE INDEX IF NOT EXISTS idx_reddit_comments_llm_analyzed_at 
ON public.reddit_comments (llm_analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_reddit_comments_llm_confidence 
ON public.reddit_comments (llm_confidence DESC) 
WHERE llm_confidence IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reddit_comments_llm_actionability 
ON public.reddit_comments (llm_actionability_score DESC) 
WHERE llm_actionability_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reddit_comments_has_catalyst 
ON public.reddit_comments (llm_has_catalyst) 
WHERE llm_has_catalyst = true;

-- Add composite index for sentiment analysis queries
CREATE INDEX IF NOT EXISTS idx_reddit_comments_sentiment_analysis 
ON public.reddit_comments (post_id, sentiment_score, llm_confidence) 
WHERE sentiment_score IS NOT NULL;

-- Update comment to reflect new LLM capabilities
COMMENT ON TABLE public.reddit_comments IS 'Reddit comments with comprehensive LLM analysis including sentiment, actionability, catalysts, and thread context';

-- Add column comments for documentation
COMMENT ON COLUMN public.reddit_comments.llm_confidence IS 'LLM confidence score (0.0-1.0) for the analysis quality';
COMMENT ON COLUMN public.reddit_comments.llm_actionability_score IS 'How actionable the comment is for trading decisions (0.0-1.0)';
COMMENT ON COLUMN public.reddit_comments.llm_analysis_version IS 'Version of LLM model used for analysis';
COMMENT ON COLUMN public.reddit_comments.llm_analyzed_at IS 'Timestamp when LLM analysis was performed';
COMMENT ON COLUMN public.reddit_comments.llm_has_catalyst IS 'Whether comment mentions market catalysts (earnings, FDA, etc.)';
COMMENT ON COLUMN public.reddit_comments.llm_reasoning IS 'LLM explanation of its sentiment and actionability analysis';
COMMENT ON COLUMN public.reddit_comments.llm_thread_context_score IS 'How relevant the comment is to the original post topic (0.0-1.0)';
COMMENT ON COLUMN public.reddit_comments.llm_argument_strength IS 'Strength of argument/evidence presented in comment (0.0-1.0)';
















