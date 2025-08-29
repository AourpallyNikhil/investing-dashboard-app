import { supabase } from './supabase'
import { Company, ScreenerRow, ChartDataPoint, TimeRange } from './types'

// Query functions for TanStack Query
export const queryKeys = {
  companies: ['companies'] as const,
  company: (ticker: string) => ['company', ticker] as const,
  screener: (filters?: Record<string, unknown>) => ['screener', filters] as const,
  prices: (ticker: string, timeRange: string) => ['prices', ticker, timeRange] as const,
  fundamentals: (ticker: string) => ['fundamentals', ticker] as const,
  kpiValues: (ticker: string, kpiCode: string) => ['kpiValues', ticker, kpiCode] as const,
  financialMetrics: (ticker: string, period?: string) => ['financialMetrics', ticker, period] as const,
}

export async function fetchCompanies(): Promise<Company[]> {
  // Get companies that are in watchlists
  const { data, error } = await supabase
    .from('watchlist_items')
    .select(`
      companies!inner(
        id,
        ticker,
        name,
        sector,
        industry,
        exchange,
        currency,
        country,
        created_at
      )
    `)
    .order('ticker', { referencedTable: 'companies' })

  if (error) throw error
  
  // Extract companies from the nested structure
  return (data || []).map((item: any) => item.companies)
}

export async function fetchCompany(ticker: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('ticker', ticker)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function fetchScreenerData(filters?: {
  peMin?: number
  peMax?: number
  revYoyMin?: number
  fcfYieldMin?: number
  grossMarginMin?: number
}): Promise<ScreenerRow[]> {
  // Get companies that are in watchlists
  const { data: watchlistCompanies, error: watchlistError } = await supabase
    .from('watchlist_items')
    .select(`
      companies!inner(
        ticker,
        name,
        sector,
        exchange
      )
    `)

  if (watchlistError) throw watchlistError

  if (!watchlistCompanies || watchlistCompanies.length === 0) {
    return []
  }

  // Get the tickers from watchlist
  const tickers = watchlistCompanies.map((item: any) => item.companies.ticker)

  // Get financial metrics for these tickers
  const { data: metricsData, error: metricsError } = await supabase
    .from('financial_metrics')
    .select('*')
    .in('ticker', tickers)
    .eq('period', 'ttm')
    .order('report_date', { ascending: false })

  if (metricsError) throw metricsError

  // Transform the data to match ScreenerRow interface
  const screenerData: ScreenerRow[] = watchlistCompanies.map((item: any) => {
    const company = item.companies
    const metrics = (metricsData as any[])?.find((m: any) => m.ticker === company.ticker)
    
    return {
      ticker: String(company.ticker || ''),
      name: company.name ? String(company.name) : null,
      close: null, // TODO: Add stock price data
      pe_ttm: metrics?.price_to_earnings_ratio ? Number(metrics.price_to_earnings_ratio) : null,
      rev_yoy: metrics?.revenue_growth ? Number(metrics.revenue_growth) : null,
      fcf_yield: metrics?.free_cash_flow_yield ? Number(metrics.free_cash_flow_yield) : null,
      gross_margin: metrics?.gross_margin ? Number(metrics.gross_margin) : null,
      op_margin: metrics?.operating_margin ? Number(metrics.operating_margin) : null,
    }
  })

  // Apply filters if provided
  if (filters) {
    return screenerData.filter(row => {
      if (filters.peMin && (row.pe_ttm || 0) < filters.peMin) return false
      if (filters.peMax && (row.pe_ttm || 0) > filters.peMax) return false
      if (filters.revYoyMin && (row.rev_yoy || 0) < filters.revYoyMin) return false
      if (filters.fcfYieldMin && (row.fcf_yield || 0) < filters.fcfYieldMin) return false
      if (filters.grossMarginMin && (row.gross_margin || 0) < filters.grossMarginMin) return false
      return true
    })
  }

  return screenerData
}

export async function fetchPriceData(ticker: string, days: number = 365): Promise<ChartDataPoint[]> {
  // Get the company and its security
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select(`
      id,
      securities!inner(
        id,
        prices_daily(
          d,
          close,
          volume
        )
      )
    `)
    .eq('ticker', ticker)
    .single()

  if (companyError) {
    console.error('Error fetching company:', companyError)
    return []
  }

  if (!company?.securities?.[0]?.prices_daily) {
    return []
  }

  // Get price data and sort by date
  const prices = company.securities[0].prices_daily
    .sort((a: any, b: any) => new Date(a.d).getTime() - new Date(b.d).getTime())
    .slice(-days) // Get last N days

  return prices.map((price: any) => ({
    date: price.d,
    close: Number(price.close),
    volume: Number(price.volume || 0),
  }))
}

export async function fetchFundamentalsData(ticker: string): Promise<ChartDataPoint[]> {
  // Get the company's fundamentals
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select(`
      id,
      fundamentals_quarterly(
        fiscal_year,
        fiscal_period,
        revenue,
        gross_profit,
        operating_income,
        eps_diluted
      )
    `)
    .eq('ticker', ticker)
    .single()

  if (companyError) {
    console.error('Error fetching fundamentals:', companyError)
    return []
  }

  if (!company?.fundamentals_quarterly) {
    return []
  }

  // Sort by year and quarter
  const fundamentals = company.fundamentals_quarterly
    .sort((a: any, b: any) => {
      if (a.fiscal_year !== b.fiscal_year) {
        return a.fiscal_year - b.fiscal_year
      }
      return a.fiscal_period.localeCompare(b.fiscal_period)
    })

  return fundamentals.map((f: any) => ({
    date: `${f.fiscal_year}-${f.fiscal_period}`,
    revenue: Number(f.revenue || 0) / 1000000, // Convert to millions
    eps_diluted: Number(f.eps_diluted || 0),
    gross_margin: f.revenue && f.gross_profit ? 
      (Number(f.gross_profit) / Number(f.revenue)) * 100 : 0,
    operating_margin: f.revenue && f.operating_income ? 
      (Number(f.operating_income) / Number(f.revenue)) * 100 : 0,
  }))
}

export async function fetchKpiValues(ticker: string, kpiCode: string): Promise<ChartDataPoint[]> {
  // Get the company's KPI values
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select(`
      id,
      kpi_values!inner(
        ts,
        value,
        kpis!inner(
          code
        )
      )
    `)
    .eq('ticker', ticker)
    .eq('kpi_values.kpis.code', kpiCode)
    .order('ts', { referencedTable: 'kpi_values', ascending: true })

  if (companyError) {
    console.error('Error fetching KPI values:', companyError)
    return []
  }

  if (!company?.kpi_values) {
    return []
  }

  return company.kpi_values.map((kv: any) => ({
    date: kv.ts,
    value: Number(kv.value || 0),
  }))
}

export async function fetchFinancialMetrics(ticker: string, period: string = 'ttm'): Promise<any[]> {
  const { data, error } = await supabase
    .from('financial_metrics')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .eq('period', period)
    .order('report_date', { ascending: false })

  if (error) {
    console.error('Error fetching financial metrics:', error)
    return []
  }

  return data || []
}

export async function fetchLatestFinancialMetrics(ticker: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('financial_metrics')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .eq('period', 'ttm')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('Error fetching latest financial metrics:', error)
    return null
  }

  return data
}

// Time range configurations
export const timeRanges: TimeRange[] = [
  { label: '1M', value: '1M', days: 30 },
  { label: '3M', value: '3M', days: 90 },
  { label: '6M', value: '6M', days: 180 },
  { label: '1Y', value: '1Y', days: 365 },
  { label: '3Y', value: '3Y', days: 1095 },
  { label: '5Y', value: '5Y', days: 1825 },
  { label: 'Max', value: 'Max', days: 3650 },
]
