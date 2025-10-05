-- Create inflation data table for caching Gemini API results
CREATE TABLE IF NOT EXISTS inflation_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(5) NOT NULL, -- US, EU, JP, UK
  country_name VARCHAR(50) NOT NULL, -- United States, European Union, Japan, United Kingdom
  inflation_rate DECIMAL(8,4) NOT NULL, -- Inflation rate as percentage (e.g., 3.1 for 3.1%)
  date DATE NOT NULL, -- Date in YYYY-MM-DD format (first day of month)
  period VARCHAR(10) NOT NULL, -- YYYY-MM format for easy querying
  data_source VARCHAR(255), -- Source of the data (e.g., "Bureau of Labor Statistics")
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(country_code, period)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_inflation_data_country ON inflation_data(country_code);
CREATE INDEX IF NOT EXISTS idx_inflation_data_period ON inflation_data(period);
CREATE INDEX IF NOT EXISTS idx_inflation_data_date ON inflation_data(date);
CREATE INDEX IF NOT EXISTS idx_inflation_data_country_period ON inflation_data(country_code, period);

-- Create updated_at trigger (reuse existing function)
CREATE TRIGGER update_inflation_data_updated_at 
  BEFORE UPDATE ON inflation_data 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create a metadata table to track when we last fetched from Gemini API
CREATE TABLE IF NOT EXISTS inflation_data_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_gemini_fetch TIMESTAMP WITH TIME ZONE,
  gemini_sources TEXT[], -- Array of sources returned by Gemini
  total_records INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial metadata record
INSERT INTO inflation_data_metadata (last_gemini_fetch, total_records) 
VALUES (NULL, 0)
ON CONFLICT DO NOTHING;

-- Create updated_at trigger for metadata
CREATE TRIGGER update_inflation_data_metadata_updated_at 
  BEFORE UPDATE ON inflation_data_metadata 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE inflation_data IS 'Cached inflation rate data from Gemini Flash API to reduce token costs';
COMMENT ON COLUMN inflation_data.country_code IS 'ISO country code (US, EU, JP, UK)';
COMMENT ON COLUMN inflation_data.inflation_rate IS 'Year-over-year CPI inflation rate as percentage';
COMMENT ON COLUMN inflation_data.period IS 'YYYY-MM format for the inflation period';
COMMENT ON COLUMN inflation_data.data_source IS 'Official source of the data (BLS, Eurostat, etc.)';

COMMENT ON TABLE inflation_data_metadata IS 'Tracks when inflation data was last fetched from Gemini API';
COMMENT ON COLUMN inflation_data_metadata.last_gemini_fetch IS 'Timestamp of last successful Gemini API call';
COMMENT ON COLUMN inflation_data_metadata.gemini_sources IS 'Array of data sources returned by last Gemini call';



