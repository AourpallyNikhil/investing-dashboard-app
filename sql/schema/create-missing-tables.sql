-- Create missing tables for Reddit data collection
-- Run this in Supabase SQL Editor

-- Create reddit_posts_raw table for storing raw Reddit post data
CREATE TABLE IF NOT EXISTS public.reddit_posts_raw (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id VARCHAR(50) NOT NULL UNIQUE,
    title TEXT NOT NULL,
    selftext TEXT DEFAULT '',
    author VARCHAR(100) NOT NULL,
    score INTEGER DEFAULT 0,
    upvote_ratio NUMERIC(3,2) DEFAULT 0.0,
    num_comments INTEGER DEFAULT 0,
    url TEXT NOT NULL,
    permalink TEXT NOT NULL,
    subreddit VARCHAR(50) NOT NULL,
    subreddit_subscribers INTEGER DEFAULT 0,
    created_utc INTEGER NOT NULL,
    edited BOOLEAN DEFAULT false,
    distinguished VARCHAR(20),
    stickied BOOLEAN DEFAULT false,
    locked BOOLEAN DEFAULT false,
    archived BOOLEAN DEFAULT false,
    removed_by_category VARCHAR(50),
    is_self BOOLEAN DEFAULT false,
    is_video BOOLEAN DEFAULT false,
    over_18 BOOLEAN DEFAULT false,
    total_awards_received INTEGER DEFAULT 0,
    gilded INTEGER DEFAULT 0,
    all_awardings JSONB DEFAULT '[]'::jsonb,
    link_flair_text TEXT,
    link_flair_css_class TEXT,
    raw_json JSONB,
    retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for reddit_posts_raw
CREATE INDEX IF NOT EXISTS idx_reddit_posts_raw_retrieved_at ON public.reddit_posts_raw (retrieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_raw_subreddit ON public.reddit_posts_raw (subreddit);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_raw_score ON public.reddit_posts_raw (score DESC);

-- Create reddit_comments table for storing raw Reddit comment data
CREATE TABLE IF NOT EXISTS public.reddit_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id VARCHAR(50) NOT NULL UNIQUE,
    post_id VARCHAR(50) NOT NULL,
    parent_id VARCHAR(50),
    body TEXT NOT NULL,
    body_html TEXT,
    author VARCHAR(100) NOT NULL,
    author_fullname VARCHAR(100),
    author_flair_text TEXT,
    score INTEGER DEFAULT 0,
    ups INTEGER DEFAULT 0,
    downs INTEGER DEFAULT 0,
    controversiality INTEGER DEFAULT 0,
    created_utc INTEGER NOT NULL,
    edited BOOLEAN DEFAULT false,
    distinguished VARCHAR(20),
    stickied BOOLEAN DEFAULT false,
    depth INTEGER DEFAULT 0,
    is_submitter BOOLEAN DEFAULT false,
    score_hidden BOOLEAN DEFAULT false,
    archived BOOLEAN DEFAULT false,
    raw_json JSONB,
    retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for reddit_comments
CREATE INDEX IF NOT EXISTS idx_reddit_comments_retrieved_at ON public.reddit_comments (retrieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_comments_post_id ON public.reddit_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_reddit_comments_score ON public.reddit_comments (score DESC);

-- Enable Row Level Security (RLS) for both tables
ALTER TABLE public.reddit_posts_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reddit_comments ENABLE ROW LEVEL SECURITY;

-- Create policies to allow service role access
CREATE POLICY "Allow service role full access to reddit_posts_raw" ON public.reddit_posts_raw
    FOR ALL USING (true);

CREATE POLICY "Allow service role full access to reddit_comments" ON public.reddit_comments
    FOR ALL USING (true);

-- Grant permissions to authenticated users (optional - for dashboard access)
GRANT SELECT ON public.reddit_posts_raw TO authenticated;
GRANT SELECT ON public.reddit_comments TO authenticated;

-- Verify tables were created
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('reddit_posts_raw', 'reddit_comments')
ORDER BY tablename;

