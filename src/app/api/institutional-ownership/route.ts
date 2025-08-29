import { NextRequest, NextResponse } from 'next/server'
import { FinancialDatasetsAPI } from '@/lib/financial-datasets-api'

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Fetching institutional ownership data...')
    
    // Get API key from server environment
    const apiKey = process.env.FINANCIAL_DATASETS_API_KEY
    if (!apiKey) {
      throw new Error('FINANCIAL_DATASETS_API_KEY environment variable is required')
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const ticker = searchParams.get('ticker')
    const limit = parseInt(searchParams.get('limit') || '100')
    const reportPeriodGte = searchParams.get('report_period_gte')
    const reportPeriodLte = searchParams.get('report_period_lte')

    if (!ticker) {
      return NextResponse.json(
        { success: false, message: 'Ticker parameter is required' },
        { status: 400 }
      )
    }

    // Create API client and fetch data
    const api = new FinancialDatasetsAPI(apiKey)
    
    console.log(`🔄 Fetching institutional ownership for ${ticker}...`)
    const ownership = await api.getInstitutionalOwnership(
      ticker,
      limit,
      reportPeriodGte || undefined,
      reportPeriodLte || undefined
    )

    console.log(`✅ Found ${ownership.length} institutional ownership records for ${ticker}`)

    return NextResponse.json({
      success: true,
      data: {
        ticker: ticker.toUpperCase(),
        ownership,
        count: ownership.length,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Institutional ownership fetch failed:', error)
    
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      data: null
    }, { status: 500 })
  }
}

export async function POST() {
  return NextResponse.json({
    message: 'Use GET method to fetch institutional ownership data',
    example: {
      method: 'GET',
      url: '/api/institutional-ownership?ticker=HOOD&limit=100&report_period_gte=2023-01-01'
    }
  })
}
