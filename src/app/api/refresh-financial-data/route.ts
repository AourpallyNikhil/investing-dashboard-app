import { NextRequest, NextResponse } from 'next/server'
import { FinancialDataIngestion } from '@/lib/financial-data-ingestion'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting financial data refresh...')
    
    // Get API key from server environment
    const apiKey = process.env.FINANCIAL_DATASETS_API_KEY
    if (!apiKey) {
      throw new Error('FINANCIAL_DATASETS_API_KEY environment variable is required')
    }

    // Get optional tickers from request body
    const body = await request.json().catch(() => ({}))
    const tickers = body.tickers as string[] | undefined

    // Create ingestion service and process data
    const ingestion = new FinancialDataIngestion(apiKey)
    
    // Test connection first
    const connected = await ingestion.testConnection()
    if (!connected) {
      throw new Error('Failed to connect to Financial Datasets API')
    }

    // Ingest current data
    const result = tickers && tickers.length > 0 
      ? await ingestion.ingestMultipleTickerMetrics(tickers)
      : await ingestion.ingestAllCompanyMetrics()

    // Also ingest comprehensive financial statements and historical data
    console.log('🔄 Starting comprehensive financial data ingestion...')
    
    // If no specific tickers provided, get all tickers from watchlists
    let tickersToProcess: string[] = []
    if (tickers && tickers.length > 0) {
      tickersToProcess = tickers
    } else {
      // Get all tickers from watchlists instead of hardcoded defaults
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      const { data: watchlistTickers } = await supabase
        .from('watchlist_items')
        .select('companies!inner(ticker)')
      
      tickersToProcess = watchlistTickers?.map((item: any) => item.companies.ticker) || ['HOOD', 'AAPL']
      console.log(`📊 Auto-detected watchlist tickers: ${tickersToProcess.join(', ')}`)
    }
    
    for (const ticker of tickersToProcess) {
      try {
        // Fetch financial statements (income, balance sheet, cash flow)
        await ingestion.ingestFinancialStatements(ticker, 12) // Last 12 quarters
        console.log(`✅ Financial statements ingested for ${ticker}`)
        
        // Fetch historical metrics for ratios and analysis
        await ingestion.ingestHistoricalMetrics(ticker, 3) // Last 3 years
        console.log(`✅ Historical metrics ingested for ${ticker}`)
      } catch (error) {
        console.error(`❌ Failed to ingest comprehensive data for ${ticker}:`, error)
        // Don't fail the whole operation for data issues
      }
    }

    console.log('✅ Financial data refresh completed:', result)

    return NextResponse.json({
      success: result.success,
      message: result.message,
      data: {
        tickersProcessed: result.tickersProcessed,
        errors: result.errors,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Financial data refresh failed:', error)
    
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      data: null
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST method to refresh financial data',
    example: {
      method: 'POST',
      body: {
        tickers: ['AAPL', 'GOOGL'] // Optional: specific tickers, or omit to refresh all
      }
    }
  })
}
