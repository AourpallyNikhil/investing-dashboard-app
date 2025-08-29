'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigation } from '@/components/navigation'
import { CompanyHeader } from '@/components/ui/company-header'
import { MetricChart } from '@/components/ui/metric-chart'
import { TimeRangeSelector } from '@/components/ui/time-range-selector'
import { KpiCard } from '@/components/ui/kpi-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { 
  fetchCompany, 
  fetchPriceData, 
  fetchFundamentalsData,
  fetchKpiValues,
  queryKeys,
  timeRanges 
} from '@/lib/queries'
import { 
  TrendingUp, 
  DollarSign, 
  BarChart3, 
  PieChart,
  Zap
} from 'lucide-react'

interface CompanyPageProps {
  params: {
    ticker: string
  }
}

export default function CompanyPage({ params }: CompanyPageProps) {
  const { ticker } = params
  const [selectedTimeRange, setSelectedTimeRange] = useState('1Y')

  const { data: company } = useQuery({
    queryKey: queryKeys.company(ticker),
    queryFn: () => fetchCompany(ticker),
  })

  const { data: priceData = [] } = useQuery({
    queryKey: queryKeys.prices(ticker, selectedTimeRange),
    queryFn: () => {
      const range = timeRanges.find(r => r.value === selectedTimeRange)
      return fetchPriceData(ticker, range?.days || 365)
    },
    enabled: !!company,
  })

  const { data: fundamentalsData = [] } = useQuery({
    queryKey: queryKeys.fundamentals(ticker),
    queryFn: () => fetchFundamentalsData(ticker),
    enabled: !!company,
  })

  const { data: peData = [] } = useQuery({
    queryKey: queryKeys.kpiValues(ticker, 'pe_ttm'),
    queryFn: () => fetchKpiValues(ticker, 'pe_ttm'),
    enabled: !!company,
  })

  if (!company) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Company Not Found</h1>
            <p className="text-muted-foreground">
              The ticker "{ticker}" was not found in our database.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const latestPrice = priceData[priceData.length - 1]
  const previousPrice = priceData[priceData.length - 2]
  const priceChange = latestPrice && previousPrice 
    ? (Number(latestPrice.close) || 0) - (Number(previousPrice.close) || 0)
    : null
  const priceChangePercent = latestPrice && previousPrice && previousPrice.close
    ? ((priceChange || 0) / Number(previousPrice.close)) * 100
    : null

  // Combine price and P/E data for composed chart
  const priceAndPeData = priceData.map(pricePoint => {
    const pePoint = peData.find(pe => pe.date === pricePoint.date)
    return {
      ...pricePoint,
      pe_ttm: pePoint?.value || null,
    }
  })

  // Calculate latest metrics from fundamentals
  const latestFundamentals = fundamentalsData[fundamentalsData.length - 1]
  const previousFundamentals = fundamentalsData[fundamentalsData.length - 2]

  const revenueGrowth = latestFundamentals && previousFundamentals && previousFundamentals.revenue
    ? ((Number(latestFundamentals.revenue) || 0) - (Number(previousFundamentals.revenue) || 0)) / Number(previousFundamentals.revenue)
    : null

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <CompanyHeader
          company={company}
          currentPrice={latestPrice?.close ? Number(latestPrice.close) : null}
          priceChange={priceChange}
          priceChangePercent={priceChangePercent}
        />

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KpiCard
            title="P/E Ratio (TTM)"
            value={peData[peData.length - 1]?.value ? Number(peData[peData.length - 1].value) : 'N/A'}
            unit="ratio"
            trend="neutral"
          />
          <KpiCard
            title="Revenue (TTM)"
            value={latestFundamentals?.revenue ? Number(latestFundamentals.revenue) : 'N/A'}
            unit="USD"
            change={revenueGrowth ? revenueGrowth * 100 : undefined}
            changeLabel="vs prev quarter"
            trend={revenueGrowth ? (revenueGrowth > 0 ? 'up' : 'down') : 'neutral'}
          />
          <KpiCard
            title="Gross Margin"
            value={latestFundamentals?.gross_margin ? Number(latestFundamentals.gross_margin) : 'N/A'}
            unit="%"
            trend="neutral"
          />
          <KpiCard
            title="Operating Margin"
            value={latestFundamentals?.operating_margin ? Number(latestFundamentals.operating_margin) : 'N/A'}
            unit="%"
            trend="neutral"
          />
        </div>

        <Tabs defaultValue="price-pe" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="price-pe">Price & P/E</TabsTrigger>
            <TabsTrigger value="revenue-eps">Revenue & EPS</TabsTrigger>
            <TabsTrigger value="margins">Margins</TabsTrigger>
            <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
          </TabsList>

          <TabsContent value="price-pe" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Stock Price vs P/E Ratio</span>
                </CardTitle>
                <TimeRangeSelector
                  ranges={timeRanges}
                  selected={selectedTimeRange}
                  onSelect={setSelectedTimeRange}
                />
              </CardHeader>
              <CardContent>
                <MetricChart
                  data={priceAndPeData}
                  type="composed"
                  height={400}
                  lines={[
                    { key: 'close', name: 'Stock Price', color: '#3b82f6', yAxisId: 'left' },
                    { key: 'pe_ttm', name: 'P/E TTM', color: '#ef4444', yAxisId: 'right' },
                  ]}
                  yAxes={[
                    { id: 'left', orientation: 'left' },
                    { id: 'right', orientation: 'right' },
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenue-eps" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5" />
                    <span>Quarterly Revenue</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MetricChart
                    data={fundamentalsData}
                    type="area"
                    height={300}
                    lines={[
                      { key: 'revenue', name: 'Revenue ($M)', color: '#10b981' },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5" />
                    <span>Earnings Per Share</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MetricChart
                    data={fundamentalsData}
                    type="line"
                    height={300}
                    lines={[
                      { key: 'eps_diluted', name: 'EPS Diluted', color: '#8b5cf6' },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="margins" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <PieChart className="h-5 w-5" />
                  <span>Profit Margins</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetricChart
                  data={fundamentalsData}
                  type="line"
                  height={400}
                  lines={[
                    { key: 'gross_margin', name: 'Gross Margin', color: '#10b981' },
                    { key: 'operating_margin', name: 'Operating Margin', color: '#3b82f6' },
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cash-flow" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Cash Flow Analysis</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Cash flow data will be available when connected to FinancialDatasets.ai</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
