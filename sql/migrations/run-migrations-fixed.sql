-- PART 1: Create all tables first (run this first)
-- Execute this in Supabase SQL Editor: https://supabase.com/dashboard/project/yfqdtjwgvsixnhyseqbi/sql

-- Create table for storing processed sentiment data aggregations
CREATE TABLE IF NOT EXISTS sentiment_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(10) NOT NULL,
  sentiment_score DECIMAL(4,3) NOT NULL, -- -1.000 to 1.000
  sentiment_label VARCHAR(20) NOT NULL, -- 'positive', 'negative', 'neutral'
  mention_count INTEGER NOT NULL DEFAULT 0,
  confidence DECIMAL(3,2) DEFAULT 0.80, -- 0.00 to 1.00
  key_themes TEXT[] DEFAULT '{}', -- Array of key themes
  summary TEXT DEFAULT '',
  source_breakdown JSONB DEFAULT '{}', -- JSON object with source details
  trending_contexts TEXT[] DEFAULT '{}', -- Array of trending contexts
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for storing raw Reddit posts with comprehensive metadata
CREATE TABLE IF NOT EXISTS reddit_posts_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reddit identifiers
  post_id VARCHAR(50) NOT NULL UNIQUE, -- Reddit post ID (e.g., "abc123")
  fullname VARCHAR(100), -- Reddit fullname (e.g., "t3_abc123")
  
  -- Post content
  title TEXT NOT NULL,
  selftext TEXT DEFAULT '', -- Post body/content
  selftext_html TEXT DEFAULT '', -- HTML version if available
  
  -- Author info
  author VARCHAR(100) NOT NULL,
  author_fullname VARCHAR(100), -- Reddit author ID
  author_flair_text TEXT,
  author_flair_css_class VARCHAR(100),
  
  -- Subreddit info
  subreddit VARCHAR(50) NOT NULL,
  subreddit_id VARCHAR(50),
  subreddit_name_prefixed VARCHAR(60), -- e.g., "r/wallstreetbets"
  subreddit_type VARCHAR(20), -- public, private, etc.
  
  -- Engagement metrics
  score INTEGER DEFAULT 0, -- Net upvotes
  upvote_ratio DECIMAL(3,2), -- 0.00 to 1.00
  ups INTEGER DEFAULT 0, -- Total upvotes
  downs INTEGER DEFAULT 0, -- Total downvotes
  num_comments INTEGER DEFAULT 0,
  
  -- Post metadata
  created_utc INTEGER NOT NULL, -- Unix timestamp from Reddit
  edited BOOLEAN DEFAULT false, -- Whether post was edited
  distinguished VARCHAR(20), -- moderator, admin, etc.
  stickied BOOLEAN DEFAULT false,
  locked BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  removed_by_category VARCHAR(50), -- If removed: spam, moderator, etc.
  
  -- URLs and links
  url TEXT NOT NULL, -- Link URL or Reddit permalink
  permalink TEXT NOT NULL, -- Reddit permalink
  shortlink VARCHAR(100), -- Short Reddit link
  thumbnail VARCHAR(255), -- Thumbnail URL
  
  -- Post classification
  post_hint VARCHAR(50), -- image, video, link, etc.
  domain VARCHAR(100), -- Domain of linked content
  is_self BOOLEAN DEFAULT true, -- Text post vs link post
  is_video BOOLEAN DEFAULT false,
  over_18 BOOLEAN DEFAULT false, -- NSFW flag
  
  -- Awards and gilding
  total_awards_received INTEGER DEFAULT 0,
  gilded INTEGER DEFAULT 0, -- Number of gold awards
  all_awardings JSONB DEFAULT '[]', -- Full awards data
  
  -- Flair
  link_flair_text TEXT,
  link_flair_css_class VARCHAR(100),
  link_flair_type VARCHAR(20), -- text, richtext
  
  -- AI analysis fields
  extracted_tickers TEXT[] DEFAULT '{}', -- Stock tickers found in post
  sentiment_score DECIMAL(4,3), -- Overall sentiment (-1.000 to 1.000)
  sentiment_label VARCHAR(20), -- positive, negative, neutral
  key_topics TEXT[] DEFAULT '{}', -- Main topics discussed
  ai_summary TEXT, -- LLM-generated summary
  processed_at TIMESTAMP WITH TIME ZONE, -- When AI analysis was done
  
  -- Raw data for future analysis
  raw_json JSONB, -- Complete Reddit API response
  
  -- Timestamps
  retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for Reddit comments with threading support
CREATE TABLE IF NOT EXISTS reddit_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reddit identifiers
  comment_id VARCHAR(50) NOT NULL UNIQUE, -- Reddit comment ID (e.g., "def456")
  fullname VARCHAR(100), -- Reddit fullname (e.g., "t1_def456")
  post_id VARCHAR(50) NOT NULL, -- Links to reddit_posts_raw.post_id
  parent_id VARCHAR(50), -- Parent comment ID for threading
  
  -- Comment content
  body TEXT NOT NULL, -- Comment text content
  body_html TEXT DEFAULT '', -- HTML version if available
  
  -- Author info
  author VARCHAR(100) NOT NULL,
  author_fullname VARCHAR(100),
  author_flair_text TEXT,
  author_flair_css_class VARCHAR(100),
  
  -- Engagement metrics
  score INTEGER DEFAULT 0, -- Net upvotes
  ups INTEGER DEFAULT 0, -- Total upvotes
  downs INTEGER DEFAULT 0, -- Total downvotes
  controversiality INTEGER DEFAULT 0, -- Reddit controversiality score
  
  -- Comment metadata
  created_utc INTEGER NOT NULL, -- Unix timestamp
  edited BOOLEAN DEFAULT false, -- Whether comment was edited
  distinguished VARCHAR(20), -- moderator, admin, etc.
  stickied BOOLEAN DEFAULT false,
  depth INTEGER DEFAULT 0, -- Comment depth in thread (0 = top-level)
  
  -- Comment classification
  is_submitter BOOLEAN DEFAULT false, -- Whether author is the post author
  score_hidden BOOLEAN DEFAULT false, -- Whether score is hidden
  archived BOOLEAN DEFAULT false,
  locked BOOLEAN DEFAULT false,
  
  -- Awards
  total_awards_received INTEGER DEFAULT 0,
  gilded INTEGER DEFAULT 0,
  all_awardings JSONB DEFAULT '[]',
  
  -- AI analysis fields
  extracted_tickers TEXT[] DEFAULT '{}', -- Stock tickers mentioned
  sentiment_score DECIMAL(4,3), -- Comment sentiment (-1.000 to 1.000)
  sentiment_label VARCHAR(20), -- positive, negative, neutral
  key_topics TEXT[] DEFAULT '{}', -- Main topics discussed
  ai_summary TEXT, -- LLM-generated summary
  reply_to_analysis TEXT, -- Analysis of what this comment is responding to
  argument_type VARCHAR(50), -- 'supporting', 'opposing', 'neutral', 'question'
  processed_at TIMESTAMP WITH TIME ZONE, -- When AI analysis was done
  
  -- Raw data preservation
  raw_json JSONB, -- Complete Reddit API response
  
  -- Timestamps
  retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign key constraint
  CONSTRAINT fk_reddit_comments_post 
    FOREIGN KEY (post_id) 
    REFERENCES reddit_posts_raw(post_id) 
    ON DELETE CASCADE
);

-- Create table for simple Reddit posts (backward compatibility with UI)
CREATE TABLE IF NOT EXISTS reddit_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id VARCHAR(50) NOT NULL, -- Reddit post ID
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  author VARCHAR(100) NOT NULL,
  score INTEGER DEFAULT 0,
  num_comments INTEGER DEFAULT 0,
  url TEXT NOT NULL,
  permalink TEXT NOT NULL,
  subreddit VARCHAR(50) NOT NULL,
  created_utc INTEGER NOT NULL, -- Unix timestamp from Reddit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(post_id)
);

-- Create economic data tables
CREATE TABLE IF NOT EXISTS economic_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id VARCHAR(100) NOT NULL, -- BLS series identifier
  series_key VARCHAR(100) NOT NULL, -- Internal key for easier querying
  series_name TEXT NOT NULL, -- Human-readable name
  value DECIMAL(15,4) NOT NULL, -- Data value
  date DATE NOT NULL, -- Data date
  period VARCHAR(20) NOT NULL, -- Period identifier (YYYY-MM)
  unit VARCHAR(50), -- Unit of measurement
  data_source TEXT DEFAULT 'Bureau of Labor Statistics', -- Source attribution
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(series_id, date)
);

-- Create metadata table to track BLS API fetches
CREATE TABLE IF NOT EXISTS economic_data_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_bls_fetch TIMESTAMP WITH TIME ZONE,
  bls_sources TEXT[], -- Array of sources returned by BLS API
  total_records INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial metadata record for economic data
INSERT INTO economic_data_metadata (last_bls_fetch, total_records) 
VALUES (NULL, 0)
ON CONFLICT DO NOTHING;


