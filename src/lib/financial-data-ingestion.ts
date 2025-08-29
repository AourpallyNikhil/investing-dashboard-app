// Financial data ingestion service
// Fetches data from Financial Datasets API and saves to Supabase

import { FinancialDatasetsAPI } from './financial-datasets-api'
import { supabase } from './supabase'

export interface IngestionResult {
  success: boolean
  message: string
  tickersProcessed: string[]
  errors: string[]
}

export class FinancialDataIngestion {
  private api: FinancialDatasetsAPI

  constructor(apiKey: string) {
    this.api = new FinancialDatasetsAPI(apiKey)
  }

  /**
   * Fetch and store financial metrics for a single ticker
   */
  async ingestTickerMetrics(ticker: string, periods: ('annual' | 'quarterly' | 'ttm')[] = ['ttm']): Promise<void> {
    console.log(`🔄 Ingesting financial metrics for ${ticker}...`)

    // Get company ID from database
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('ticker', ticker.toUpperCase())
      .single()

    if (companyError || !company) {
      throw new Error(`Company ${ticker} not found in database`)
    }

    for (const period of periods) {
      try {
        // Fetch financial metrics from API (only endpoint that works)
        console.log(`🔄 Fetching ${period} financial metrics for ${ticker}...`)
        const metrics = await this.api.getFinancialMetrics(ticker, period, period === 'ttm' ? 1 : 4)
        
        if (metrics.length === 0) {
          console.warn(`⚠️ No ${period} metrics found for ${ticker}`)
          continue
        }

        console.log(`✅ Found ${metrics.length} ${period} metrics for ${ticker}`)

        // Process each metric period
        for (const metric of metrics) {
          const financialMetric = {
            company_id: company.id,
            ticker: ticker.toUpperCase(),
            period,
            report_date: metric.report_date || new Date().toISOString().split('T')[0],
            
            // Valuation metrics
            market_cap: metric.market_cap,
            enterprise_value: metric.enterprise_value,
            price_to_earnings_ratio: metric.price_to_earnings_ratio,
            price_to_book_ratio: metric.price_to_book_ratio,
            price_to_sales_ratio: metric.price_to_sales_ratio,
            enterprise_value_to_ebitda_ratio: metric.enterprise_value_to_ebitda_ratio,
            enterprise_value_to_revenue_ratio: metric.enterprise_value_to_revenue_ratio,
            free_cash_flow_yield: metric.free_cash_flow_yield,
            peg_ratio: metric.peg_ratio,
            
            // Profitability metrics
            gross_margin: metric.gross_margin,
            operating_margin: metric.operating_margin,
            net_margin: metric.net_margin,
            return_on_equity: metric.return_on_equity,
            return_on_assets: metric.return_on_assets,
            return_on_invested_capital: metric.return_on_invested_capital,
            
            // Efficiency metrics
            asset_turnover: metric.asset_turnover,
            inventory_turnover: metric.inventory_turnover,
            receivables_turnover: metric.receivables_turnover,
            days_sales_outstanding: metric.days_sales_outstanding,
            operating_cycle: metric.operating_cycle,
            working_capital_turnover: metric.working_capital_turnover,
            
            // Liquidity metrics
            current_ratio: metric.current_ratio,
            quick_ratio: metric.quick_ratio,
            cash_ratio: metric.cash_ratio,
            operating_cash_flow_ratio: metric.operating_cash_flow_ratio,
            
            // Leverage metrics
            debt_to_equity: metric.debt_to_equity,
            debt_to_assets: metric.debt_to_assets,
            interest_coverage: metric.interest_coverage,
            
            // Growth metrics
            revenue_growth: metric.revenue_growth,
            earnings_growth: metric.earnings_growth,
            book_value_growth: metric.book_value_growth,
            earnings_per_share_growth: metric.earnings_per_share_growth,
            free_cash_flow_growth: metric.free_cash_flow_growth,
            operating_income_growth: metric.operating_income_growth,
            ebitda_growth: metric.ebitda_growth,
            
            // Per share metrics
            payout_ratio: metric.payout_ratio,
            earnings_per_share: metric.earnings_per_share,
            book_value_per_share: metric.book_value_per_share,
            free_cash_flow_per_share: metric.free_cash_flow_per_share,
          }

          // Upsert to database (insert or update if exists)
          const { error: upsertError } = await supabase
            .from('financial_metrics')
            .upsert(financialMetric, {
              onConflict: 'company_id,period,report_date'
            })

          if (upsertError) {
            console.error(`Error saving ${period} metrics for ${ticker}:`, upsertError)
            throw upsertError
          }
        }

        console.log(`✅ Saved ${metrics.length} ${period} metrics for ${ticker}`)
      } catch (error) {
        console.error(`❌ Error processing ${period} metrics for ${ticker}:`, error)
        throw error
      }
    }
  }

  /**
   * Fetch and store comprehensive financial statements for a single ticker
   */
  async ingestFinancialStatements(ticker: string, periods: number = 12): Promise<void> {
    console.log(`🔄 Ingesting financial statements for ${ticker} (${periods} periods)...`)

    // Get company ID from database
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('ticker', ticker.toUpperCase())
      .single()

    if (companyError || !company) {
      throw new Error(`Company ${ticker} not found in database`)
    }

    try {
      // Fetch comprehensive financial statements
      const statements = await this.api.getFinancialStatements(ticker, 'quarterly', periods)

      if (statements.income_statements.length === 0) {
        console.warn(`⚠️ No financial statements found for ${ticker}`)
        return
      }

      console.log(`✅ Processing ${statements.income_statements.length} financial statements for ${ticker}`)

      // Process each financial statement period
      for (let i = 0; i < statements.income_statements.length; i++) {
        const income = statements.income_statements[i] || {}
        const balance = statements.balance_sheets[i] || {}
        const cashFlow = statements.cash_flow_statements[i] || {}

        const financialStatement = {
          company_id: company.id,
          ticker: ticker.toUpperCase(),
          period: 'quarterly',
          report_date: income.report_period || balance.report_period || cashFlow.report_period,
          fiscal_period: income.fiscal_period,
          currency: income.currency,
          
          // Income Statement
          revenue: income.revenue,
          cost_of_revenue: income.cost_of_revenue,
          gross_profit: income.gross_profit,
          operating_expense: income.operating_expense,
          selling_general_and_administrative_expenses: income.selling_general_and_administrative_expenses,
          research_and_development: income.research_and_development,
          operating_income: income.operating_income,
          interest_expense: income.interest_expense,
          ebit: income.ebit,
          income_tax_expense: income.income_tax_expense,
          net_income_discontinued_operations: income.net_income_discontinued_operations,
          net_income_non_controlling_interests: income.net_income_non_controlling_interests,
          net_income: income.net_income,
          net_income_common_stock: income.net_income_common_stock,
          preferred_dividends_impact: income.preferred_dividends_impact,
          consolidated_income: income.consolidated_income,
          earnings_per_share: income.earnings_per_share,
          earnings_per_share_diluted: income.earnings_per_share_diluted,
          dividends_per_common_share: income.dividends_per_common_share,
          weighted_average_shares: income.weighted_average_shares,
          weighted_average_shares_diluted: income.weighted_average_shares_diluted,
          
          // Balance Sheet
          total_assets: balance.total_assets,
          current_assets: balance.current_assets,
          cash_and_equivalents: balance.cash_and_equivalents,
          inventory: balance.inventory,
          current_investments: balance.current_investments,
          trade_and_non_trade_receivables: balance.trade_and_non_trade_receivables,
          non_current_assets: balance.non_current_assets,
          property_plant_and_equipment: balance.property_plant_and_equipment,
          goodwill_and_intangible_assets: balance.goodwill_and_intangible_assets,
          investments: balance.investments,
          non_current_investments: balance.non_current_investments,
          outstanding_shares: balance.outstanding_shares,
          tax_assets: balance.tax_assets,
          total_liabilities: balance.total_liabilities,
          current_liabilities: balance.current_liabilities,
          current_debt: balance.current_debt,
          trade_and_non_trade_payables: balance.trade_and_non_trade_payables,
          deferred_revenue: balance.deferred_revenue,
          deposit_liabilities: balance.deposit_liabilities,
          non_current_liabilities: balance.non_current_liabilities,
          non_current_debt: balance.non_current_debt,
          tax_liabilities: balance.tax_liabilities,
          shareholders_equity: balance.shareholders_equity,
          retained_earnings: balance.retained_earnings,
          accumulated_other_comprehensive_income: balance.accumulated_other_comprehensive_income,
          total_debt: balance.total_debt,
          
          // Cash Flow Statement
          net_cash_flow_from_operations: cashFlow.net_cash_flow_from_operations,
          capital_expenditure: cashFlow.capital_expenditure,
          business_acquisitions_and_disposals: cashFlow.business_acquisitions_and_disposals,
          investment_acquisitions_and_disposals: cashFlow.investment_acquisitions_and_disposals,
          net_cash_flow_from_investing: cashFlow.net_cash_flow_from_investing,
          issuance_or_repayment_of_debt_securities: cashFlow.issuance_or_repayment_of_debt_securities,
          issuance_or_purchase_of_equity_shares: cashFlow.issuance_or_purchase_of_equity_shares,
          dividends_and_other_cash_distributions: cashFlow.dividends_and_other_cash_distributions,
          net_cash_flow_from_financing: cashFlow.net_cash_flow_from_financing,
          change_in_cash_and_equivalents: cashFlow.change_in_cash_and_equivalents,
          effect_of_exchange_rate_changes: cashFlow.effect_of_exchange_rate_changes,
          ending_cash_balance: cashFlow.ending_cash_balance,
          free_cash_flow: cashFlow.free_cash_flow,
        }

        // Upsert to database (insert or update if exists)
        const { error: upsertError } = await supabase
          .from('financial_statements')
          .upsert(financialStatement, {
            onConflict: 'company_id,period,report_date'
          })

        if (upsertError) {
          console.error(`Error saving financial statement for ${ticker} ${income.report_period}:`, upsertError)
          throw upsertError
        }
      }

      console.log(`✅ Successfully saved ${statements.income_statements.length} financial statements for ${ticker}`)
    } catch (error) {
      console.error(`❌ Error processing financial statements for ${ticker}:`, error)
      throw error
    }
  }

  /**
   * Fetch and store historical time series financial metrics for a single ticker
   */
  async ingestHistoricalMetrics(ticker: string, yearsBack: number = 3): Promise<void> {
    console.log(`🔄 Ingesting historical time series data for ${ticker} (${yearsBack} years)...`)

    // Get company ID from database
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('ticker', ticker.toUpperCase())
      .single()

    if (companyError || !company) {
      throw new Error(`Company ${ticker} not found in database`)
    }

    // Calculate date range (last N years)
    const endDate = new Date().toISOString().split('T')[0] // Today
    const startDate = new Date(Date.now() - (yearsBack * 365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]

    try {
      // Fetch historical quarterly data for time series analysis
      const historicalMetrics = await this.api.getHistoricalFinancialMetrics(
        ticker, 
        'quarterly', 
        startDate, 
        endDate
      )

      if (historicalMetrics.length === 0) {
        console.warn(`⚠️ No historical quarterly data found for ${ticker}`)
        return
      }

      console.log(`✅ Processing ${historicalMetrics.length} historical quarters for ${ticker}`)

      // Process each historical period
      for (const metric of historicalMetrics) {
        const financialMetric = {
          company_id: company.id,
          ticker: ticker.toUpperCase(),
          period: 'quarterly',
          report_date: metric.report_period,
          
          // Valuation metrics
          market_cap: metric.market_cap,
          enterprise_value: metric.enterprise_value,
          price_to_earnings_ratio: metric.price_to_earnings_ratio,
          price_to_book_ratio: metric.price_to_book_ratio,
          price_to_sales_ratio: metric.price_to_sales_ratio,
          enterprise_value_to_ebitda_ratio: metric.enterprise_value_to_ebitda_ratio,
          enterprise_value_to_revenue_ratio: metric.enterprise_value_to_revenue_ratio,
          free_cash_flow_yield: metric.free_cash_flow_yield,
          peg_ratio: metric.peg_ratio,
          
          // Profitability metrics
          gross_margin: metric.gross_margin,
          operating_margin: metric.operating_margin,
          net_margin: metric.net_margin,
          return_on_equity: metric.return_on_equity,
          return_on_assets: metric.return_on_assets,
          return_on_invested_capital: metric.return_on_invested_capital,
          
          // Efficiency metrics
          asset_turnover: metric.asset_turnover,
          inventory_turnover: metric.inventory_turnover,
          receivables_turnover: metric.receivables_turnover,
          days_sales_outstanding: metric.days_sales_outstanding,
          operating_cycle: metric.operating_cycle,
          working_capital_turnover: metric.working_capital_turnover,
          
          // Liquidity metrics
          current_ratio: metric.current_ratio,
          quick_ratio: metric.quick_ratio,
          cash_ratio: metric.cash_ratio,
          operating_cash_flow_ratio: metric.operating_cash_flow_ratio,
          
          // Leverage metrics
          debt_to_equity: metric.debt_to_equity,
          debt_to_assets: metric.debt_to_assets,
          interest_coverage: metric.interest_coverage,
          
          // Growth metrics
          revenue_growth: metric.revenue_growth,
          earnings_growth: metric.earnings_growth,
          book_value_growth: metric.book_value_growth,
          earnings_per_share_growth: metric.earnings_per_share_growth,
          free_cash_flow_growth: metric.free_cash_flow_growth,
          operating_income_growth: metric.operating_income_growth,
          ebitda_growth: metric.ebitda_growth,
          
          // Per share metrics
          payout_ratio: metric.payout_ratio,
          earnings_per_share: metric.earnings_per_share,
          book_value_per_share: metric.book_value_per_share,
          free_cash_flow_per_share: metric.free_cash_flow_per_share,
        }

        // Upsert to database (insert or update if exists)
        const { error: upsertError } = await supabase
          .from('financial_metrics')
          .upsert(financialMetric, {
            onConflict: 'company_id,period,report_date'
          })

        if (upsertError) {
          console.error(`Error saving historical metric for ${ticker} ${metric.report_period}:`, upsertError)
          throw upsertError
        }
      }

      console.log(`✅ Successfully saved ${historicalMetrics.length} historical quarters for ${ticker}`)
    } catch (error) {
      console.error(`❌ Error processing historical metrics for ${ticker}:`, error)
      throw error
    }
  }

  /**
   * Fetch and store financial metrics for multiple tickers
   */
  async ingestMultipleTickerMetrics(tickers: string[]): Promise<IngestionResult> {
    const result: IngestionResult = {
      success: true,
      message: '',
      tickersProcessed: [],
      errors: []
    }

    console.log(`🚀 Starting ingestion for ${tickers.length} tickers...`)

    for (const ticker of tickers) {
      try {
        await this.ingestTickerMetrics(ticker, ['ttm', 'quarterly'])
        result.tickersProcessed.push(ticker)
        console.log(`✅ Successfully processed ${ticker}`)
      } catch (error) {
        const errorMessage = `Failed to process ${ticker}: ${error instanceof Error ? error.message : 'Unknown error'}`
        result.errors.push(errorMessage)
        console.error(`❌ ${errorMessage}`)
      }
    }

    if (result.errors.length > 0) {
      result.success = false
      result.message = `Processed ${result.tickersProcessed.length}/${tickers.length} tickers. ${result.errors.length} errors occurred.`
    } else {
      result.message = `Successfully processed all ${tickers.length} tickers.`
    }

    return result
  }

  /**
   * Fetch and store financial metrics for all companies in the database
   */
  async ingestAllCompanyMetrics(): Promise<IngestionResult> {
    console.log('🔄 Fetching all companies from database...')

    const { data: companies, error } = await supabase
      .from('companies')
      .select('ticker')

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`)
    }

    const tickers = companies.map(company => company.ticker)
    console.log(`Found ${tickers.length} companies in database`)

    return this.ingestMultipleTickerMetrics(tickers)
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    return this.api.testConnection()
  }
}

// Removed ingestFinancialData convenience function - using class directly in API route
