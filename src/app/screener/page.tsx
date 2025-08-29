'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/navigation'
import { ScreenerTable } from '@/components/ui/screener-table'
import { AddTickerDialog } from '@/components/ui/add-ticker-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fetchScreenerData, queryKeys } from '@/lib/queries'
import { Search, Filter, X, Settings, RefreshCw } from 'lucide-react'

interface ScreenerFilters extends Record<string, number | undefined> {
  peMin?: number
  peMax?: number
  revYoyMin?: number
  fcfYieldMin?: number
  grossMarginMin?: number
}

export default function ScreenerPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<ScreenerFilters>({})
  const [showFilters, setShowFilters] = useState(false)
  const [showManagement, setShowManagement] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { data: screenerData = [], isLoading } = useQuery({
    queryKey: queryKeys.screener(filters),
    queryFn: () => fetchScreenerData(filters),
  })

  const handleFilterChange = (key: keyof ScreenerFilters, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value)
    setFilters(prev => ({
      ...prev,
      [key]: numValue,
    }))
  }

  const clearFilters = () => {
    setFilters({})
  }

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined).length

  const handleRowClick = (ticker: string) => {
    router.push(`/company/${ticker}`)
  }

  const handleRefreshData = async () => {
    setIsRefreshing(true)
    try {
      console.log('🔄 Force refreshing all data...')
      
      // Clear all cached data
      await queryClient.clear()
      
      // Force refetch fresh data from database
      await queryClient.refetchQueries({ queryKey: queryKeys.companies })
      await queryClient.refetchQueries({ queryKey: queryKeys.screener() })
      
      console.log('✅ Data force refreshed successfully')
    } catch (error) {
      console.error('❌ Failed to refresh data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Stock Screener</h1>
              <p className="text-muted-foreground">
                Filter and discover stocks based on fundamental metrics
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshData}
                disabled={isRefreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Syncing...' : 'Sync Data'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManagement(!showManagement)}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                {showManagement ? 'Hide Management' : 'Manage Tickers'}
              </Button>
              <AddTickerDialog onSuccess={() => {
                // Optionally show a success message
              }} />
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Filter className="h-5 w-5" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary">{activeFilterCount}</Badge>
                )}
              </CardTitle>
              <div className="flex items-center space-x-2">
                {activeFilterCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="flex items-center space-x-1"
                  >
                    <X className="h-4 w-4" />
                    <span>Clear</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {showFilters ? 'Hide' : 'Show'} Filters
                </Button>
              </div>
            </div>
          </CardHeader>
          
          {showFilters && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="peMin">P/E Min</Label>
                  <Input
                    id="peMin"
                    type="number"
                    placeholder="e.g. 10"
                    value={filters.peMin || ''}
                    onChange={(e) => handleFilterChange('peMin', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="peMax">P/E Max</Label>
                  <Input
                    id="peMax"
                    type="number"
                    placeholder="e.g. 30"
                    value={filters.peMax || ''}
                    onChange={(e) => handleFilterChange('peMax', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="revYoyMin">Rev Growth Min (%)</Label>
                  <Input
                    id="revYoyMin"
                    type="number"
                    placeholder="e.g. 10"
                    value={filters.revYoyMin ? filters.revYoyMin * 100 : ''}
                    onChange={(e) => handleFilterChange('revYoyMin', e.target.value ? (parseFloat(e.target.value) / 100).toString() : '')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fcfYieldMin">FCF Yield Min (%)</Label>
                  <Input
                    id="fcfYieldMin"
                    type="number"
                    placeholder="e.g. 5"
                    value={filters.fcfYieldMin ? filters.fcfYieldMin * 100 : ''}
                    onChange={(e) => handleFilterChange('fcfYieldMin', e.target.value ? (parseFloat(e.target.value) / 100).toString() : '')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="grossMarginMin">Gross Margin Min (%)</Label>
                  <Input
                    id="grossMarginMin"
                    type="number"
                    placeholder="e.g. 30"
                    value={filters.grossMarginMin ? filters.grossMarginMin * 100 : ''}
                    onChange={(e) => handleFilterChange('grossMarginMin', e.target.value ? (parseFloat(e.target.value) / 100).toString() : '')}
                  />
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search className="h-5 w-5" />
              <span>Results</span>
              <Badge variant="secondary">
                {screenerData.length} companies
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(isLoading || isRefreshing) ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground">
                  {isRefreshing ? 'Syncing with database...' : 'Loading...'}
                </div>
              </div>
            ) : (
              <ScreenerTable 
                data={screenerData} 
                onRowClick={handleRowClick}
                showDeleteButton={showManagement}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
