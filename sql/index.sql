-- ============================================================================
-- INVESTING DASHBOARD - MASTER SQL EXECUTION SCRIPT
-- ============================================================================
-- This script provides a complete database setup for the Investing Dashboard
-- Execute sections as needed based on your requirements
-- ============================================================================

-- ============================================================================
-- 1. CORE MIGRATIONS (Execute in Order)
-- ============================================================================
-- These should be run sequentially for proper schema evolution

\echo '🚀 Starting Investing Dashboard Database Setup...'
\echo ''

\echo '📋 Step 1: Core Schema Migrations'
\i sql/migrations/001_create_schema.sql
\i sql/migrations/002_create_views.sql
\i sql/migrations/003_create_financial_metrics.sql
\i sql/migrations/004_create_financial_statements.sql
\i sql/migrations/005_create_interest_rates.sql
\i sql/migrations/006_create_inflation_data.sql
\i sql/migrations/007_create_sentiment_tables.sql
\i sql/migrations/008_create_economic_data.sql
\i sql/migrations/009_create_configuration_tables.sql
\i sql/migrations/010_fix_ticker_length.sql

\echo '✅ Core migrations completed'
\echo ''

-- ============================================================================
-- 2. SCHEMA SETUP (Additional Tables and Structures)
-- ============================================================================

\echo '📋 Step 2: Additional Schema Setup'
\i sql/schema/create-minimal-tables.sql
\i sql/schema/create-missing-tables.sql
\i sql/schema/setup-actionable-tweets.sql
\i sql/schema/add-url-to-actionable-tweets.sql

\echo '✅ Schema setup completed'
\echo ''

-- ============================================================================
-- 3. VIEWS AND INDEXES (Performance Optimization)
-- ============================================================================

\echo '📋 Step 3: Views and Indexes'
\i sql/views/run-indexes-and-views.sql

\echo '✅ Views and indexes created'
\echo ''

-- ============================================================================
-- 4. SEED DATA (Optional - for development/testing)
-- ============================================================================

\echo '📋 Step 4: Seed Data (Optional)'
\echo 'Uncomment the following lines to populate with initial data:'
-- \i sql/seed-data/seed.sql
-- \i sql/seed-data/seed_simple.sql

\echo '⏭️  Seed data skipped (uncomment above lines if needed)'
\echo ''

-- ============================================================================
-- 5. CRON JOBS SETUP (Automated Processing)
-- ============================================================================

\echo '📋 Step 5: Cron Jobs Setup'
\echo 'Setting up automated data processing...'

\i sql/cron/initialize-pg-cron.sql
\i sql/cron/setup-cron-jobs.sql
\i sql/cron/create-sentiment-cron-job.sql

\echo '✅ Cron jobs configured'
\echo ''

-- ============================================================================
-- 6. VERIFICATION AND STATUS
-- ============================================================================

\echo '📋 Step 6: System Verification'

-- Check cron status
\i sql/cron/check-cron-status.sql

-- Verify LLM system
\i sql/fixes/verify-llm-system.sql

\echo ''
\echo '🎉 Investing Dashboard Database Setup Complete!'
\echo ''
\echo '📊 Next Steps:'
\echo '   1. Verify all tables were created successfully'
\echo '   2. Check cron jobs are scheduled properly'
\echo '   3. Test LLM processing pipeline'
\echo '   4. Run application and verify data flow'
\echo ''
\echo '🔧 If you encounter issues:'
\echo '   - Check sql/fixes/ for specific problem solutions'
\echo '   - Review sql/README.md for troubleshooting guide'
\echo '   - Ensure all environment variables are set'
\echo ''

-- ============================================================================
-- OPTIONAL FIXES (Run only if specific issues occur)
-- ============================================================================

\echo '🔧 Optional Fixes Available:'
\echo '   - sql/fixes/fix-varchar-constraints.sql (for VARCHAR length issues)'
\echo '   - sql/fixes/fix-twitter-llm-columns.sql (for missing Twitter LLM columns)'
\echo '   - sql/fixes/add_reddit_comments_llm_columns.sql (for Reddit LLM columns)'
\echo '   - sql/fixes/improve-ticker-extraction.sql (for ticker extraction improvements)'
\echo ''
\echo 'Run these individually as needed based on your specific requirements.'
\echo ''

-- Show final status
SELECT 
    'Database setup completed at: ' || NOW()::TEXT as status,
    'Total tables created: ' || COUNT(*)::TEXT as table_count
FROM information_schema.tables 
WHERE table_schema = 'public';

\echo ''
\echo '✨ Ready to start processing social media sentiment data!'
