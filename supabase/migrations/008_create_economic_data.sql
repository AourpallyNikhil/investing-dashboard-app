-- Create economic data tables for macro analysis
-- These tables store BLS API data and other economic indicators

-- Create table for storing economic data from BLS API
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

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_economic_data_series_id ON economic_data(series_id);
CREATE INDEX IF NOT EXISTS idx_economic_data_series_key ON economic_data(series_key);
CREATE INDEX IF NOT EXISTS idx_economic_data_date ON economic_data(date DESC);
CREATE INDEX IF NOT EXISTS idx_economic_data_series_date ON economic_data(series_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_economic_data_period ON economic_data(period DESC);

-- Insert initial metadata record
INSERT INTO economic_data_metadata (last_bls_fetch, total_records) 
VALUES (NULL, 0)
ON CONFLICT DO NOTHING;

-- Create updated_at triggers
CREATE TRIGGER update_economic_data_updated_at 
  BEFORE UPDATE ON economic_data 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_economic_data_metadata_updated_at 
  BEFORE UPDATE ON economic_data_metadata 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

