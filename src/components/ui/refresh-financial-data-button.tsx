'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface RefreshFinancialDataButtonProps {
  tickers?: string[]
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

export function RefreshFinancialDataButton({ 
  tickers, 
  variant = 'outline', 
  size = 'sm',
  className 
}: RefreshFinancialDataButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const queryClient = useQueryClient()

  const handleRefresh = async () => {
    setIsRefreshing(true)
    
    try {
      console.log('🔄 Starting financial data refresh...')
      
      const response = await fetch('/api/refresh-financial-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tickers }),
      })

      const result = await response.json()

      if (result.success) {
        // Invalidate all relevant queries to force refresh
        await queryClient.invalidateQueries({ queryKey: ['fundamental-analysis'] })
        await queryClient.invalidateQueries({ queryKey: ['financialMetrics'] })
        await queryClient.invalidateQueries({ queryKey: ['screener'] })
        await queryClient.invalidateQueries({ queryKey: ['companies'] })

        console.log('✅ Financial data refresh completed:', result)
        
        toast.success('Financial data updated!', {
          description: result.message,
          icon: <CheckCircle className="h-4 w-4" />,
        })
      } else {
        console.error('❌ Financial data refresh failed:', result)
        
        toast.error('Failed to update financial data', {
          description: result.message,
          icon: <AlertCircle className="h-4 w-4" />,
        })
      }
    } catch (error) {
      console.error('❌ Financial data refresh error:', error)
      
      toast.error('Network error', {
        description: 'Failed to connect to the server. Please try again.',
        icon: <AlertCircle className="h-4 w-4" />,
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={className}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
      {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
    </Button>
  )
}
