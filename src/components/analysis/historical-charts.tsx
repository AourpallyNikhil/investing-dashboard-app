'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { ClientOnly } from '@/components/client-only'

interface HistoricalChartsProps {
  ticker: string
}

export function HistoricalCharts({ ticker }: HistoricalChartsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'quarterly' | 'annual'>('quarterly')
  const [activeChart, setActiveChart] = useState('revenue')

  // Fetch comprehensive historical financial data from database
  const { data: historicalData, isLoading } = useQuery({
    queryKey: ['historical-data', ticker, selectedPeriod],
    queryFn: async () => {
      try {
        const { supabase } = await import('@/lib/supabase')
        
        // Fetch financial statements (for revenue, income, cash flow data)
        const { data: statements, error: statementsError } = await supabase
          .from('financial_statements')
          .select('*')
          .eq('ticker', ticker.toUpperCase())
          .eq('period', 'quarterly')
          .order('report_date', { ascending: true })

        // Fetch financial metrics (for ratios and analysis)
        const { fetchFinancialMetrics } = await import('@/lib/queries')
        const metrics = await fetchFinancialMetrics(ticker, 'quarterly')

        if ((!statements || statements.length === 0) && metrics.length === 0) {
          console.warn(`No financial data found for ${ticker} in database. Click "Refresh Data" to fetch comprehensive data.`)
          return generateMockHistoricalData()
        }

        console.log(`✅ Using ${statements?.length || 0} financial statements and ${metrics.length} metrics for ${ticker}`)

        return {
          statements: statements || [],
          metrics: metrics.sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime()),
          _isRealData: true // Flag to indicate real data
        }
      } catch (error) {
        console.error('Error fetching comprehensive financial data from database:', error)
        return { ...generateMockHistoricalData(), _isRealData: false }
      }
    },
    enabled: !!ticker,
  })

  const chartTypes = [
    { key: 'revenue', title: 'Revenue Trend', dataKey: 'revenue', format: 'currency' },
    { key: 'margins', title: 'Profit Margins', dataKey: 'margins', format: 'percentage' },
    { key: 'growth', title: 'Growth Rates', dataKey: 'growth', format: 'percentage' },
    { key: 'valuation', title: 'Valuation Metrics', dataKey: 'valuation', format: 'ratio' },
    { key: 'price', title: 'Stock Price', dataKey: 'price', format: 'currency' }
  ]

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historical Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  const chartData = prepareChartData(historicalData, activeChart)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle>Historical Trends</CardTitle>
            <Badge 
              variant={historicalData?._isRealData ? "default" : "secondary"} 
              className="text-xs"
            >
              {historicalData?._isRealData ? "Real time series" : "Mock data"}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant={selectedPeriod === 'quarterly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod('quarterly')}
            >
              Quarterly
            </Button>
            <Button
              variant={selectedPeriod === 'annual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod('annual')}
            >
              Annual
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeChart} onValueChange={setActiveChart}>
          <TabsList className="grid grid-cols-5 w-full mb-6">
            {chartTypes.map((chart) => (
              <TabsTrigger key={chart.key} value={chart.key} className="text-xs">
                {chart.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {chartTypes.map((chart) => (
            <TabsContent key={chart.key} value={chart.key}>
              <div className="h-80">
                                <ClientOnly fallback={<Skeleton className="h-full w-full" />}>
                  <ResponsiveContainer width="100%" height="100%">
                    {renderChart(chart.key, chartData)}
                  </ResponsiveContainer>
                </ClientOnly>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}

function formatValue(value: number, format: string): string {
  switch (format) {
    case 'currency':
      if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
      if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
      return `$${value.toFixed(2)}`
    case 'percentage':
      return `${(value * 100).toFixed(1)}%`
    case 'ratio':
      return value.toFixed(1)
    default:
      return value.toString()
  }
}

function prepareChartData(data: any, chartType: string) {
  if (!data) return []

  switch (chartType) {
    case 'revenue':
      // Use actual revenue data from financial statements
      if (!data.statements || data.statements.length === 0) return []
      return data.statements?.map((stmt: any) => ({
        period: formatPeriod(stmt.report_date),
        value: stmt.revenue || 0,
        date: stmt.report_date
      })).filter((item: any) => item.value > 0) || []
    
    case 'margins':
      return data.metrics?.map((metric: any) => ({
        period: formatPeriod(metric.report_date),
        grossMargin: (metric.gross_margin || 0) * 100, // Convert to percentage
        operatingMargin: (metric.operating_margin || 0) * 100,
        netMargin: (metric.net_margin || 0) * 100,
        date: metric.report_date
      })).filter((item: any) => item.grossMargin !== 0 || item.operatingMargin !== 0 || item.netMargin !== 0) || []
    
    case 'growth':
      return data.metrics?.map((metric: any) => ({
        period: formatPeriod(metric.report_date),
        revenueGrowth: (metric.revenue_growth || 0) * 100, // Convert to percentage
        earningsGrowth: (metric.earnings_growth || 0) * 100,
        fcfGrowth: (metric.free_cash_flow_growth || 0) * 100,
        date: metric.report_date
      })).filter((item: any) => 
        item.revenueGrowth !== 0 || item.earningsGrowth !== 0 || item.fcfGrowth !== 0
      ) || []
    
    case 'valuation':
      return data.metrics?.map((metric: any) => ({
        period: formatPeriod(metric.report_date),
        peRatio: metric.price_to_earnings_ratio || 0,
        pbRatio: metric.price_to_book_ratio || 0,
        psRatio: metric.price_to_sales_ratio || 0,
        date: metric.report_date
      })).filter((item: any) => item.peRatio > 0 || item.pbRatio > 0 || item.psRatio > 0) || []
    
    case 'price':
      // Use market cap as proxy for stock price movement
      return data.metrics?.map((metric: any) => ({
        period: formatPeriod(metric.report_date),
        value: metric.market_cap || 0,
        date: metric.report_date
      })).filter((item: any) => item.value > 0) || []
    
    default:
      return []
  }
}

function formatPeriod(dateString: string): string {
  if (!dateString) return 'Unknown'
  
  try {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const quarter = Math.floor(date.getMonth() / 3) + 1
    return `Q${quarter} ${year}`
  } catch {
    return dateString
  }
}

function renderChart(chartType: string, data: any[]) {
  if (data.length === 0) {
    if (chartType === 'revenue') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-8">
          <div className="text-lg font-medium mb-2">Revenue Data Not Available</div>
          <div className="text-sm max-w-md">
            The Financial Metrics API doesn't include actual revenue data. 
            Revenue requires the Income Statements API endpoint which needs to be implemented.
          </div>
          <div className="text-xs mt-4 text-blue-400">
            Note: HOOD's actual revenue is ~$2.95B annually (2024)
          </div>
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No data available. Click "Refresh Data" to fetch historical metrics.
      </div>
    )
  }

  switch (chartType) {
    case 'margins':
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis tickFormatter={(value) => `${value}%`} />
          <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '']} />
          <Line type="monotone" dataKey="grossMargin" stroke="#10b981" strokeWidth={2} name="Gross Margin" />
          <Line type="monotone" dataKey="operatingMargin" stroke="#3b82f6" strokeWidth={2} name="Operating Margin" />
          <Line type="monotone" dataKey="netMargin" stroke="#f59e0b" strokeWidth={2} name="Net Margin" />
        </LineChart>
      )
    
    case 'growth':
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis tickFormatter={(value) => `${value}%`} />
          <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '']} />
          <Line type="monotone" dataKey="revenueGrowth" stroke="#10b981" strokeWidth={2} name="Revenue Growth" />
          <Line type="monotone" dataKey="earningsGrowth" stroke="#3b82f6" strokeWidth={2} name="Earnings Growth" />
          <Line type="monotone" dataKey="fcfGrowth" stroke="#f59e0b" strokeWidth={2} name="FCF Growth" />
        </LineChart>
      )
    
    case 'valuation':
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip formatter={(value: number) => [value.toFixed(1), '']} />
          <Line type="monotone" dataKey="peRatio" stroke="#10b981" strokeWidth={2} name="P/E Ratio" />
          <Line type="monotone" dataKey="pbRatio" stroke="#3b82f6" strokeWidth={2} name="P/B Ratio" />
          <Line type="monotone" dataKey="psRatio" stroke="#f59e0b" strokeWidth={2} name="P/S Ratio" />
        </LineChart>
      )
    
    case 'revenue':
    case 'price':
    default:
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis tickFormatter={(value) => formatValue(value, 'currency')} />
          <Tooltip formatter={(value: number) => [formatValue(value, 'currency'), '']} />
          <Bar dataKey="value" fill="#3b82f6" />
        </BarChart>
      )
  }
}

function generateMockHistoricalData() {
  const baseDate = new Date('2024-01-01')
  return {
    metrics: Array.from({ length: 8 }, (_, i) => ({
      gross_margin: 0.45 + (i * 0.01),
      revenue_growth: 0.08 + (i * 0.005),
      price_to_earnings_ratio: 25 + (i * 2)
    })),
    incomeStatements: Array.from({ length: 8 }, (_, i) => ({
      fiscal_year: 2022 + Math.floor(i / 4),
      fiscal_period: `Q${(i % 4) + 1}`,
      revenue: 50000000000 + (i * 1000000000)
    })),
    prices: Array.from({ length: 52 }, (_, i) => ({
      date: new Date(baseDate.getTime() + i * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      close: 150 + (i * 0.5)
    }))
  }
}
