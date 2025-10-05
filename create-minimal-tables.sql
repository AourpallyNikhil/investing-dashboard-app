-- Create MINIMAL tables for Reddit data - only essential columns for sentiment analysis
-- Run this in Supabase SQL Editor

-- Drop existing tables to start fresh
DROP TABLE IF EXISTS public.reddit_posts_raw CASCADE;
DROP TABLE IF EXISTS public.reddit_comments CASCADE;

-- Create minimal reddit_posts_raw table
CREATE TABLE public.reddit_posts_raw (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id VARCHAR(50) NOT NULL UNIQUE,
    title TEXT NOT NULL,
    selftext TEXT DEFAULT '',
    author VARCHAR(100) NOT NULL,
    subreddit VARCHAR(50) NOT NULL,
    score INTEGER DEFAULT 0,
    num_comments INTEGER DEFAULT 0,
    created_utc INTEGER NOT NULL,
    url TEXT NOT NULL,
    permalink TEXT NOT NULL,
    raw_json JSONB,
    retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create minimal reddit_comments table
CREATE TABLE public.reddit_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id VARCHAR(50) NOT NULL UNIQUE,
    post_id VARCHAR(50) NOT NULL,
    body TEXT NOT NULL,
    author VARCHAR(100) NOT NULL,
    score INTEGER DEFAULT 0,
    created_utc INTEGER NOT NULL,
    raw_json JSONB,
    retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_reddit_posts_raw_retrieved_at ON public.reddit_posts_raw (retrieved_at DESC);
CREATE INDEX idx_reddit_posts_raw_subreddit ON public.reddit_posts_raw (subreddit);
CREATE INDEX idx_reddit_posts_raw_score ON public.reddit_posts_raw (score DESC);

CREATE INDEX idx_reddit_comments_retrieved_at ON public.reddit_comments (retrieved_at DESC);
CREATE INDEX idx_reddit_comments_post_id ON public.reddit_comments (post_id);
CREATE INDEX idx_reddit_comments_score ON public.reddit_comments (score DESC);

-- Enable Row Level Security
ALTER TABLE public.reddit_posts_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reddit_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
CREATE POLICY "Allow service role full access to reddit_posts_raw" ON public.reddit_posts_raw
    FOR ALL USING (true);

CREATE POLICY "Allow service role full access to reddit_comments" ON public.reddit_comments
    FOR ALL USING (true);

-- Grant permissions
GRANT SELECT ON public.reddit_posts_raw TO authenticated;
GRANT SELECT ON public.reddit_comments TO authenticated;

-- Verify tables were created
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('reddit_posts_raw', 'reddit_comments')
ORDER BY tablename;

