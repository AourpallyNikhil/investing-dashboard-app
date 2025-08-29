// Data ingestion service - fetches from Financial Datasets API and saves to Supabase
import { supabase } from './supabase'
import { FinancialDatasetsAPI } from './financial-datasets-api'
import { getEnabledTickers, getTickersByPriority, type TickerConfig } from './ticker-config'

export class DataIngestionService {
  private api: FinancialDatasetsAPI

  constructor(apiKey: string) {
    this.api = new FinancialDatasetsAPI(apiKey)
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<boolean> {
    return await this.api.testConnection()
  }

  /**
   * Ensure company exists in database, create if not
   */
  private async ensureCompanyExists(tickerConfig: TickerConfig): Promise<string> {
    // Check if company exists
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('ticker', tickerConfig.ticker)
      .single()

    if (existing) {
      return existing.id
    }

    // Create company
    const { data: newCompany, error } = await supabase
      .from('companies')
      .insert({
        ticker: tickerConfig.ticker,
        name: tickerConfig.name,
        sector: tickerConfig.sector,
        industry: tickerConfig.industry
      })
      .select('id')
      .single()

    if (error || !newCompany) {
      throw new Error(`Failed to create company ${tickerConfig.ticker}: ${error?.message}`)
    }

    // Create primary security
    await supabase
      .from('securities')
      .insert({
        company_id: newCompany.id,
        symbol: tickerConfig.ticker,
        type: 'stock',
        is_primary: true
      })

    console.log(`✅ Created company: ${tickerConfig.ticker}`)
    return newCompany.id
  }

  /**
   * Fetch and store stock prices for a ticker
   */
  async ingestPrices(ticker: string, days: number = 30): Promise<number> {
    console.log(`🔄 Ingesting prices for ${ticker} (${days} days)...`)

    const tickerConfig = getEnabledTickers().find(t => t.ticker === ticker)
    if (!tickerConfig) {
      throw new Error(`Ticker ${ticker} not found in enabled tickers`)
    }

    const companyId = await this.ensureCompanyExists(tickerConfig)

    // Get security ID
    const { data: security } = await supabase
      .from('securities')
      .select('id')
      .eq('company_id', companyId)
      .eq('is_primary', true)
      .single()

    if (!security) {
      throw new Error(`No primary security found for ${ticker}`)
    }

    // Fetch prices from API
    const prices = await this.api.getStockPrices(ticker, days)
    if (prices.length === 0) {
      console.log(`⚠️ No price data received for ${ticker}`)
      return 0
    }

    // Prepare data for insertion
    const priceRows = prices.map(price => ({
      security_id: security.id,
      d: price.date,
      open: price.open,
      high: price.high,
      low: price.low,
      close: price.close,
      volume: price.volume
    }))

    // Insert prices (upsert to handle duplicates)
    const { error } = await supabase
      .from('prices_daily')
      .upsert(priceRows, {
        onConflict: 'security_id,d'
      })

    if (error) {
      throw new Error(`Failed to insert prices for ${ticker}: ${error.message}`)
    }

    console.log(`✅ Ingested ${prices.length} price records for ${ticker}`)
    return prices.length
  }

  /**
   * Fetch and store fundamental data for a ticker
   */
  async ingestFundamentals(ticker: string, quarters: number = 8): Promise<number> {
    console.log(`🔄 Ingesting fundamentals for ${ticker} (${quarters} quarters)...`)

    const tickerConfig = getEnabledTickers().find(t => t.ticker === ticker)
    if (!tickerConfig) {
      throw new Error(`Ticker ${ticker} not found in enabled tickers`)
    }

    const companyId = await this.ensureCompanyExists(tickerConfig)

    // Fetch income statements
    const incomeStatements = await this.api.getIncomeStatements(ticker, 'quarterly', quarters)
    if (incomeStatements.length === 0) {
      console.log(`⚠️ No fundamental data received for ${ticker}`)
      return 0
    }

    // Fetch balance sheets
    const balanceSheets = await this.api.getBalanceSheets(ticker, 'quarterly', quarters)

    // Prepare fundamentals data
    const fundamentalRows = incomeStatements.map(stmt => {
      const balanceSheet = balanceSheets.find(bs => 
        bs.fiscal_year === stmt.fiscal_year && bs.fiscal_period === stmt.fiscal_period
      )

      return {
        company_id: companyId,
        fiscal_year: stmt.fiscal_year,
        fiscal_period: stmt.fiscal_period,
        report_date: stmt.period_ending,
        revenue: stmt.revenue,
        gross_profit: stmt.gross_profit,
        operating_income: stmt.operating_income,
        net_income: stmt.net_income,
        shares_diluted: stmt.shares_diluted,
        eps_basic: stmt.eps_basic,
        eps_diluted: stmt.eps_diluted,
        total_assets: balanceSheet?.total_assets || null,
        total_liabilities: balanceSheet?.total_liabilities || null,
        shareholder_equity: balanceSheet?.shareholder_equity || null
      }
    })

    // Insert fundamentals (upsert to handle duplicates)
    const { error } = await supabase
      .from('fundamentals_quarterly')
      .upsert(fundamentalRows, {
        onConflict: 'company_id,fiscal_year,fiscal_period'
      })

    if (error) {
      throw new Error(`Failed to insert fundamentals for ${ticker}: ${error.message}`)
    }

    console.log(`✅ Ingested ${fundamentalRows.length} fundamental records for ${ticker}`)
    return fundamentalRows.length
  }

  /**
   * Full data ingestion for a single ticker
   */
  async ingestTicker(ticker: string): Promise<{ prices: number; fundamentals: number }> {
    console.log(`🚀 Starting full ingestion for ${ticker}`)

    const results = {
      prices: await this.ingestPrices(ticker, 30), // Last 30 days
      fundamentals: await this.ingestFundamentals(ticker, 8) // Last 8 quarters
    }

    console.log(`✅ Completed ingestion for ${ticker}: ${results.prices} prices, ${results.fundamentals} fundamentals`)
    return results
  }

  /**
   * Batch ingestion for all enabled high-priority tickers
   */
  async ingestHighPriorityTickers(): Promise<Record<string, { prices: number; fundamentals: number }>> {
    const highPriorityTickers = getTickersByPriority('high')
    console.log(`🚀 Starting batch ingestion for ${highPriorityTickers.length} high-priority tickers`)

    const results: Record<string, { prices: number; fundamentals: number }> = {}

    for (const tickerConfig of highPriorityTickers) {
      try {
        results[tickerConfig.ticker] = await this.ingestTicker(tickerConfig.ticker)
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`❌ Failed to ingest ${tickerConfig.ticker}:`, error)
        results[tickerConfig.ticker] = { prices: 0, fundamentals: 0 }
      }
    }

    console.log('✅ Batch ingestion completed:', results)
    return results
  }

  /**
   * Get ingestion status/stats
   */
  async getIngestionStats(): Promise<{
    companies: number
    latestPrices: Array<{ ticker: string; latestDate: string; recordCount: number }>
    latestFundamentals: Array<{ ticker: string; latestQuarter: string; recordCount: number }>
  }> {
    const { data: companies } = await supabase
      .from('companies')
      .select('ticker')

    const { data: priceStats } = await supabase
      .from('companies')
      .select(`
        ticker,
        securities!inner(
          prices_daily(d)
        )
      `)

    const { data: fundamentalStats } = await supabase
      .from('companies')
      .select(`
        ticker,
        fundamentals_quarterly(fiscal_year, fiscal_period)
      `)

    return {
      companies: companies?.length || 0,
      latestPrices: (priceStats || []).map((company: any) => {
        const prices = company.securities?.[0]?.prices_daily || []
        const sortedDates = prices.map((p: any) => p.d).sort()
        return {
          ticker: company.ticker,
          latestDate: sortedDates[sortedDates.length - 1] || 'No data',
          recordCount: prices.length
        }
      }),
      latestFundamentals: (fundamentalStats || []).map((company: any) => {
        const fundamentals = company.fundamentals_quarterly || []
        const latest = fundamentals.sort((a: any, b: any) => 
          b.fiscal_year - a.fiscal_year || b.fiscal_period.localeCompare(a.fiscal_period)
        )[0]
        return {
          ticker: company.ticker,
          latestQuarter: latest ? `${latest.fiscal_year} ${latest.fiscal_period}` : 'No data',
          recordCount: fundamentals.length
        }
      })
    }
  }
}
