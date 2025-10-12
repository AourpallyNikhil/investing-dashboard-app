-- Create interest rates table for macro economic data
CREATE TABLE IF NOT EXISTS interest_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank VARCHAR(10) NOT NULL,
  name VARCHAR(255) NOT NULL,
  rate DECIMAL(8,4) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(bank, name, date)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_interest_rates_bank ON interest_rates(bank);
CREATE INDEX IF NOT EXISTS idx_interest_rates_date ON interest_rates(date);
CREATE INDEX IF NOT EXISTS idx_interest_rates_bank_date ON interest_rates(bank, date);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_interest_rates_updated_at 
  BEFORE UPDATE ON interest_rates 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add some sample data comments for reference
COMMENT ON TABLE interest_rates IS 'Historical interest rate data from major central banks worldwide';
COMMENT ON COLUMN interest_rates.bank IS 'Central bank code (FED, ECB, BOJ, PBOC, BOE, etc.)';
COMMENT ON COLUMN interest_rates.name IS 'Interest rate name/type (Federal Funds Rate, ECB Main Refinancing Rate, etc.)';
COMMENT ON COLUMN interest_rates.rate IS 'Interest rate as percentage (e.g., 5.25 for 5.25%)';
COMMENT ON COLUMN interest_rates.date IS 'Date when the rate was effective';
