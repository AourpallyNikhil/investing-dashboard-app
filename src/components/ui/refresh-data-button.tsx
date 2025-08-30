'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { RefreshCw, ChevronDown, TrendingUp, Clock, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react'
import { useDataRefresh } from '@/hooks/use-data-refresh'
import { cn } from '@/lib/utils'

interface RefreshDataButtonProps {
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

export function RefreshDataButton({ 
  className, 
  variant = 'outline',
  size = 'default' 
}: RefreshDataButtonProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [isSentimentRefreshing, setIsSentimentRefreshing] = useState(false)
  const {
    refreshHighPriority,
    refreshMediumPriority,
    refreshTickers,
    isRefreshing,
    lastRefresh,
    lastResult,
    error
  } = useDataRefresh()

  const handleRefresh = async (type: 'high' | 'medium' | 'specific') => {
    try {
      switch (type) {
        case 'high':
          await refreshHighPriority()
          break
        case 'medium':
          await refreshMediumPriority()
          break
        case 'specific':
          // For now, refresh popular tickers - could be made configurable
          await refreshTickers(['AAPL', 'MSFT', 'GOOGL'])
          break
      }
      setShowDropdown(false)
    } catch (error) {
      // Error is handled by the hook
      console.error('Refresh failed:', error)
    }
  }

  const handleSentimentRefresh = async () => {
    setIsSentimentRefreshing(true)
    try {
      console.log('🔄 Starting sentiment data refresh...')
      
      const response = await fetch('/api/cron/sentiment-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer R+4asd5JITElFBC59X/jsMkJEkOcq30B7a72i1vlkFg=`
        }
      })

      const data = await response.json()
      
      if (response.ok) {
        console.log('✅ Sentiment refresh completed:', data)
      } else {
        console.error('❌ Sentiment refresh failed:', data)
      }
      
      setShowDropdown(false)
    } catch (err) {
      console.error('❌ Sentiment refresh error:', err)
    } finally {
      setIsSentimentRefreshing(false)
    }
  }

  const formatLastRefresh = (date: Date | null) => {
    if (!date) return 'Never'
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="flex items-center gap-2">
      {/* Simple refresh button */}
      <Button
        variant={variant}
        size={size}
        onClick={() => handleRefresh('high')}
        disabled={isRefreshing}
        className={cn(
          "flex items-center gap-2",
          isRefreshing && "cursor-not-allowed opacity-60",
          className
        )}
      >
        <RefreshCw 
          className={cn(
            "h-4 w-4",
            isRefreshing && "animate-spin"
          )} 
        />
        {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
      </Button>

      {/* Dropdown for advanced options */}
      <DropdownMenu open={showDropdown} onOpenChange={setShowDropdown}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className="px-2"
            disabled={isRefreshing}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Data Refresh Options
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={() => handleRefresh('high')}
            disabled={isRefreshing}
            className="flex items-center justify-between"
          >
            <div>
              <div className="font-medium">High Priority Stocks</div>
              <div className="text-sm text-muted-foreground">AAPL, MSFT, GOOGL, NVDA</div>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Recommended
            </Badge>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => handleRefresh('medium')}
            disabled={isRefreshing}
          >
            <div>
              <div className="font-medium">Medium Priority Stocks</div>
              <div className="text-sm text-muted-foreground">AMZN, TSLA, META</div>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => handleRefresh('specific')}
            disabled={isRefreshing}
          >
            <div>
              <div className="font-medium">Popular Stocks</div>
              <div className="text-sm text-muted-foreground">Top 3 most viewed</div>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={handleSentimentRefresh}
            disabled={isSentimentRefreshing || isRefreshing}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <div>
                <div className="font-medium">Sentiment Data</div>
                <div className="text-sm text-muted-foreground">Reddit & Twitter analysis</div>
              </div>
            </div>
            {isSentimentRefreshing && (
              <RefreshCw className="h-4 w-4 animate-spin" />
            )}
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Status information */}
          <div className="px-2 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-3 w-3" />
              Last refresh: {formatLastRefresh(lastRefresh)}
            </div>
            
            {error && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-3 w-3" />
                {error}
              </div>
            )}
            
            {lastResult && !error && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-3 w-3" />
                Updated {lastResult.stats.updatedTickers.length} stocks
                {(lastResult as any).demoMode && (
                  <span className="text-xs text-amber-600">(Demo)</span>
                )}
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
