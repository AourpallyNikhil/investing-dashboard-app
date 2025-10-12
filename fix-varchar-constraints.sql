-- Fix VARCHAR(10) Constraints Causing Data Insertion Failures
-- Run this in Supabase SQL Editor to resolve "value too long for type character varying(10)" errors

-- ========================================
-- 1. INCREASE TICKER COLUMN SIZES
-- ========================================

-- Fix companies table ticker constraint (some tickers can be longer than 10 chars)
ALTER TABLE public.companies 
ALTER COLUMN ticker TYPE VARCHAR(20);

-- Fix companies table exchange constraint (some exchanges have longer names)
ALTER TABLE public.companies 
ALTER COLUMN exchange TYPE VARCHAR(20);

-- Fix sentiment aggregations ticker constraint
ALTER TABLE public.sentiment_aggregations 
ALTER COLUMN ticker TYPE VARCHAR(20);

-- Fix sentiment aggregations period constraint (in case of longer period names)
ALTER TABLE public.sentiment_aggregations 
ALTER COLUMN aggregation_period TYPE VARCHAR(20);

-- Fix sentiment aggregations trend constraint
ALTER TABLE public.sentiment_aggregations 
ALTER COLUMN sentiment_trend TYPE VARCHAR(20);

-- ========================================
-- 2. FIX TWITTER LLM COLUMNS
-- ========================================

-- Fix Twitter LLM ticker constraint
ALTER TABLE public.twitter_posts_raw 
ALTER COLUMN llm_ticker TYPE VARCHAR(20);

-- Fix Twitter LLM analysis version constraint
ALTER TABLE public.twitter_posts_raw 
ALTER COLUMN llm_analysis_version TYPE VARCHAR(30);

-- ========================================
-- 3. FIX REDDIT LLM COLUMNS (if they exist)
-- ========================================

-- Check if Reddit LLM columns exist and fix them
DO $$
BEGIN
    -- Fix Reddit LLM ticker constraint if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'reddit_posts_raw' AND column_name = 'llm_ticker') THEN
        ALTER TABLE public.reddit_posts_raw 
        ALTER COLUMN llm_ticker TYPE VARCHAR(20);
    END IF;
    
    -- Fix Reddit LLM analysis version constraint if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'reddit_posts_raw' AND column_name = 'llm_analysis_version') THEN
        ALTER TABLE public.reddit_posts_raw 
        ALTER COLUMN llm_analysis_version TYPE VARCHAR(30);
    END IF;
END $$;

-- ========================================
-- 4. FIX KPI TABLE CONSTRAINTS
-- ========================================

-- Fix KPI unit constraint (some units might be longer)
ALTER TABLE public.kpis 
ALTER COLUMN unit TYPE VARCHAR(20);

-- ========================================
-- 5. VERIFY CHANGES
-- ========================================

-- Check all VARCHAR constraints to ensure they're reasonable
SELECT 
    table_name,
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND data_type = 'character varying'
  AND character_maximum_length <= 10
ORDER BY table_name, column_name;

SELECT 'VARCHAR constraint fixes applied successfully!' as result;
