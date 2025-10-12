-- Fix ticker field length in sentiment_data table
-- Some tickers and company identifiers are longer than 10 characters

-- Increase ticker field length from VARCHAR(10) to VARCHAR(20)
ALTER TABLE sentiment_data 
ALTER COLUMN ticker TYPE VARCHAR(20);

-- Add comment explaining the change
COMMENT ON COLUMN sentiment_data.ticker IS 'Stock ticker symbol or company identifier (up to 20 characters)';
