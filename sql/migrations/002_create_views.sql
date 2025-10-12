-- Create view for trailing twelve months EPS
CREATE OR REPLACE VIEW v_eps_ttm AS
WITH quarterly_eps AS (
  SELECT 
    company_id,
    fiscal_year,
    fiscal_period,
    report_date,
    eps_diluted,
    ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY fiscal_year DESC, fiscal_period DESC) as rn
  FROM fundamentals_quarterly
  WHERE eps_diluted IS NOT NULL
),
ttm_eps AS (
  SELECT 
    company_id,
    MAX(report_date) as report_date,
    SUM(eps_diluted) as eps_ttm
  FROM quarterly_eps
  WHERE rn <= 4  -- Last 4 quarters
  GROUP BY company_id
  HAVING COUNT(*) = 4  -- Ensure we have complete 4 quarters
)
SELECT * FROM ttm_eps;

-- Create view for P/E ratios with daily prices
CREATE OR REPLACE VIEW v_pe_ttm_daily AS
WITH latest_prices AS (
  SELECT DISTINCT
    s.id as security_id,
    s.company_id,
    pd.d as date,
    pd.close,
    ROW_NUMBER() OVER (PARTITION BY s.company_id ORDER BY pd.d DESC) as rn
  FROM securities s
  JOIN prices_daily pd ON s.id = pd.security_id
  WHERE s.is_primary = true
    AND pd.close IS NOT NULL
),
pe_ratios AS (
  SELECT 
    lp.security_id,
    lp.date,
    CASE 
      WHEN eps.eps_ttm > 0 THEN lp.close / eps.eps_ttm
      ELSE NULL
    END as pe_ttm
  FROM latest_prices lp
  JOIN v_eps_ttm eps ON lp.company_id = eps.company_id
  WHERE lp.rn <= 365  -- Last year of data
)
SELECT * FROM pe_ratios;
