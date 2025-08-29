-- Create financial_statements table to store comprehensive financial data
CREATE TABLE IF NOT EXISTS financial_statements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    ticker VARCHAR(10) NOT NULL,
    period VARCHAR(20) NOT NULL, -- 'annual', 'quarterly'
    report_date DATE NOT NULL,
    fiscal_period VARCHAR(10),
    currency VARCHAR(3),
    
    -- Income Statement
    revenue BIGINT,
    cost_of_revenue BIGINT,
    gross_profit BIGINT,
    operating_expense BIGINT,
    selling_general_and_administrative_expenses BIGINT,
    research_and_development BIGINT,
    operating_income BIGINT,
    interest_expense BIGINT,
    ebit BIGINT,
    income_tax_expense BIGINT,
    net_income_discontinued_operations BIGINT,
    net_income_non_controlling_interests BIGINT,
    net_income BIGINT,
    net_income_common_stock BIGINT,
    preferred_dividends_impact BIGINT,
    consolidated_income BIGINT,
    earnings_per_share DECIMAL(10,2),
    earnings_per_share_diluted DECIMAL(10,2),
    dividends_per_common_share DECIMAL(10,2),
    weighted_average_shares BIGINT,
    weighted_average_shares_diluted BIGINT,
    
    -- Balance Sheet
    total_assets BIGINT,
    current_assets BIGINT,
    cash_and_equivalents BIGINT,
    inventory BIGINT,
    current_investments BIGINT,
    trade_and_non_trade_receivables BIGINT,
    non_current_assets BIGINT,
    property_plant_and_equipment BIGINT,
    goodwill_and_intangible_assets BIGINT,
    investments BIGINT,
    non_current_investments BIGINT,
    outstanding_shares BIGINT,
    tax_assets BIGINT,
    total_liabilities BIGINT,
    current_liabilities BIGINT,
    current_debt BIGINT,
    trade_and_non_trade_payables BIGINT,
    deferred_revenue BIGINT,
    deposit_liabilities BIGINT,
    non_current_liabilities BIGINT,
    non_current_debt BIGINT,
    tax_liabilities BIGINT,
    shareholders_equity BIGINT,
    retained_earnings BIGINT,
    accumulated_other_comprehensive_income BIGINT,
    total_debt BIGINT,
    
    -- Cash Flow Statement
    net_cash_flow_from_operations BIGINT,
    capital_expenditure BIGINT,
    business_acquisitions_and_disposals BIGINT,
    investment_acquisitions_and_disposals BIGINT,
    net_cash_flow_from_investing BIGINT,
    issuance_or_repayment_of_debt_securities BIGINT,
    issuance_or_purchase_of_equity_shares BIGINT,
    dividends_and_other_cash_distributions BIGINT,
    net_cash_flow_from_financing BIGINT,
    change_in_cash_and_equivalents BIGINT,
    effect_of_exchange_rate_changes BIGINT,
    ending_cash_balance BIGINT,
    free_cash_flow BIGINT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(company_id, period, report_date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_financial_statements_ticker ON financial_statements(ticker);
CREATE INDEX IF NOT EXISTS idx_financial_statements_company_id ON financial_statements(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_statements_period ON financial_statements(period);
CREATE INDEX IF NOT EXISTS idx_financial_statements_report_date ON financial_statements(report_date);

-- Create updated_at trigger
CREATE TRIGGER update_financial_statements_updated_at BEFORE UPDATE
    ON financial_statements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
