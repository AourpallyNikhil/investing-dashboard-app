-- Create configuration tables for admin dashboard
-- This migration creates tables to store configurable data sources

-- Table for Reddit subreddit configurations
CREATE TABLE IF NOT EXISTS public.reddit_sources (
  id SERIAL PRIMARY KEY,
  subreddit VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for Twitter account configurations  
CREATE TABLE IF NOT EXISTS public.twitter_sources (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200),
  description TEXT,
  follower_count INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for general application settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  setting_type VARCHAR(50) NOT NULL DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default Reddit sources (from current hardcoded list)
INSERT INTO public.reddit_sources (subreddit, display_name, description) VALUES
  ('wallstreetbets', 'WallStreetBets', 'Popular retail trading community'),
  ('investing', 'Investing', 'General investment discussions'),
  ('stocks', 'Stocks', 'Stock market discussions'),
  ('StockMarket', 'Stock Market', 'Stock market news and analysis'),
  ('ValueInvesting', 'Value Investing', 'Value investing strategies')
ON CONFLICT (subreddit) DO NOTHING;

-- Insert default Twitter sources (subset of current hardcoded list)
INSERT INTO public.twitter_sources (username, display_name, description, follower_count) VALUES
  ('jimcramer', 'Jim Cramer', 'CNBC Mad Money host', 2000000),
  ('CathieDWood', 'Cathie Wood', 'ARK Invest CEO', 1500000),
  ('charliebilello', 'Charlie Bilello', 'Chief Market Strategist', 800000),
  ('markminervini', 'Mark Minervini', 'Champion trader', 600000),
  ('PeterLBrandt', 'Peter L. Brandt', 'Legendary trader', 500000),
  ('BrianFeroldi', 'Brian Feroldi', 'Stock educator', 400000),
  ('morganhousel', 'Morgan Housel', 'Author of Psychology of Money', 300000),
  ('iancassel', 'Ian Cassel', 'Microcap investor', 200000),
  ('Ritholtz', 'Barry Ritholtz', 'CIO at Ritholtz Wealth', 150000),
  ('grahamstephan', 'Graham Stephan', 'Investor and YouTuber', 100000)
ON CONFLICT (username) DO NOTHING;

-- Insert default app settings
INSERT INTO public.app_settings (setting_key, setting_value, setting_type, description) VALUES
  ('cron_schedule', '0 9 * * *', 'string', 'Cron schedule for data collection (daily at 9 AM UTC)'),
  ('data_retention_days', '30', 'number', 'Number of days to retain raw data'),
  ('max_posts_per_source', '50', 'number', 'Maximum posts to fetch per source'),
  ('llm_model', 'gpt-4', 'string', 'LLM model to use for analysis'),
  ('sentiment_confidence_threshold', '0.7', 'number', 'Minimum confidence for sentiment analysis')
ON CONFLICT (setting_key) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reddit_sources_active ON public.reddit_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_twitter_sources_active ON public.twitter_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(setting_key);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reddit_sources_updated_at BEFORE UPDATE ON public.reddit_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twitter_sources_updated_at BEFORE UPDATE ON public.twitter_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security) if needed
ALTER TABLE public.reddit_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twitter_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on reddit_sources" ON public.reddit_sources FOR ALL USING (true);
CREATE POLICY "Allow all operations on twitter_sources" ON public.twitter_sources FOR ALL USING (true);
CREATE POLICY "Allow all operations on app_settings" ON public.app_settings FOR ALL USING (true);


