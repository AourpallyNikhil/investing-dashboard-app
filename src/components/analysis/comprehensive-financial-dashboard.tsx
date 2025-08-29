'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area, ComposedChart, Legend } from 'recharts'
import { ClientOnly } from '@/components/client-only'
import { DollarSign, TrendingUp, BarChart3, PieChart, Zap, Activity, Shield } from 'lucide-react'

interface ComprehensiveFinancialDashboardProps {
  ticker: string
}

export function ComprehensiveFinancialDashboard({ ticker }: ComprehensiveFinancialDashboardProps) {
  const [activeCategory, setActiveCategory] = useState('revenue-profitability')

  // Fetch comprehensive financial data
  const { data: financialData, isLoading } = useQuery({
    queryKey: ['comprehensive-financial-data', ticker],
    queryFn: async () => {
      try {
        const { supabase } = await import('@/lib/supabase')
        
        // Fetch financial statements (for revenue, income, cash flow data)
        const { data: statements } = await supabase
          .from('financial_statements')
          .select('*')
          .eq('ticker', ticker.toUpperCase())
          .eq('period', 'quarterly')
          .order('report_date', { ascending: true })

        // Fetch financial metrics (for ratios and analysis)
        const { fetchFinancialMetrics } = await import('@/lib/queries')
        const metrics = await fetchFinancialMetrics(ticker, 'quarterly')

        if ((!statements || statements.length === 0) && metrics.length === 0) {
          console.warn(`No comprehensive financial data found for ${ticker}`)
          return { statements: [], metrics: [], _isRealData: false }
        }

        console.log(`✅ Using ${statements?.length || 0} financial statements and ${metrics.length} metrics for ${ticker}`)

        return {
          statements: statements || [],
          metrics: metrics.sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime()),
          _isRealData: true
        }
      } catch (error) {
        console.error('Error fetching comprehensive financial data:', error)
        return { statements: [], metrics: [], _isRealData: false }
      }
    },
    enabled: !!ticker,
  })

  // Chart categories with comprehensive metrics
  const chartCategories = [
    {
      key: 'revenue-profitability',
      title: 'Revenue & Profitability',
      description: 'Core business performance and profit generation',
      icon: DollarSign
    },
    {
      key: 'cash-flow',
      title: 'Cash Flow Analysis', 
      description: 'Cash generation and usage patterns',
      icon: Activity
    },
    {
      key: 'balance-sheet',
      title: 'Balance Sheet Strength',
      description: 'Financial position and capital structure',
      icon: BarChart3
    },
    {
      key: 'valuation',
      title: 'Valuation Metrics',
      description: 'Market valuation and pricing ratios',
      icon: PieChart
    },
    {
      key: 'efficiency-returns',
      title: 'Efficiency & Returns',
      description: 'Operational efficiency and return metrics',
      icon: Zap
    },
    {
      key: 'growth',
      title: 'Growth Analysis',
      description: 'Growth rates across key metrics',
      icon: TrendingUp
    },
    {
      key: 'financial-health',
      title: 'Financial Health',
      description: 'Liquidity, leverage, and financial stability',
      icon: Shield
    }
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Comprehensive Financial Analysis</h2>
          <p className="text-muted-foreground">Interactive charts for all financial metrics and trends</p>
        </div>
        <Badge 
          variant={financialData?._isRealData ? "default" : "secondary"} 
          className="text-xs"
        >
          {financialData?._isRealData ? "Real financial data" : "No data available"}
        </Badge>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid grid-cols-4 lg:grid-cols-7 w-full">
          {chartCategories.map((category) => {
            const IconComponent = category.icon
            return (
              <TabsTrigger key={category.key} value={category.key} className="text-xs">
                <IconComponent className="hidden sm:inline mr-1 h-4 w-4" />
                {category.title}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {chartCategories.map((category) => (
          <TabsContent key={category.key} value={category.key} className="mt-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <category.icon className="h-5 w-5" />
                {category.title}
              </h3>
              <p className="text-sm text-muted-foreground">{category.description}</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {renderCategoryCharts(category.key, financialData)}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function renderCategoryCharts(categoryKey: string, data: any) {
  if (!data || (!data.statements?.length && !data.metrics?.length)) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <div className="text-lg font-medium mb-2">No Data Available</div>
            <div className="text-sm">Click "Refresh Data" to fetch comprehensive financial data</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  switch (categoryKey) {
    case 'revenue-profitability':
      return renderRevenueProfitabilityCharts(data)
    case 'cash-flow':
      return renderCashFlowCharts(data)
    case 'balance-sheet':
      return renderBalanceSheetCharts(data)
    case 'valuation':
      return renderValuationCharts(data)
    case 'efficiency-returns':
      return renderEfficiencyReturnsCharts(data)
    case 'growth':
      return renderGrowthCharts(data)
    case 'financial-health':
      return renderFinancialHealthCharts(data)
    default:
      return null
  }
}

function renderRevenueProfitabilityCharts(data: any) {
  const revenueData = data.statements?.map((stmt: any) => ({
    period: formatPeriod(stmt.report_date),
    revenue: stmt.revenue || 0,
    grossProfit: stmt.gross_profit || 0,
    operatingIncome: stmt.operating_income || 0,
    netIncome: stmt.net_income || 0,
  })).filter((item: any) => item.revenue > 0) || []

  const marginData = data.metrics?.map((metric: any) => ({
    period: formatPeriod(metric.report_date),
    grossMargin: (metric.gross_margin || 0) * 100,
    operatingMargin: (metric.operating_margin || 0) * 100,
    netMargin: (metric.net_margin || 0) * 100,
  })) || []

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `$${(value / 1e9).toFixed(1)}B`} />
                <Tooltip formatter={(value: number) => [`$${(value / 1e6).toFixed(0)}M`, '']} />
                <Bar dataKey="revenue" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profit Margins</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={marginData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip 
                  formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                <Line type="monotone" dataKey="grossMargin" stroke="#10b981" strokeWidth={2} name="Gross Margin" />
                <Line type="monotone" dataKey="operatingMargin" stroke="#3b82f6" strokeWidth={2} name="Operating Margin" />
                <Line type="monotone" dataKey="netMargin" stroke="#f59e0b" strokeWidth={2} name="Net Margin" />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Income Statement Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `$${(value / 1e6).toFixed(0)}M`} />
                <Tooltip 
                  formatter={(value: number, name: string) => [`$${(value / 1e6).toFixed(0)}M`, name]}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#e5e7eb" name="Revenue" />
                <Bar dataKey="grossProfit" fill="#10b981" name="Gross Profit" />
                <Bar dataKey="operatingIncome" fill="#3b82f6" name="Operating Income" />
                <Line type="monotone" dataKey="netIncome" stroke="#f59e0b" strokeWidth={3} name="Net Income" />
              </ComposedChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>
    </>
  )
}

function renderCashFlowCharts(data: any) {
  const cashFlowData = data.statements?.map((stmt: any) => ({
    period: formatPeriod(stmt.report_date),
    operatingCashFlow: stmt.net_cash_flow_from_operations || 0,
    investingCashFlow: stmt.net_cash_flow_from_investing || 0,
    financingCashFlow: stmt.net_cash_flow_from_financing || 0,
    freeCashFlow: stmt.free_cash_flow || 0,
    cashPosition: stmt.cash_and_equivalents || 0,
    revenue: stmt.revenue || 0, // Add revenue for validation
  })) || []

  // Check for unrealistic cash flow data (OCF > 2x revenue is suspicious)
  const hasUnrealisticData = cashFlowData.some((item: any) => 
    item.operatingCashFlow > 0 && item.revenue > 0 && 
    (item.operatingCashFlow / item.revenue) > 2
  )

  return (
    <>
      {hasUnrealisticData && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <Shield className="h-4 w-4" />
              <div className="text-sm">
                <strong>Data Quality Warning:</strong> Some cash flow values appear unrealistic (operating cash flow exceeding revenue by 2x+). 
                This may indicate API data quality issues. Please verify with official company filings.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cash Flow Components</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `$${(value / 1e6).toFixed(0)}M`} />
                <Tooltip 
                  formatter={(value: number, name: string) => [`$${(value / 1e6).toFixed(0)}M`, name]}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                <Bar dataKey="operatingCashFlow" fill="#10b981" name="Operating Cash Flow" />
                <Bar dataKey="investingCashFlow" fill="#f59e0b" name="Investing Cash Flow" />
                <Bar dataKey="financingCashFlow" fill="#ef4444" name="Financing Cash Flow" />
              </BarChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Free Cash Flow Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `$${(value / 1e6).toFixed(0)}M`} />
                <Tooltip 
                  formatter={(value: number, name: string) => [`$${(value / 1e6).toFixed(0)}M`, name]}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                <Line type="monotone" dataKey="freeCashFlow" stroke="#3b82f6" strokeWidth={3} name="Free Cash Flow" />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cash Position</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `$${(value / 1e9).toFixed(1)}B`} />
                <Tooltip formatter={(value: number) => [`$${(value / 1e6).toFixed(0)}M`, '']} />
                <Area type="monotone" dataKey="cashPosition" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>
    </>
  )
}

function renderBalanceSheetCharts(data: any) {
  const balanceData = data.statements?.map((stmt: any) => ({
    period: formatPeriod(stmt.report_date),
    totalAssets: stmt.total_assets || 0,
    totalLiabilities: stmt.total_liabilities || 0,
    shareholdersEquity: stmt.shareholders_equity || 0,
    totalDebt: stmt.total_debt || 0,
    currentAssets: stmt.current_assets || 0,
    currentLiabilities: stmt.current_liabilities || 0,
  })) || []

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assets vs Liabilities</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={balanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `$${(value / 1e9).toFixed(1)}B`} />
                <Tooltip formatter={(value: number) => [`$${(value / 1e6).toFixed(0)}M`, '']} />
                <Bar dataKey="totalAssets" fill="#10b981" name="Total Assets" />
                <Bar dataKey="totalLiabilities" fill="#ef4444" name="Total Liabilities" />
              </BarChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Debt & Equity Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={balanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `$${(value / 1e9).toFixed(1)}B`} />
                <Tooltip formatter={(value: number) => [`$${(value / 1e6).toFixed(0)}M`, '']} />
                <Area type="monotone" dataKey="shareholdersEquity" stackId="1" stroke="#10b981" fill="#10b981" />
                <Area type="monotone" dataKey="totalDebt" stackId="1" stroke="#ef4444" fill="#ef4444" />
              </AreaChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Working Capital</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={balanceData.map(item => ({
                ...item,
                workingCapital: item.currentAssets - item.currentLiabilities
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `$${(value / 1e6).toFixed(0)}M`} />
                <Tooltip formatter={(value: number) => [`$${(value / 1e6).toFixed(0)}M`, '']} />
                <Line type="monotone" dataKey="workingCapital" stroke="#3b82f6" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>
    </>
  )
}

function renderValuationCharts(data: any) {
  const valuationData = data.metrics?.map((metric: any) => ({
    period: formatPeriod(metric.report_date),
    peRatio: metric.price_to_earnings_ratio || 0,
    pbRatio: metric.price_to_book_ratio || 0,
    psRatio: metric.price_to_sales_ratio || 0,
    evEbitda: metric.enterprise_value_to_ebitda_ratio || 0,
    evRevenue: metric.enterprise_value_to_revenue_ratio || 0,
    marketCap: metric.market_cap || 0,
    enterpriseValue: metric.enterprise_value || 0,
  })) || []

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">P/E, P/B, P/S Ratios</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={valuationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => [value.toFixed(1), name]}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                <Line type="monotone" dataKey="peRatio" stroke="#10b981" strokeWidth={2} name="Price-to-Earnings Ratio" />
                <Line type="monotone" dataKey="pbRatio" stroke="#3b82f6" strokeWidth={2} name="Price-to-Book Ratio" />
                <Line type="monotone" dataKey="psRatio" stroke="#f59e0b" strokeWidth={2} name="Price-to-Sales Ratio" />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enterprise Value Ratios</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={valuationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => [value.toFixed(1), name]}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                <Line type="monotone" dataKey="evEbitda" stroke="#10b981" strokeWidth={2} name="EV/EBITDA Ratio" />
                <Line type="monotone" dataKey="evRevenue" stroke="#3b82f6" strokeWidth={2} name="EV/Revenue Ratio" />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Market Cap Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={valuationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `$${(value / 1e9).toFixed(1)}B`} />
                <Tooltip formatter={(value: number) => [`$${(value / 1e9).toFixed(1)}B`, '']} />
                <Area type="monotone" dataKey="marketCap" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>
    </>
  )
}

function renderEfficiencyReturnsCharts(data: any) {
  const returnsData = data.metrics?.map((metric: any) => ({
    period: formatPeriod(metric.report_date),
    roe: (metric.return_on_equity || 0) * 100,
    roa: (metric.return_on_assets || 0) * 100,
    roic: (metric.return_on_invested_capital || 0) * 100,
    assetTurnover: metric.asset_turnover || 0,
    inventoryTurnover: metric.inventory_turnover || 0,
    receivablesTurnover: metric.receivables_turnover || 0,
  })) || []

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ROE, ROA, ROIC</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={returnsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip 
                  formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                <Line type="monotone" dataKey="roe" stroke="#10b981" strokeWidth={2} name="Return on Equity (ROE)" />
                <Line type="monotone" dataKey="roa" stroke="#3b82f6" strokeWidth={2} name="Return on Assets (ROA)" />
                <Line type="monotone" dataKey="roic" stroke="#f59e0b" strokeWidth={2} name="Return on Invested Capital (ROIC)" />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asset Turnover Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={returnsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value: number) => [value.toFixed(1), '']} />
                <Line type="monotone" dataKey="assetTurnover" stroke="#10b981" strokeWidth={2} name="Asset Turnover" />
                <Line type="monotone" dataKey="inventoryTurnover" stroke="#3b82f6" strokeWidth={2} name="Inventory Turnover" />
                <Line type="monotone" dataKey="receivablesTurnover" stroke="#f59e0b" strokeWidth={2} name="Receivables Turnover" />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operational Efficiency</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={returnsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value: number) => [value.toFixed(1), '']} />
                <Bar dataKey="assetTurnover" fill="#3b82f6" name="Asset Turnover" />
              </BarChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>
    </>
  )
}

function renderGrowthCharts(data: any) {
  const growthData = data.metrics?.map((metric: any) => ({
    period: formatPeriod(metric.report_date),
    revenueGrowth: (metric.revenue_growth || 0) * 100,
    earningsGrowth: (metric.earnings_growth || 0) * 100,
    fcfGrowth: (metric.free_cash_flow_growth || 0) * 100,
    ebitdaGrowth: (metric.ebitda_growth || 0) * 100,
    epsGrowth: (metric.earnings_per_share_growth || 0) * 100,
  })) || []

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue & Earnings Growth</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '']} />
                <Line type="monotone" dataKey="revenueGrowth" stroke="#10b981" strokeWidth={2} name="Revenue Growth" />
                <Line type="monotone" dataKey="earningsGrowth" stroke="#3b82f6" strokeWidth={2} name="Earnings Growth" />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Growth Rate Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '']} />
                <Bar dataKey="revenueGrowth" fill="#10b981" name="Revenue" />
                <Bar dataKey="earningsGrowth" fill="#3b82f6" name="Earnings" />
                <Bar dataKey="fcfGrowth" fill="#f59e0b" name="FCF" />
              </BarChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Growth Sustainability</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '']} />
                <Line type="monotone" dataKey="fcfGrowth" stroke="#10b981" strokeWidth={2} name="FCF Growth" />
                <Line type="monotone" dataKey="ebitdaGrowth" stroke="#3b82f6" strokeWidth={2} name="EBITDA Growth" />
                <Line type="monotone" dataKey="epsGrowth" stroke="#f59e0b" strokeWidth={2} name="EPS Growth" />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>
    </>
  )
}

function renderFinancialHealthCharts(data: any) {
  const healthData = data.metrics?.map((metric: any) => ({
    period: formatPeriod(metric.report_date),
    currentRatio: metric.current_ratio || 0,
    quickRatio: metric.quick_ratio || 0,
    cashRatio: metric.cash_ratio || 0,
    debtToEquity: metric.debt_to_equity || 0,
    debtToAssets: metric.debt_to_assets || 0,
    interestCoverage: metric.interest_coverage || 0,
  })) || []

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liquidity Ratios</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={healthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value: number) => [value.toFixed(2), '']} />
                <Line type="monotone" dataKey="currentRatio" stroke="#10b981" strokeWidth={2} name="Current Ratio" />
                <Line type="monotone" dataKey="quickRatio" stroke="#3b82f6" strokeWidth={2} name="Quick Ratio" />
                <Line type="monotone" dataKey="cashRatio" stroke="#f59e0b" strokeWidth={2} name="Cash Ratio" />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leverage & Debt Ratios</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={healthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value: number) => [value.toFixed(2), '']} />
                <Line type="monotone" dataKey="debtToEquity" stroke="#ef4444" strokeWidth={2} name="Debt/Equity" />
                <Line type="monotone" dataKey="debtToAssets" stroke="#f59e0b" strokeWidth={2} name="Debt/Assets" />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Financial Strength Score</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={healthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value: number) => [value.toFixed(1), '']} />
                <Area type="monotone" dataKey="interestCoverage" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="Interest Coverage" />
              </AreaChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>
    </>
  )
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
