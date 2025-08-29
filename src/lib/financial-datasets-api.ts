// Financial Datasets API integration
// Documentation: https://docs.financialdatasets.ai/introduction

export interface FinancialDatasetsConfig {
  apiKey: string
  baseUrl: string
}

export interface StockPrice {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface IncomeStatement {
  period_ending: string
  fiscal_year: number
  fiscal_period: string
  revenue: number
  gross_profit: number
  operating_income: number
  net_income: number
  eps_basic: number
  eps_diluted: number
  shares_basic: number
  shares_diluted: number
}

export interface BalanceSheet {
  period_ending: string
  fiscal_year: number
  fiscal_period: string
  total_assets: number
  total_liabilities: number
  shareholder_equity: number
  cash_and_equivalents: number
  total_debt: number
}

export class FinancialDatasetsAPI {
  private config: FinancialDatasetsConfig

  constructor(apiKey: string) {
    this.config = {
      apiKey,
      baseUrl: 'https://api.financialdatasets.ai'
    }
  }

  private async makeRequest(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(`${this.config.baseUrl}${endpoint}`)
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })

    const headers = {
      'X-API-KEY': this.config.apiKey,
      'Content-Type': 'application/json'
    }

    console.log(`🔄 Fetching: ${url.toString()}`)

    const response = await fetch(url.toString(), { headers })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    console.log(`✅ Received ${Object.keys(data).length} data fields`)
    return data
  }

  /**
   * Fetch historical stock prices
   * @param ticker Stock symbol (e.g., 'AAPL')
   * @param limit Number of days to fetch (default: 30)
   */
  async getStockPrices(ticker: string, limit: number = 30): Promise<StockPrice[]> {
    try {
      const data = await this.makeRequest('/stock-prices', {
        ticker: ticker.toUpperCase(),
        limit: limit.toString()
      })

      return (data.prices || []).map((price: any) => ({
        date: price.date,
        open: parseFloat(price.open || 0),
        high: parseFloat(price.high || 0),
        low: parseFloat(price.low || 0),
        close: parseFloat(price.close || 0),
        volume: parseInt(price.volume || 0)
      }))
    } catch (error) {
      console.error(`❌ Error fetching prices for ${ticker}:`, error)
      return []
    }
  }

  /**
   * Fetch income statements
   * @param ticker Stock symbol
   * @param period 'annual', 'quarterly', or 'ttm'
   * @param limit Number of statements to fetch
   */
  async getIncomeStatements(
    ticker: string, 
    period: 'annual' | 'quarterly' | 'ttm' = 'quarterly',
    limit: number = 8
  ): Promise<IncomeStatement[]> {
    try {
      const data = await this.makeRequest('/income-statements', {
        ticker: ticker.toUpperCase(),
        period,
        limit: limit.toString()
      })

      return (data.income_statements || []).map((stmt: any) => ({
        period_ending: stmt.period_ending,
        fiscal_year: parseInt(stmt.fiscal_year || 0),
        fiscal_period: stmt.fiscal_period || '',
        revenue: parseFloat(stmt.revenue || 0),
        gross_profit: parseFloat(stmt.gross_profit || 0),
        operating_income: parseFloat(stmt.operating_income || 0),
        net_income: parseFloat(stmt.net_income || 0),
        eps_basic: parseFloat(stmt.eps_basic || 0),
        eps_diluted: parseFloat(stmt.eps_diluted || 0),
        shares_basic: parseFloat(stmt.shares_basic || 0),
        shares_diluted: parseFloat(stmt.shares_diluted || 0)
      }))
    } catch (error) {
      console.error(`❌ Error fetching income statements for ${ticker}:`, error)
      return []
    }
  }

  /**
   * Fetch balance sheets
   * @param ticker Stock symbol
   * @param period 'annual', 'quarterly', or 'ttm'
   * @param limit Number of statements to fetch
   */
  async getBalanceSheets(
    ticker: string,
    period: 'annual' | 'quarterly' = 'quarterly', 
    limit: number = 8
  ): Promise<BalanceSheet[]> {
    try {
      const data = await this.makeRequest('/balance-sheets', {
        ticker: ticker.toUpperCase(),
        period,
        limit: limit.toString()
      })

      return (data.balance_sheets || []).map((sheet: any) => ({
        period_ending: sheet.period_ending,
        fiscal_year: parseInt(sheet.fiscal_year || 0),
        fiscal_period: sheet.fiscal_period || '',
        total_assets: parseFloat(sheet.total_assets || 0),
        total_liabilities: parseFloat(sheet.total_liabilities || 0),
        shareholder_equity: parseFloat(sheet.shareholder_equity || 0),
        cash_and_equivalents: parseFloat(sheet.cash_and_equivalents || 0),
        total_debt: parseFloat(sheet.total_debt || 0)
      }))
    } catch (error) {
      console.error(`❌ Error fetching balance sheets for ${ticker}:`, error)
      return []
    }
  }

  /**
   * Fetch financial metrics (comprehensive ratios and metrics)
   * @param ticker Stock symbol
   * @param period 'annual', 'quarterly', or 'ttm'
   * @param limit Number of periods to fetch
   */
  async getFinancialMetrics(
    ticker: string,
    period: 'annual' | 'quarterly' | 'ttm' = 'ttm',
    limit: number = 4
  ): Promise<any[]> {
    try {
      const data = await this.makeRequest('/financial-metrics', {
        ticker: ticker.toUpperCase(),
        period,
        limit: limit.toString()
      })
      return data.financial_metrics || []
    } catch (error) {
      console.error(`❌ Error fetching financial metrics for ${ticker}:`, error)
      return []
    }
  }

  /**
   * Fetch comprehensive financial statements (income, balance sheet, cash flow)
   * @param ticker Stock symbol
   * @param period 'annual' or 'quarterly'
   * @param limit Number of periods to fetch
   */
  async getFinancialStatements(
    ticker: string,
    period: 'annual' | 'quarterly' = 'quarterly',
    limit: number = 12
  ): Promise<any> {
    try {
      console.log(`🔄 Fetching financial statements for ${ticker} (${period}, ${limit} periods)`)
      
      const data = await this.makeRequest('/financials', {
        ticker: ticker.toUpperCase(),
        period,
        limit: limit.toString()
      })

      const result = {
        income_statements: data.financials?.income_statements || [],
        balance_sheets: data.financials?.balance_sheets || [],
        cash_flow_statements: data.financials?.cash_flow_statements || []
      }

      console.log(`✅ Found ${result.income_statements.length} income statements, ${result.balance_sheets.length} balance sheets, ${result.cash_flow_statements.length} cash flow statements`)
      
      return result
    } catch (error) {
      console.error(`❌ Error fetching financial statements for ${ticker}:`, error)
      return { income_statements: [], balance_sheets: [], cash_flow_statements: [] }
    }
  }

  /**
   * Fetch historical financial metrics with date range for time series analysis
   * @param ticker Stock symbol
   * @param period 'annual', 'quarterly', or 'ttm'
   * @param startDate Start date (YYYY-MM-DD)
   * @param endDate End date (YYYY-MM-DD)
   */
  async getHistoricalFinancialMetrics(
    ticker: string,
    period: 'annual' | 'quarterly' = 'quarterly',
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    try {
      console.log(`🔄 Fetching historical ${period} metrics for ${ticker} from ${startDate} to ${endDate}`)
      
      const data = await this.makeRequest('/financial-metrics', {
        ticker: ticker.toUpperCase(),
        period,
        report_period_gte: startDate,
        report_period_lte: endDate
      })
      
      const metrics = data.financial_metrics || []
      console.log(`✅ Found ${metrics.length} historical ${period} periods for ${ticker}`)
      
      return metrics.sort((a: any, b: any) => {
        // Sort by report_period chronologically (oldest first)
        return new Date(a.report_period).getTime() - new Date(b.report_period).getTime()
      })
    } catch (error) {
      console.error(`❌ Error fetching historical financial metrics for ${ticker}:`, error)
      return []
    }
  }

  /**
   * Fetch institutional ownership data
   * @param ticker Stock symbol
   * @param limit Number of holdings to return (default: 100)
   * @param reportPeriodGte Start date for filtering (YYYY-MM-DD)
   * @param reportPeriodLte End date for filtering (YYYY-MM-DD)
   */
  async getInstitutionalOwnership(
    ticker: string,
    limit: number = 100,
    reportPeriodGte?: string,
    reportPeriodLte?: string
  ): Promise<any[]> {
    try {
      console.log(`🔄 Fetching institutional ownership for ${ticker} (limit: ${limit})`)
      
      const params: Record<string, string> = {
        ticker: ticker.toUpperCase(),
        limit: limit.toString()
      }
      
      if (reportPeriodGte) {
        params.report_period_gte = reportPeriodGte
      }
      if (reportPeriodLte) {
        params.report_period_lte = reportPeriodLte
      }

      const data = await this.makeRequest('/institutional-ownership', params)
      const ownership = data['institutional-ownership'] || data['institutional_ownership'] || []
      
      console.log(`✅ Found ${ownership.length} institutional ownership records for ${ticker}`)
      return ownership
    } catch (error) {
      console.error(`❌ Error fetching institutional ownership for ${ticker}:`, error)
      return []
    }
  }

  /**
   * Fetch insider trades
   * @param ticker Stock symbol
   * @param limit Number of trades to fetch
   */
  async getInsiderTrades(ticker: string, limit: number = 10): Promise<any[]> {
    try {
      const data = await this.makeRequest('/insider-trades', {
        ticker: ticker.toUpperCase(),
        limit: limit.toString()
      })
      return data['insider-trades'] || []
    } catch (error) {
      console.error(`❌ Error fetching insider trades for ${ticker}:`, error)
      return []
    }
  }

  /**
   * Fetch historical interest rates from major central banks
   * @param bank Central bank code (e.g., 'FED', 'ECB', 'BOJ', 'PBOC')
   * @param startDate Start date in YYYY-MM-DD format
   * @param endDate End date in YYYY-MM-DD format
   */
  async getInterestRates(
    bank: string = 'FED',
    startDate?: string,
    endDate?: string
  ): Promise<any[]> {
    try {
      console.log(`🔄 Fetching interest rates for ${bank}...`)
      
      const params: Record<string, string> = {
        bank: bank.toUpperCase()
      }
      
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      
      const data = await this.makeRequest('/macro/interest-rates', params)
      
      const rates = data.interest_rates || []
      console.log(`✅ Found ${rates.length} interest rate records for ${bank}`)
      
      return rates
    } catch (error) {
      console.error(`❌ Error fetching interest rates for ${bank}:`, error)
      return []
    }
  }

  /**
   * Get available central banks for interest rate data
   */
  async getAvailableBanks(): Promise<string[]> {
    try {
      const data = await this.makeRequest('/macro/interest-rates/banks')
      return data.banks || []
    } catch (error) {
      console.error('❌ Error fetching available banks:', error)
      return ['FED', 'ECB', 'BOJ', 'PBOC', 'BOE'] // Fallback to major banks
    }
  }

  /**
   * Test API connection and key validity
   */
  async testConnection(ticker: string = 'AAPL'): Promise<boolean> {
    try {
      const data = await this.makeRequest('/financial-metrics', {
        ticker,
        period: 'ttm',
        limit: '1'
      })
      console.log('✅ API connection successful!')
      return true
    } catch (error) {
      console.error('❌ API connection failed:', error)
      return false
    }
  }
}
