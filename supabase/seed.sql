-- Insert sample companies
INSERT INTO companies (id, ticker, name, sector, industry, exchange, currency, country) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'AAPL', 'Apple Inc.', 'Technology', 'Consumer Electronics', 'NASDAQ', 'USD', 'US'),
  ('550e8400-e29b-41d4-a716-446655440001', 'MSFT', 'Microsoft Corporation', 'Technology', 'Software', 'NASDAQ', 'USD', 'US'),
  ('550e8400-e29b-41d4-a716-446655440002', 'GOOGL', 'Alphabet Inc.', 'Technology', 'Internet Services', 'NASDAQ', 'USD', 'US'),
  ('550e8400-e29b-41d4-a716-446655440003', 'AMZN', 'Amazon.com Inc.', 'Consumer Discretionary', 'E-commerce', 'NASDAQ', 'USD', 'US'),
  ('550e8400-e29b-41d4-a716-446655440004', 'TSLA', 'Tesla Inc.', 'Consumer Discretionary', 'Electric Vehicles', 'NASDAQ', 'USD', 'US'),
  ('550e8400-e29b-41d4-a716-446655440005', 'META', 'Meta Platforms Inc.', 'Technology', 'Social Media', 'NASDAQ', 'USD', 'US'),
  ('550e8400-e29b-41d4-a716-446655440006', 'NVDA', 'NVIDIA Corporation', 'Technology', 'Semiconductors', 'NASDAQ', 'USD', 'US'),
  ('550e8400-e29b-41d4-a716-446655440007', 'JPM', 'JPMorgan Chase & Co.', 'Financial Services', 'Banking', 'NYSE', 'USD', 'US'),
  ('550e8400-e29b-41d4-a716-446655440008', 'JNJ', 'Johnson & Johnson', 'Healthcare', 'Pharmaceuticals', 'NYSE', 'USD', 'US'),
  ('550e8400-e29b-41d4-a716-446655440009', 'V', 'Visa Inc.', 'Financial Services', 'Payment Systems', 'NYSE', 'USD', 'US');

-- Insert securities for each company
INSERT INTO securities (id, company_id, symbol, type, is_primary) VALUES
  ('660e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'AAPL', 'stock', true),
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'MSFT', 'stock', true),
  ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'GOOGL', 'stock', true),
  ('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 'AMZN', 'stock', true),
  ('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', 'TSLA', 'stock', true),
  ('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', 'META', 'stock', true),
  ('660e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440006', 'NVDA', 'stock', true),
  ('660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440007', 'JPM', 'stock', true),
  ('660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440008', 'JNJ', 'stock', true),
  ('660e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440009', 'V', 'stock', true);

-- Insert sample KPIs
INSERT INTO kpis (code, name, unit, description) VALUES
  ('pe_ttm', 'P/E Ratio (TTM)', 'ratio', 'Price to Earnings ratio based on trailing twelve months'),
  ('pb_ratio', 'P/B Ratio', 'ratio', 'Price to Book ratio'),
  ('debt_equity', 'Debt to Equity', 'ratio', 'Total debt divided by shareholder equity'),
  ('roe', 'Return on Equity', '%', 'Net income divided by shareholder equity'),
  ('roa', 'Return on Assets', '%', 'Net income divided by total assets'),
  ('gross_margin', 'Gross Margin', '%', 'Gross profit divided by revenue'),
  ('op_margin', 'Operating Margin', '%', 'Operating income divided by revenue'),
  ('fcf_yield', 'Free Cash Flow Yield', '%', 'Free cash flow divided by market cap');

-- Generate sample price data for the last year (simplified version)
DO $$
DECLARE
    company_record RECORD;
    security_record RECORD;
    start_date DATE := CURRENT_DATE - INTERVAL '365 days';
    current_date DATE;
    base_price DECIMAL(12,4);
    daily_change DECIMAL(5,4);
    current_price DECIMAL(12,4);
    daily_volume BIGINT;
BEGIN
    -- Loop through each security
    FOR security_record IN 
        SELECT s.id, s.symbol, c.ticker 
        FROM securities s 
        JOIN companies c ON s.company_id = c.id 
        WHERE s.is_primary = true
    LOOP
        -- Set different base prices for different stocks
        CASE security_record.ticker
            WHEN 'AAPL' THEN base_price := 150.00;
            WHEN 'MSFT' THEN base_price := 300.00;
            WHEN 'GOOGL' THEN base_price := 2800.00;
            WHEN 'AMZN' THEN base_price := 3200.00;
            WHEN 'TSLA' THEN base_price := 800.00;
            WHEN 'META' THEN base_price := 350.00;
            WHEN 'NVDA' THEN base_price := 450.00;
            WHEN 'JPM' THEN base_price := 140.00;
            WHEN 'JNJ' THEN base_price := 160.00;
            WHEN 'V' THEN base_price := 230.00;
            ELSE base_price := 100.00;
        END CASE;
        
        current_price := base_price;
        current_date := start_date;
        
        -- Generate daily prices for the year
        WHILE current_date <= CURRENT_DATE LOOP
            -- Skip weekends
            IF EXTRACT(DOW FROM current_date) NOT IN (0, 6) THEN
                -- Random daily change between -5% and +5%
                daily_change := (RANDOM() - 0.5) * 0.1;
                current_price := current_price * (1 + daily_change);
                
                -- Ensure price doesn't go below $1
                IF current_price < 1.00 THEN
                    current_price := 1.00;
                END IF;
                
                -- Random volume between 1M and 100M
                daily_volume := (RANDOM() * 99000000 + 1000000)::BIGINT;
                
                -- Insert price data
                INSERT INTO prices_daily (security_id, d, open, high, low, close, volume)
                VALUES (
                    security_record.id,
                    current_date,
                    current_price * (1 + (RANDOM() - 0.5) * 0.02), -- open
                    current_price * (1 + RANDOM() * 0.03), -- high
                    current_price * (1 - RANDOM() * 0.03), -- low
                    current_price, -- close
                    daily_volume
                );
            END IF;
            
            current_date := current_date + INTERVAL '1 day';
        END LOOP;
    END LOOP;
END $$;

-- Insert sample quarterly fundamentals for the last 2 years
DO $$
DECLARE
    company_record RECORD;
    year_val INTEGER;
    quarter_val TEXT;
    base_revenue BIGINT;
    revenue_growth DECIMAL(5,4);
    current_revenue BIGINT;
BEGIN
    FOR company_record IN SELECT id, ticker FROM companies LOOP
        -- Set different base revenues for different companies
        CASE company_record.ticker
            WHEN 'AAPL' THEN base_revenue := 90000000000; -- $90B
            WHEN 'MSFT' THEN base_revenue := 45000000000; -- $45B
            WHEN 'GOOGL' THEN base_revenue := 65000000000; -- $65B
            WHEN 'AMZN' THEN base_revenue := 110000000000; -- $110B
            WHEN 'TSLA' THEN base_revenue := 15000000000; -- $15B
            WHEN 'META' THEN base_revenue := 28000000000; -- $28B
            WHEN 'NVDA' THEN base_revenue := 8000000000; -- $8B
            WHEN 'JPM' THEN base_revenue := 30000000000; -- $30B
            WHEN 'JNJ' THEN base_revenue := 23000000000; -- $23B
            WHEN 'V' THEN base_revenue := 6000000000; -- $6B
            ELSE base_revenue := 5000000000; -- $5B
        END CASE;
        
        current_revenue := base_revenue;
        
        -- Generate data for 2023 and 2024
        FOR year_val IN 2023..2024 LOOP
            FOR quarter_val IN ARRAY['Q1', 'Q2', 'Q3', 'Q4'] LOOP
                -- Random revenue growth between -10% and +20%
                revenue_growth := (RANDOM() - 0.3) * 0.3;
                current_revenue := (current_revenue * (1 + revenue_growth))::BIGINT;
                
                INSERT INTO fundamentals_quarterly (
                    company_id, fiscal_year, fiscal_period, report_date,
                    revenue, gross_profit, operating_income, net_income,
                    shares_diluted, eps_basic, eps_diluted,
                    cash_from_operations, capex, total_assets, total_liabilities, shareholder_equity
                ) VALUES (
                    company_record.id,
                    year_val,
                    quarter_val,
                    (year_val || '-' || LPAD(((POSITION(quarter_val IN 'Q1Q2Q3Q4') + 1) / 2 * 3)::TEXT, 2, '0') || '-15')::DATE,
                    current_revenue,
                    (current_revenue * (0.3 + RANDOM() * 0.4))::BIGINT, -- 30-70% gross margin
                    (current_revenue * (0.1 + RANDOM() * 0.3))::BIGINT, -- 10-40% operating margin
                    (current_revenue * (0.05 + RANDOM() * 0.25))::BIGINT, -- 5-30% net margin
                    (1000000000 + RANDOM() * 4000000000)::BIGINT, -- 1-5B shares
                    (1 + RANDOM() * 8)::DECIMAL(10,4), -- $1-9 EPS
                    (1 + RANDOM() * 8)::DECIMAL(10,4), -- $1-9 EPS diluted
                    (current_revenue * (0.15 + RANDOM() * 0.25))::BIGINT, -- 15-40% of revenue
                    (current_revenue * (0.05 + RANDOM() * 0.15))::BIGINT, -- 5-20% of revenue
                    (current_revenue * (2 + RANDOM() * 3))::BIGINT, -- 2-5x revenue in assets
                    (current_revenue * (1 + RANDOM() * 2))::BIGINT, -- 1-3x revenue in liabilities
                    (current_revenue * (0.5 + RANDOM() * 1.5))::BIGINT  -- 0.5-2x revenue in equity
                );
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- Create a default watchlist
INSERT INTO watchlists (id, name, is_default) VALUES
  ('770e8400-e29b-41d4-a716-446655440000', 'Tech Stocks', true);

-- Add some companies to the default watchlist
INSERT INTO watchlist_items (watchlist_id, company_id) VALUES
  ('770e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000'), -- AAPL
  ('770e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'), -- MSFT
  ('770e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440002'), -- GOOGL
  ('770e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440006'); -- NVDA
