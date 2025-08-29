'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AddTickerDialog } from '@/components/ui/add-ticker-dialog'
import { useTickerManagement } from '@/hooks/use-ticker-management'
import { fetchCompanies, fetchScreenerData, queryKeys } from '@/lib/queries'
import { Search, Plus, TrendingUp, TrendingDown, Trash2 } from 'lucide-react'

export default function HomePage() {
  const [ticker, setTicker] = useState('')
  const [showManagement, setShowManagement] = useState(false)
  const router = useRouter()
  const { deleteTicker, isDeleting } = useTickerManagement()

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: queryKeys.companies,
    queryFn: fetchCompanies,
  })

  const { data: screenerData = [], isLoading: screenerLoading } = useQuery({
    queryKey: queryKeys.screener(),
    queryFn: () => fetchScreenerData(),
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (ticker.trim()) {
      router.push(`/analyze/${ticker.toUpperCase()}`)
    }
  }

  const handleTickerClick = (tickerSymbol: string) => {
    router.push(`/analyze/${tickerSymbol}`)
  }

  const handleDeleteTicker = async (tickerSymbol: string) => {
    if (window.confirm(`Are you sure you want to remove ${tickerSymbol} from your watchlist?`)) {
      await deleteTicker(tickerSymbol)
    }
  }

  const isLoading = companiesLoading || screenerLoading

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">My Watchlist</h1>
            <p className="text-muted-foreground">
              Track and analyze your followed tickers across multiple dimensions
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManagement(!showManagement)}
            >
              {showManagement ? 'Done' : 'Manage'}
            </Button>
            <AddTickerDialog />
          </div>
        </div>

        {/* Quick Add Ticker */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Quick Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-4 max-w-md">
              <Input
                type="text"
                placeholder="Enter ticker symbol (e.g., AAPL)"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={!ticker.trim()}>
                <Search className="h-4 w-4 mr-2" />
                Analyze
              </Button>
            </form>
            <p className="text-sm text-muted-foreground mt-2">
              Analyze any ticker without adding it to your watchlist
            </p>
          </CardContent>
        </Card>

        {/* Watchlist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Your Tickers ({companies.length})</span>
              <Badge variant="outline">
                {companies.length} companies tracked
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground">Loading your watchlist...</div>
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-muted-foreground mb-4">
                  Your watchlist is empty
                </div>
                <AddTickerDialog />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {companies.map((company) => {
                  const screenerRow = screenerData.find(row => row.ticker === company.ticker)
                  return (
                    <Card 
                      key={company.ticker} 
                      className="cursor-pointer hover:shadow-md transition-shadow relative"
                      onClick={() => handleTickerClick(company.ticker)}
                    >
                      {showManagement && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteTicker(company.ticker)
                          }}
                          disabled={isDeleting === company.ticker}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{company.ticker}</CardTitle>
                            <p className="text-sm text-muted-foreground truncate">
                              {company.name}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Price</span>
                            <span className="font-medium">
                              {screenerRow?.close ? `$${screenerRow.close.toFixed(2)}` : 'N/A'}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">P/E Ratio</span>
                            <span className="font-medium">
                              {screenerRow?.pe_ttm ? screenerRow.pe_ttm.toFixed(1) : 'N/A'}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Rev Growth</span>
                            <div className="flex items-center gap-1">
                              {screenerRow?.rev_yoy !== null && screenerRow?.rev_yoy !== undefined ? (
                                <>
                                  {screenerRow.rev_yoy > 0 ? (
                                    <TrendingUp className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 text-red-600" />
                                  )}
                                  <span className={`text-sm ${screenerRow.rev_yoy > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {(screenerRow.rev_yoy * 100).toFixed(1)}%
                                  </span>
                                </>
                              ) : (
                                <span className="text-sm text-muted-foreground">N/A</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex gap-1 mt-3">
                            <Badge variant="secondary" className="text-xs">
                              {company.sector}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {company.exchange}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}