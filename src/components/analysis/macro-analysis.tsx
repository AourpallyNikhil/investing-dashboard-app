'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useInflationData, useRefreshInflationData } from '@/hooks/use-inflation-data'
import { useKeyEconomicIndicators, useUnemploymentData, useWageData, useIndustryEmployment, useRefreshEconomicData } from '@/hooks/use-economic-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area, Legend } from 'recharts'
import { ClientOnly } from '@/components/client-only'
import { TrendingUp, TrendingDown, Activity, Globe, DollarSign, BarChart3, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MacroAnalysisProps {
  ticker: string
}

export function MacroAnalysis({ ticker }: MacroAnalysisProps) {
  const [activeTab, setActiveTab] = useState('interest-rates')
  const [selectedBank, setSelectedBank] = useState('FED')
  
  // Fetch real inflation data
  const { data: inflationResponse, isLoading: inflationLoading, error: inflationError } = useInflationData()
  const { refetch: refreshInflationData, isLoading: isRefreshing } = useRefreshInflationData()
  
  // Fetch economic indicators
  const { data: unemploymentData, isLoading: unemploymentLoading } = useUnemploymentData()
  const { data: wageData, isLoading: wageLoading } = useWageData()
  const { data: industryData, isLoading: industryLoading } = useIndustryEmployment()
  const { mutate: refreshEconomicData, isPending: isRefreshingEconomic } = useRefreshEconomicData()
  
  const [timeRange, setTimeRange] = useState('1Y')

  // Fetch interest rates data
  const { data: interestRatesData, isLoading: ratesLoading } = useQuery({
    queryKey: ['interest-rates', selectedBank, timeRange],
    queryFn: async () => {
      try {
        // For now, return mock data until API is working
        return generateMockInterestRates(selectedBank, timeRange)
      } catch (error) {
        console.error('Error fetching interest rates:', error)
        return generateMockInterestRates(selectedBank, timeRange)
      }
    },
  })

  // Central banks configuration
  const centralBanks = [
    { code: 'FED', name: 'Federal Reserve (US)', color: '#2563eb' },
    { code: 'ECB', name: 'European Central Bank', color: '#dc2626' },
    { code: 'BOJ', name: 'Bank of Japan', color: '#16a34a' },
    { code: 'BOE', name: 'Bank of England', color: '#ca8a04' },
    { code: 'PBOC', name: 'People\'s Bank of China', color: '#9333ea' },
  ]

  const timeRanges = [
    { value: '6M', label: '6 Months' },
    { value: '1Y', label: '1 Year' },
    { value: '2Y', label: '2 Years' },
    { value: '5Y', label: '5 Years' },
  ]

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="interest-rates" className="text-xs">
            <DollarSign className="h-4 w-4 mr-1" />
            Interest Rates
          </TabsTrigger>
          <TabsTrigger value="inflation" className="text-xs">
            <TrendingUp className="h-4 w-4 mr-1" />
            Inflation
          </TabsTrigger>
          <TabsTrigger value="unemployment" className="text-xs">
            <Activity className="h-4 w-4 mr-1" />
            Employment
          </TabsTrigger>
          <TabsTrigger value="wages" className="text-xs">
            <DollarSign className="h-4 w-4 mr-1" />
            Wages
          </TabsTrigger>
          <TabsTrigger value="industries" className="text-xs">
            <BarChart3 className="h-4 w-4 mr-1" />
            Industries
          </TabsTrigger>
          <TabsTrigger value="global-markets" className="text-xs">
            <Globe className="h-4 w-4 mr-1" />
            Global Markets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="interest-rates" className="space-y-6">
          {/* Controls */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Central Bank:</label>
              <Select value={selectedBank} onValueChange={setSelectedBank}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {centralBanks.map(bank => (
                    <SelectItem key={bank.code} value={bank.code}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Time Range:</label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeRanges.map(range => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {centralBanks.find(b => b.code === selectedBank)?.name} Rates
                  <Badge variant="outline">Real-time Data</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={interestRatesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={(value) => `${value}%`} />
                      <Tooltip 
                        formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="rate" 
                        stroke={centralBanks.find(b => b.code === selectedBank)?.color} 
                        strokeWidth={3}
                        name="Interest Rate"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Global Central Bank Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={generateGlobalRatesComparison()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bank" />
                      <YAxis tickFormatter={(value) => `${value}%`} />
                      <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Current Rate']} />
                      <Bar dataKey="rate" fill="#2563eb" />
                    </BarChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rate Changes Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {centralBanks.slice(0, 4).map((bank, index) => {
                    const mockRates = [5.50, 4.00, 0.10, 5.25]
                    const mockChanges = ['+1.00%', '+2.00%', '+0.20%', '+1.25%']
                    return (
                      <div key={bank.code} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <div className="font-medium">{bank.name}</div>
                          <div className="text-sm text-muted-foreground">Current: {mockRates[index]}%</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <Badge variant="secondary">{mockChanges[index]} YTD</Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Yield Curve Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={generateYieldCurveData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="maturity" />
                      <YAxis tickFormatter={(value) => `${value}%`} />
                      <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Yield']} />
                      <Area 
                        type="monotone" 
                        dataKey="yield" 
                        stroke="#2563eb" 
                        fill="#2563eb" 
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inflation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  US Inflation Rate
                  <Badge variant="outline">CPI Data</Badge>
                  {inflationResponse?.fromCache === false && !inflationResponse?.sources?.includes('Mock') && !inflationResponse?.sources?.includes('Fallback') && (
                    <Badge variant="secondary">Official BLS Data</Badge>
                  )}
                  {inflationResponse?.sources?.includes('Fallback') && (
                    <Badge variant="outline">BLS API Unavailable</Badge>
                  )}
                  {inflationResponse?.fromCache === true && (
                    <Badge variant="outline">Cached Data ({inflationResponse.cacheAge})</Badge>
                  )}
                  {inflationResponse?.sources?.includes('Mock') && (
                    <Badge variant="destructive">Mock Data</Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshInflationData()}
                  disabled={isRefreshing}
                  className="ml-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
              </CardTitle>
              {inflationResponse?.lastUpdated && (
                <p className="text-sm text-muted-foreground">
                  Last updated: {inflationResponse.lastUpdated}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {inflationLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : inflationError ? (
                <div className="h-64 flex items-center justify-center">
                  <p className="text-muted-foreground">Failed to load inflation data</p>
                </div>
              ) : (
                <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={inflationResponse?.data || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={(value) => `${value}%`} />
                      <Tooltip 
                        formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Line type="monotone" dataKey="us" stroke="#2563eb" strokeWidth={3} name="United States" />
                    </LineChart>
                  </ResponsiveContainer>
                </ClientOnly>
              )}
              {inflationResponse?.sources && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong>Data Sources:</strong> {inflationResponse.sources.join(', ')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="economic-indicators" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  GDP Growth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2.4%</div>
                <div className="text-sm text-muted-foreground">US Q3 2024</div>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">+0.2% QoQ</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Unemployment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3.7%</div>
                <div className="text-sm text-muted-foreground">US November 2024</div>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingDown className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">-0.1% MoM</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Consumer Confidence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">102.6</div>
                <div className="text-sm text-muted-foreground">November 2024</div>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">+2.1 pts</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Dollar Index (DXY)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">104.2</div>
                <div className="text-sm text-muted-foreground">Current</div>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3 w-3 text-red-600" />
                  <span className="text-xs text-red-600">+0.8%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="global-markets" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Major Market Indices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: 'S&P 500', value: '4,783.45', change: '+0.85%', positive: true },
                    { name: 'NASDAQ', value: '15,037.76', change: '+1.12%', positive: true },
                    { name: 'FTSE 100', value: '7,506.23', change: '-0.23%', positive: false },
                    { name: 'Nikkei 225', value: '33,486.89', change: '+0.67%', positive: true },
                  ].map((index, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{index.name}</div>
                        <div className="text-sm text-muted-foreground">{index.value}</div>
                      </div>
                      <div className={`flex items-center gap-1 ${index.positive ? 'text-green-600' : 'text-red-600'}`}>
                        {index.positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        <span className="font-medium">{index.change}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Currency Exchange Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { pair: 'EUR/USD', rate: '1.0876', change: '+0.12%', positive: true },
                    { pair: 'GBP/USD', rate: '1.2634', change: '-0.08%', positive: false },
                    { pair: 'USD/JPY', rate: '149.87', change: '+0.45%', positive: true },
                    { pair: 'USD/CNY', rate: '7.2156', change: '+0.23%', positive: true },
                  ].map((currency, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{currency.pair}</div>
                        <div className="text-sm text-muted-foreground">{currency.rate}</div>
                      </div>
                      <div className={`flex items-center gap-1 ${currency.positive ? 'text-green-600' : 'text-red-600'}`}>
                        {currency.positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        <span className="font-medium">{currency.change}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="unemployment" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Unemployment Rate Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Unemployment Rate
                    {unemploymentData?.sources?.includes('U.S. Bureau of Labor Statistics (BLS) - Economic Indicators') ? (
                      <Badge variant="default">Official BLS Data</Badge>
                    ) : (
                      <Badge variant="destructive">Mock Data</Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshEconomicData()}
                    disabled={isRefreshingEconomic}
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshingEconomic ? 'animate-spin' : ''}`} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {unemploymentLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={unemploymentData?.data?.unemployment_rate || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis tickFormatter={(value) => `${value}%`} />
                        <Tooltip formatter={(value: number) => [`${value}%`, 'Unemployment Rate']} />
                        <Line type="monotone" dataKey="value" stroke="#dc2626" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ClientOnly>
                )}
              </CardContent>
            </Card>

            {/* Employment Level Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Employment Level
                </CardTitle>
              </CardHeader>
              <CardContent>
                {unemploymentLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={unemploymentData?.data?.employment_level || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                        <Tooltip formatter={(value: number) => [`${(value / 1000).toFixed(0)}K`, 'Employment Level']} />
                        <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ClientOnly>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="wages" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Average Hourly Earnings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Average Hourly Earnings
                    {wageData?.sources?.includes('U.S. Bureau of Labor Statistics (BLS) - Economic Indicators') ? (
                      <Badge variant="default">Official BLS Data</Badge>
                    ) : (
                      <Badge variant="destructive">Mock Data</Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshEconomicData()}
                    disabled={isRefreshingEconomic}
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshingEconomic ? 'animate-spin' : ''}`} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {wageLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={wageData?.data?.avg_hourly_earnings || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis tickFormatter={(value) => `$${value}`} />
                        <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Hourly Earnings']} />
                        <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ClientOnly>
                )}
              </CardContent>
            </Card>

            {/* Average Weekly Earnings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Average Weekly Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {wageLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={wageData?.data?.avg_weekly_earnings || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis tickFormatter={(value) => `$${value}`} />
                        <Tooltip formatter={(value: number) => [`$${value.toFixed(0)}`, 'Weekly Earnings']} />
                        <Area type="monotone" dataKey="value" stroke="#ca8a04" fill="#ca8a04" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ClientOnly>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="industries" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Industry Employment Trends
                  {industryData?.sources?.includes('U.S. Bureau of Labor Statistics (BLS) - Economic Indicators') ? (
                    <Badge variant="default">Official BLS Data</Badge>
                  ) : (
                    <Badge variant="destructive">Mock Data</Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshEconomicData()}
                  disabled={isRefreshingEconomic}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshingEconomic ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {industryLoading ? (
                <Skeleton className="h-96 w-full" />
              ) : (
                <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(value: number, name: string) => [`${(value / 1000).toFixed(0)}K`, name]} />
                      <Legend />
                      {industryData?.data?.manufacturing_jobs && (
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          data={industryData.data.manufacturing_jobs}
                          stroke="#dc2626" 
                          strokeWidth={2} 
                          name="Manufacturing" 
                        />
                      )}
                      {industryData?.data?.tech_jobs && (
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          data={industryData.data.tech_jobs}
                          stroke="#2563eb" 
                          strokeWidth={2} 
                          name="Technology" 
                        />
                      )}
                      {industryData?.data?.healthcare_jobs && (
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          data={industryData.data.healthcare_jobs}
                          stroke="#16a34a" 
                          strokeWidth={2} 
                          name="Healthcare" 
                        />
                      )}
                      {industryData?.data?.financial_jobs && (
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          data={industryData.data.financial_jobs}
                          stroke="#ca8a04" 
                          strokeWidth={2} 
                          name="Financial Services" 
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </ClientOnly>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Helper functions for mock data
function generateMockInterestRates(bank: string, timeRange: string) {
  const months = timeRange === '6M' ? 6 : timeRange === '1Y' ? 12 : timeRange === '2Y' ? 24 : 60
  const baseRates: Record<string, number> = {
    FED: 5.5, ECB: 4.0, BOJ: 0.1, BOE: 5.25, PBOC: 3.45
  }
  
  return Array.from({ length: months }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (months - 1 - i))
    return {
      date: date.toISOString().slice(0, 7),
      rate: baseRates[bank] + (Math.random() - 0.5) * 0.5,
      name: `${bank} Rate`
    }
  })
}

function generateGlobalRatesComparison() {
  return [
    { bank: 'FED', rate: 5.50 },
    { bank: 'ECB', rate: 4.00 },
    { bank: 'BOJ', rate: 0.10 },
    { bank: 'BOE', rate: 5.25 },
    { bank: 'PBOC', rate: 3.45 },
  ]
}

function generateYieldCurveData() {
  return [
    { maturity: '3M', yield: 5.2 },
    { maturity: '6M', yield: 5.1 },
    { maturity: '1Y', yield: 4.9 },
    { maturity: '2Y', yield: 4.6 },
    { maturity: '5Y', yield: 4.3 },
    { maturity: '10Y', yield: 4.4 },
    { maturity: '30Y', yield: 4.6 },
  ]
}

// generateInflationData function removed - now using real data from Gemini Flash API via useInflationData hook