-- Fix VARCHAR(10) Constraints Causing Data Insertion Failures
-- Run this in Supabase SQL Editor to resolve "value too long for type character varying(10)" errors

-- ========================================
-- 0. DISCOVER AND HANDLE ALL DEPENDENT VIEWS
-- ========================================

-- First, let's discover ALL views that depend on columns we need to modify
SELECT 
    schemaname, 
    viewname, 
    definition 
FROM pg_views 
WHERE schemaname = 'public' 
  AND (definition ILIKE '%llm_ticker%' OR definition ILIKE '%ticker%');

-- Simple and reliable approach: Handle views that reference our target columns
DO $$
DECLARE
    view_rec RECORD;
    view_definition TEXT;
BEGIN
    -- Create temporary table to store all view backups
    DROP TABLE IF EXISTS temp_view_backup;
    CREATE TEMP TABLE temp_view_backup (view_name TEXT, definition TEXT);
    
    -- Find all views that contain references to the columns we're modifying
    -- Using text search in view definitions (simpler and more reliable)
    FOR view_rec IN 
        SELECT viewname as view_name
        FROM pg_views 
        WHERE schemaname = 'public' 
        AND (
            definition ILIKE '%llm_ticker%' 
            OR definition ILIKE '%ticker%' 
            OR definition ILIKE '%llm_analysis_version%'
            OR definition ILIKE '%exchange%'
            OR definition ILIKE '%aggregation_period%'
            OR definition ILIKE '%sentiment_trend%'
            OR definition ILIKE '%unit%'
        )
    LOOP
        BEGIN
            -- Get the view definition
            SELECT pg_get_viewdef('public.' || view_rec.view_name, true) INTO view_definition;
            
            -- Store it in backup table
            INSERT INTO temp_view_backup VALUES (view_rec.view_name, view_definition);
            
            -- Drop the view
            EXECUTE 'DROP VIEW IF EXISTS public.' || view_rec.view_name || ' CASCADE';
            
            RAISE NOTICE 'View % backed up and dropped', view_rec.view_name;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not backup/drop view %: %', view_rec.view_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'All dependent views have been backed up and dropped. Total: %', (SELECT COUNT(*) FROM temp_view_backup);
END $$;

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

-- ========================================
-- 6. RECREATE ALL DEPENDENT VIEWS
-- ========================================

-- Recreate ALL views using the backed up definitions
DO $$
DECLARE
    view_rec RECORD;
BEGIN
    -- Recreate all backed up views
    FOR view_rec IN 
        SELECT view_name, definition FROM temp_view_backup ORDER BY view_name
    LOOP
        BEGIN
            -- Execute the CREATE VIEW statement
            EXECUTE view_rec.definition;
            RAISE NOTICE 'View % recreated successfully', view_rec.view_name;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Failed to recreate view %: %', view_rec.view_name, SQLERRM;
                RAISE NOTICE 'View definition was: %', view_rec.definition;
        END;
    END LOOP;
    
    -- Show summary of what was recreated
    RAISE NOTICE 'View recreation complete. Total views processed: %', (SELECT COUNT(*) FROM temp_view_backup);
    
    -- Clean up the temporary table
    DROP TABLE IF EXISTS temp_view_backup;
END $$;

SELECT 'VARCHAR constraint fixes applied successfully!' as result;
