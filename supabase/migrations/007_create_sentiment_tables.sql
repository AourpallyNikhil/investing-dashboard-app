-- Create sentiment analysis tables for Reddit data collection and AI analysis
-- These tables support the daily cron job that collects Reddit posts and comments

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

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sentiment_data_ticker ON sentiment_data(ticker);
CREATE INDEX IF NOT EXISTS idx_sentiment_data_created_at ON sentiment_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_data_ticker_created ON sentiment_data(ticker, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reddit_posts_raw_post_id ON reddit_posts_raw(post_id);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_raw_subreddit ON reddit_posts_raw(subreddit);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_raw_created_utc ON reddit_posts_raw(created_utc DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_raw_retrieved_at ON reddit_posts_raw(retrieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_raw_score ON reddit_posts_raw(score DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_raw_tickers ON reddit_posts_raw USING GIN(extracted_tickers);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_raw_sentiment ON reddit_posts_raw(sentiment_score DESC) WHERE sentiment_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reddit_posts_raw_processed ON reddit_posts_raw(processed_at DESC) WHERE processed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reddit_comments_comment_id ON reddit_comments(comment_id);
CREATE INDEX IF NOT EXISTS idx_reddit_comments_post_id ON reddit_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_reddit_comments_parent_id ON reddit_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_reddit_comments_author ON reddit_comments(author);
CREATE INDEX IF NOT EXISTS idx_reddit_comments_created_utc ON reddit_comments(created_utc DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_comments_retrieved_at ON reddit_comments(retrieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_comments_score ON reddit_comments(score DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_comments_depth ON reddit_comments(depth);
CREATE INDEX IF NOT EXISTS idx_reddit_comments_tickers ON reddit_comments USING GIN(extracted_tickers);
CREATE INDEX IF NOT EXISTS idx_reddit_comments_sentiment ON reddit_comments(sentiment_score DESC) WHERE sentiment_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reddit_comments_processed ON reddit_comments(processed_at DESC) WHERE processed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reddit_posts_subreddit ON reddit_posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_created_utc ON reddit_posts(created_utc DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_created_at ON reddit_posts(created_at DESC);

-- Create views for easy querying
CREATE OR REPLACE VIEW reddit_posts_with_sentiment AS
SELECT 
  post_id,
  title,
  selftext,
  author,
  subreddit,
  score,
  num_comments,
  created_utc,
  url,
  permalink,
  extracted_tickers,
  sentiment_score,
  sentiment_label,
  key_topics,
  ai_summary,
  retrieved_at,
  CASE 
    WHEN processed_at IS NOT NULL THEN 'processed'
    ELSE 'pending'
  END as analysis_status
FROM reddit_posts_raw
WHERE retrieved_at >= NOW() - INTERVAL '7 days'
ORDER BY retrieved_at DESC;

-- Create view for posts by ticker
CREATE OR REPLACE VIEW reddit_posts_by_ticker AS
SELECT 
  unnest(extracted_tickers) as ticker,
  post_id,
  title,
  selftext,
  author,
  subreddit,
  score,
  num_comments,
  sentiment_score,
  sentiment_label,
  ai_summary,
  retrieved_at
FROM reddit_posts_raw
WHERE array_length(extracted_tickers, 1) > 0
  AND retrieved_at >= NOW() - INTERVAL '30 days'
ORDER BY retrieved_at DESC;

-- Create view for comments with post context
CREATE OR REPLACE VIEW reddit_comments_with_context AS
SELECT 
  c.comment_id,
  c.body,
  c.author,
  c.score,
  c.depth,
  c.created_utc,
  c.extracted_tickers,
  c.sentiment_score,
  c.sentiment_label,
  c.ai_summary,
  c.argument_type,
  -- Post context
  p.post_id,
  p.title as post_title,
  p.subreddit,
  p.author as post_author,
  c.retrieved_at
FROM reddit_comments c
JOIN reddit_posts_raw p ON c.post_id = p.post_id
WHERE c.retrieved_at >= NOW() - INTERVAL '7 days'
ORDER BY c.retrieved_at DESC, c.score DESC;

-- Create view for threaded comment analysis
CREATE OR REPLACE VIEW reddit_comment_threads AS
SELECT 
  c.post_id,
  p.title as post_title,
  p.subreddit,
  COUNT(*) as total_comments,
  COUNT(*) FILTER (WHERE c.depth = 0) as top_level_comments,
  AVG(c.sentiment_score) as avg_sentiment,
  COUNT(*) FILTER (WHERE c.sentiment_score > 0.3) as positive_comments,
  COUNT(*) FILTER (WHERE c.sentiment_score < -0.3) as negative_comments,
  ARRAY_AGG(DISTINCT unnest(c.extracted_tickers)) FILTER (WHERE array_length(c.extracted_tickers, 1) > 0) as discussed_tickers,
  MAX(c.score) as highest_comment_score,
  COUNT(*) FILTER (WHERE c.score > 10) as highly_upvoted_comments
FROM reddit_comments c
JOIN reddit_posts_raw p ON c.post_id = p.post_id
WHERE c.retrieved_at >= NOW() - INTERVAL '7 days'
  AND c.processed_at IS NOT NULL
GROUP BY c.post_id, p.title, p.subreddit
ORDER BY total_comments DESC;

-- Create view for comments by ticker
CREATE OR REPLACE VIEW reddit_comments_by_ticker AS
SELECT 
  unnest(c.extracted_tickers) as ticker,
  c.comment_id,
  c.body,
  c.author,
  c.score,
  c.sentiment_score,
  c.sentiment_label,
  c.ai_summary,
  c.argument_type,
  p.title as post_title,
  p.subreddit,
  c.retrieved_at
FROM reddit_comments c
JOIN reddit_posts_raw p ON c.post_id = p.post_id
WHERE array_length(c.extracted_tickers, 1) > 0
  AND c.retrieved_at >= NOW() - INTERVAL '30 days'
ORDER BY c.retrieved_at DESC, c.score DESC;

-- Function to get comment thread for a specific post
CREATE OR REPLACE FUNCTION get_comment_thread(post_id_param VARCHAR(50))
RETURNS TABLE (
  comment_id VARCHAR(50),
  parent_id VARCHAR(50),
  body TEXT,
  author VARCHAR(100),
  score INTEGER,
  depth INTEGER,
  sentiment_score DECIMAL(4,3),
  argument_type VARCHAR(50),
  created_utc INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.comment_id,
    c.parent_id,
    c.body,
    c.author,
    c.score,
    c.depth,
    c.sentiment_score,
    c.argument_type,
    c.created_utc
  FROM reddit_comments c
  WHERE c.post_id = post_id_param
  ORDER BY c.depth ASC, c.score DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old posts and comments (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_reddit_data()
RETURNS void AS $$
BEGIN
  DELETE FROM reddit_posts_raw 
  WHERE retrieved_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM reddit_comments 
  WHERE retrieved_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM reddit_posts 
  WHERE created_at < NOW() - INTERVAL '3 days';
  
  RAISE NOTICE 'Cleaned up Reddit data older than 30 days';
END;
$$ LANGUAGE plpgsql;
