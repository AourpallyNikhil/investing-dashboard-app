-- Create financial_metrics table to store data from Financial Datasets API
CREATE TABLE IF NOT EXISTS financial_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    ticker VARCHAR(10) NOT NULL,
    period VARCHAR(20) NOT NULL, -- 'annual', 'quarterly', 'ttm'
    report_date DATE,
    
    -- Valuation metrics
    market_cap BIGINT,
    enterprise_value BIGINT,
    price_to_earnings_ratio DECIMAL(10,2),
    price_to_book_ratio DECIMAL(10,2),
    price_to_sales_ratio DECIMAL(10,2),
    enterprise_value_to_ebitda_ratio DECIMAL(10,2),
    enterprise_value_to_revenue_ratio DECIMAL(10,2),
    free_cash_flow_yield DECIMAL(10,4),
    peg_ratio DECIMAL(10,2),
    
    -- Profitability metrics
    gross_margin DECIMAL(10,4),
    operating_margin DECIMAL(10,4),
    net_margin DECIMAL(10,4),
    return_on_equity DECIMAL(10,4),
    return_on_assets DECIMAL(10,4),
    return_on_invested_capital DECIMAL(10,4),
    
    -- Efficiency metrics
    asset_turnover DECIMAL(10,2),
    inventory_turnover DECIMAL(10,2),
    receivables_turnover DECIMAL(10,2),
    days_sales_outstanding DECIMAL(10,2),
    operating_cycle DECIMAL(10,2),
    working_capital_turnover DECIMAL(10,2),
    
    -- Liquidity metrics
    current_ratio DECIMAL(10,2),
    quick_ratio DECIMAL(10,2),
    cash_ratio DECIMAL(10,2),
    operating_cash_flow_ratio DECIMAL(10,2),
    
    -- Leverage metrics
    debt_to_equity DECIMAL(10,2),
    debt_to_assets DECIMAL(10,2),
    interest_coverage DECIMAL(10,2),
    
    -- Growth metrics
    revenue_growth DECIMAL(10,4),
    earnings_growth DECIMAL(10,4),
    book_value_growth DECIMAL(10,4),
    earnings_per_share_growth DECIMAL(10,4),
    free_cash_flow_growth DECIMAL(10,4),
    operating_income_growth DECIMAL(10,4),
    ebitda_growth DECIMAL(10,4),
    
    -- Per share metrics
    payout_ratio DECIMAL(10,4),
    earnings_per_share DECIMAL(10,2),
    book_value_per_share DECIMAL(10,2),
    free_cash_flow_per_share DECIMAL(10,2),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(company_id, period, report_date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_financial_metrics_ticker ON financial_metrics(ticker);
CREATE INDEX IF NOT EXISTS idx_financial_metrics_company_id ON financial_metrics(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_metrics_period ON financial_metrics(period);
CREATE INDEX IF NOT EXISTS idx_financial_metrics_report_date ON financial_metrics(report_date);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_financial_metrics_updated_at BEFORE UPDATE
    ON financial_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
