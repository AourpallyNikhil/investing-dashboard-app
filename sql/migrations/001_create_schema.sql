-- Create companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(10) NOT NULL UNIQUE,
  name TEXT,
  sector TEXT,
  industry TEXT,
  exchange VARCHAR(10),
  currency VARCHAR(3) DEFAULT 'USD',
  country VARCHAR(3) DEFAULT 'US',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create securities table
CREATE TABLE securities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  type VARCHAR(20) DEFAULT 'stock',
  is_primary BOOLEAN DEFAULT true
);

-- Create daily prices table
CREATE TABLE prices_daily (
  security_id UUID NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
  d DATE NOT NULL,
  open DECIMAL(12,4),
  high DECIMAL(12,4),
  low DECIMAL(12,4),
  close DECIMAL(12,4),
  volume BIGINT,
  PRIMARY KEY (security_id, d)
);

-- Create quarterly fundamentals table
CREATE TABLE fundamentals_quarterly (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  fiscal_period VARCHAR(2) NOT NULL, -- Q1, Q2, Q3, Q4
  report_date DATE,
  revenue BIGINT,
  gross_profit BIGINT,
  operating_income BIGINT,
  net_income BIGINT,
  shares_diluted BIGINT,
  eps_basic DECIMAL(10,4),
  eps_diluted DECIMAL(10,4),
  cash_from_operations BIGINT,
  capex BIGINT,
  total_assets BIGINT,
  total_liabilities BIGINT,
  shareholder_equity BIGINT,
  sbc BIGINT, -- Stock-based compensation
  PRIMARY KEY (company_id, fiscal_year, fiscal_period)
);

-- Create KPIs table for metrics definitions
CREATE TABLE kpis (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  unit VARCHAR(10),
  description TEXT
);

-- Create KPI values table for time series metrics
CREATE TABLE kpi_values (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kpi_id INTEGER NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  ts DATE NOT NULL,
  value DECIMAL(15,4),
  confidence DECIMAL(3,2), -- 0.00 to 1.00
  source VARCHAR(50),
  PRIMARY KEY (company_id, kpi_id, ts)
);

-- Create watchlists table for user portfolios
CREATE TABLE watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- Will be linked to auth.users later
  name VARCHAR(100) NOT NULL DEFAULT 'My Watchlist',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create watchlist items table
CREATE TABLE watchlist_items (
  watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (watchlist_id, company_id)
);

-- Create indexes for better performance
CREATE INDEX idx_companies_ticker ON companies(ticker);
CREATE INDEX idx_companies_sector ON companies(sector);
CREATE INDEX idx_securities_company_id ON securities(company_id);
CREATE INDEX idx_prices_daily_d ON prices_daily(d);
CREATE INDEX idx_fundamentals_quarterly_date ON fundamentals_quarterly(report_date);
CREATE INDEX idx_kpi_values_ts ON kpi_values(ts);
CREATE INDEX idx_watchlist_items_company_id ON watchlist_items(company_id);
