-- PART 2: Create indexes, views, and functions (run this second)
-- Execute this AFTER running run-migrations-fixed.sql

-- Create all indexes
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

CREATE INDEX IF NOT EXISTS idx_economic_data_series_id ON economic_data(series_id);
CREATE INDEX IF NOT EXISTS idx_economic_data_series_key ON economic_data(series_key);
CREATE INDEX IF NOT EXISTS idx_economic_data_date ON economic_data(date DESC);
CREATE INDEX IF NOT EXISTS idx_economic_data_series_date ON economic_data(series_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_economic_data_period ON economic_data(period DESC);

-- Create database views
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


