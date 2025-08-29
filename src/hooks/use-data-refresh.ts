// Hook for refreshing financial data from the frontend
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queries'

interface RefreshResult {
  success: boolean
  message: string
  results: Record<string, { prices: number; fundamentals: number }>
  stats: {
    totalCompanies: number
    updatedTickers: string[]
    totalPriceRecords: number
    totalFundamentalRecords: number
  }
}

interface RefreshError {
  error: string
  details?: string
}

export function useDataRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [lastResult, setLastResult] = useState<RefreshResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const queryClient = useQueryClient()

  const refreshData = async (options?: {
    priority?: 'high' | 'medium' | 'low'
    tickers?: string[]
  }) => {
    setIsRefreshing(true)
    setError(null)

    try {
      console.log('🔄 Starting data refresh...', options)

      const response = await fetch('/api/refresh-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options || { priority: 'high' }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh data')
      }

      const result = data as RefreshResult
      setLastResult(result)
      setLastRefresh(new Date())

      // Invalidate all queries to refetch with new data
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies })
      await queryClient.invalidateQueries({ queryKey: queryKeys.screener() })
      
      // Invalidate price queries for updated tickers
      result.stats.updatedTickers.forEach(ticker => {
        queryClient.invalidateQueries({ queryKey: queryKeys.prices(ticker, '1M') })
        queryClient.invalidateQueries({ queryKey: queryKeys.prices(ticker, '3M') })
        queryClient.invalidateQueries({ queryKey: queryKeys.prices(ticker, '1Y') })
        queryClient.invalidateQueries({ queryKey: queryKeys.fundamentals(ticker) })
      })

      console.log('✅ Data refresh completed:', result.stats)
      return result

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('❌ Data refresh failed:', errorMessage)
      throw err
    } finally {
      setIsRefreshing(false)
    }
  }

  const refreshHighPriority = () => refreshData({ priority: 'high' })
  const refreshMediumPriority = () => refreshData({ priority: 'medium' })
  const refreshTickers = (tickers: string[]) => refreshData({ tickers })

  return {
    refreshData,
    refreshHighPriority,
    refreshMediumPriority, 
    refreshTickers,
    isRefreshing,
    lastRefresh,
    lastResult,
    error,
  }
}
