'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, Users, TrendingUp, TrendingDown, PieChart, BarChart3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, LineChart, Line, Legend } from 'recharts'
import { ClientOnly } from '@/components/client-only'

interface InstitutionalAnalysisProps {
  ticker: string
}

export function InstitutionalAnalysis({ ticker }: InstitutionalAnalysisProps) {
  const [activeTab, setActiveTab] = useState('overview')

  // Fetch institutional ownership data via server-side API route
  const { data: institutionalData, isLoading } = useQuery({
    queryKey: ['institutional-ownership', ticker],
    queryFn: async () => {
      try {
        console.log(`🔄 Fetching institutional ownership for ${ticker}...`)
        
        // Get last 2 years of institutional ownership data
        const endDate = new Date().toISOString().split('T')[0]
        const startDate = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        
        const params = new URLSearchParams({
          ticker,
          limit: '200',
          report_period_gte: startDate,
          report_period_lte: endDate
        })

        const response = await fetch(`/api/institutional-ownership?${params}`)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || `HTTP ${response.status}`)
        }

        const result = await response.json()
        
        if (!result.success) {
          throw new Error(result.message || 'Failed to fetch institutional ownership data')
        }

        const ownership = result.data?.ownership || []
        
        if (ownership.length === 0) {
          console.warn(`No institutional ownership data found for ${ticker}`)
          return { ownership: [], _isRealData: false }
        }

        console.log(`✅ Using real institutional ownership data for ${ticker}: ${ownership.length} records`)
        return { ownership, _isRealData: true }
      } catch (error) {
        console.error('Error fetching institutional ownership:', error)
        return { ownership: [], _isRealData: false }
      }
    },
    enabled: !!ticker,
  })

  const processedData = processInstitutionalData(institutionalData?.ownership || [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Institutional Analysis</h2>
          <p className="text-muted-foreground">Smart money tracking and institutional ownership insights</p>
        </div>
        <Badge 
          variant={institutionalData?._isRealData ? "default" : "secondary"} 
          className="text-xs"
        >
          {institutionalData?._isRealData ? "Real institutional data" : "No data available"}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="overview" className="text-xs">
            <Users className="h-4 w-4 mr-1" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="top-holders" className="text-xs">
            <Building2 className="h-4 w-4 mr-1" />
            Top Holders
          </TabsTrigger>
          <TabsTrigger value="concentration" className="text-xs">
            <PieChart className="h-4 w-4 mr-1" />
            Concentration
          </TabsTrigger>
          <TabsTrigger value="trends" className="text-xs">
            <BarChart3 className="h-4 w-4 mr-1" />
            Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {renderOverviewCharts(processedData, isLoading)}
          </div>
        </TabsContent>

        <TabsContent value="top-holders" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderTopHoldersCharts(processedData, isLoading)}
          </div>
        </TabsContent>

        <TabsContent value="concentration" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderConcentrationCharts(processedData, isLoading)}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderTrendsCharts(processedData, isLoading)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function processInstitutionalData(ownership: any[]) {
  if (!ownership || ownership.length === 0) {
    return {
      topHolders: [],
      ownershipByPeriod: [],
      concentrationData: [],
      summary: {
        totalInstitutions: 0,
        totalShares: 0,
        totalMarketValue: 0,
        averagePosition: 0
      }
    }
  }

  // Get the most recent period
  const latestPeriod = ownership.reduce((latest, record) => {
    return new Date(record.report_period) > new Date(latest) ? record.report_period : latest
  }, ownership[0]?.report_period || '')

  // Get top holders from latest period and deduplicate by investor name
  const latestHoldings = ownership
    .filter(record => record.report_period === latestPeriod)
    .sort((a, b) => (b.market_value || 0) - (a.market_value || 0))
    .reduce((unique: any[], current) => {
      // Only add if we haven't seen this investor before
      if (!unique.find(item => item.investor === current.investor)) {
        unique.push(current)
      }
      return unique
    }, [])
    .slice(0, 20)

  // Calculate ownership by period
  const ownershipByPeriod = ownership.reduce((acc: any[], record) => {
    const existing = acc.find(item => item.period === record.report_period)
    if (existing) {
      existing.totalValue += record.market_value || 0
      existing.totalShares += record.shares || 0
      existing.institutionCount += 1
    } else {
      acc.push({
        period: formatPeriod(record.report_period),
        totalValue: record.market_value || 0,
        totalShares: record.shares || 0,
        institutionCount: 1,
        date: record.report_period
      })
    }
    return acc
  }, []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Calculate concentration data
  const totalMarketValue = latestHoldings.reduce((sum, holding) => sum + (holding.market_value || 0), 0)
  const concentrationData = [
    {
      name: 'Top 5',
      value: latestHoldings.slice(0, 5).reduce((sum, holding) => sum + (holding.market_value || 0), 0),
      percentage: totalMarketValue > 0 ? (latestHoldings.slice(0, 5).reduce((sum, holding) => sum + (holding.market_value || 0), 0) / totalMarketValue * 100) : 0
    },
    {
      name: 'Top 6-10',
      value: latestHoldings.slice(5, 10).reduce((sum, holding) => sum + (holding.market_value || 0), 0),
      percentage: totalMarketValue > 0 ? (latestHoldings.slice(5, 10).reduce((sum, holding) => sum + (holding.market_value || 0), 0) / totalMarketValue * 100) : 0
    },
    {
      name: 'Top 11-20',
      value: latestHoldings.slice(10, 20).reduce((sum, holding) => sum + (holding.market_value || 0), 0),
      percentage: totalMarketValue > 0 ? (latestHoldings.slice(10, 20).reduce((sum, holding) => sum + (holding.market_value || 0), 0) / totalMarketValue * 100) : 0
    }
  ]

  const summary = {
    totalInstitutions: latestHoldings.length,
    totalShares: latestHoldings.reduce((sum, holding) => sum + (holding.shares || 0), 0),
    totalMarketValue,
    averagePosition: latestHoldings.length > 0 ? totalMarketValue / latestHoldings.length : 0
  }

  return {
    topHolders: latestHoldings,
    ownershipByPeriod,
    concentrationData,
    summary
  }
}

function renderOverviewCharts(data: any, isLoading: boolean) {
  if (isLoading) {
    return Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-80" />
    ))
  }

  if (!data.topHolders || data.topHolders.length === 0) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <div className="text-lg font-medium mb-2">No Institutional Data Available</div>
            <div className="text-sm">Click "Refresh Data" to fetch institutional ownership data</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Ownership Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Institutions</span>
              <span className="font-medium">{data.summary.totalInstitutions}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Market Value</span>
              <span className="font-medium">{formatCurrency(data.summary.totalMarketValue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Shares</span>
              <span className="font-medium">{formatShares(data.summary.totalShares)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Average Position</span>
              <span className="font-medium">{formatCurrency(data.summary.averagePosition)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 Holders by Value</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.topHolders.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="investor" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={10}
                />
                <YAxis tickFormatter={(value) => `$${(value / 1e6).toFixed(0)}M`} />
                <Tooltip 
                  formatter={(value: number, name: string) => [`$${(value / 1e6).toFixed(0)}M`, 'Market Value']}
                  labelFormatter={(label) => `Investor: ${label}`}
                />
                <Legend />
                <Bar dataKey="market_value" fill="#3b82f6" name="Market Value" />
              </BarChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ownership Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.ownershipByPeriod}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `$${(value / 1e9).toFixed(1)}B`} />
                <Tooltip 
                  formatter={(value: number, name: string) => [`$${(value / 1e9).toFixed(1)}B`, name]}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                <Line type="monotone" dataKey="totalValue" stroke="#10b981" strokeWidth={2} name="Total Market Value" />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>
    </>
  )
}

function renderTopHoldersCharts(data: any, isLoading: boolean) {
  if (isLoading) {
    return Array.from({ length: 2 }).map((_, i) => (
      <Skeleton key={i} className="h-80" />
    ))
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 15 Institutional Holders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {data.topHolders.slice(0, 15).map((holder: any, index: number) => (
              <div key={`holder-${index}-${holder.investor || 'unknown'}-${holder.report_period || 'no-date'}`} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{holder.investor}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatShares(holder.shares)} shares
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-sm">{formatCurrency(holder.market_value)}</div>
                  <div className="text-xs text-muted-foreground">
                    ${(holder.price || 0).toFixed(2)}/share
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holdings by Share Count</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topHolders.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="investor" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={10}
                />
                <YAxis tickFormatter={(value) => formatShares(value)} />
                <Tooltip 
                  formatter={(value: number, name: string) => [formatShares(value), 'Shares']}
                  labelFormatter={(label) => `Investor: ${label}`}
                />
                <Legend />
                <Bar dataKey="shares" fill="#f59e0b" name="Shares Held" />
              </BarChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>
    </>
  )
}

function renderConcentrationCharts(data: any, isLoading: boolean) {
  if (isLoading) {
    return Array.from({ length: 2 }).map((_, i) => (
      <Skeleton key={i} className="h-80" />
    ))
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b']

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ownership Concentration</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPieChart>
                <Tooltip 
                  formatter={(value: number, name: string) => [`$${(value / 1e6).toFixed(0)}M (${((value / data.summary.totalMarketValue) * 100).toFixed(1)}%)`, name]}
                />
                <Legend />
                <RechartsPieChart data={data.concentrationData}>
                  {data.concentrationData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </RechartsPieChart>
              </RechartsPieChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Concentration Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.concentrationData.map((item: any, index: number) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm">{item.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-medium">{item.percentage.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(item.value)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function renderTrendsCharts(data: any, isLoading: boolean) {
  if (isLoading) {
    return Array.from({ length: 2 }).map((_, i) => (
      <Skeleton key={i} className="h-80" />
    ))
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Institution Count Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.ownershipByPeriod}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => [value, 'Institutions']}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                <Line type="monotone" dataKey="institutionCount" stroke="#ef4444" strokeWidth={2} name="Number of Institutions" />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Total Shares Held Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.ownershipByPeriod}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => formatShares(value)} />
                <Tooltip 
                  formatter={(value: number, name: string) => [formatShares(value), 'Total Shares']}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                <Line type="monotone" dataKey="totalShares" stroke="#8b5cf6" strokeWidth={2} name="Total Shares Held" />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>
    </>
  )
}

function formatCurrency(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  return `$${value.toFixed(2)}`
}

function formatShares(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`
  return value.toString()
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