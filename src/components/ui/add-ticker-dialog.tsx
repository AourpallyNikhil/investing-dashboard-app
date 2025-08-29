'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2, Search, CheckCircle, AlertCircle } from 'lucide-react'
import { useTickerManagement } from '@/hooks/use-ticker-management'

interface AddTickerDialogProps {
  onSuccess?: () => void
}

const SECTORS = [
  'Technology',
  'Healthcare', 
  'Financial Services',
  'Consumer Discretionary',
  'Consumer Staples',
  'Energy',
  'Materials',
  'Industrials',
  'Utilities',
  'Real Estate',
  'Communication Services'
]

const EXCHANGES = [
  'NASDAQ',
  'NYSE', 
  'AMEX',
  'OTC'
]

export function AddTickerDialog({ onSuccess }: AddTickerDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    ticker: '',
    name: '',
    sector: '',
    industry: '',
    exchange: 'NASDAQ'
  })
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'success' | 'error' | 'manual'>('idle')
  const [lookupMessage, setLookupMessage] = useState('')

  const { addTicker, isAdding, error, clearError } = useTickerManagement()

  // Ticker lookup function
  const lookupTicker = useCallback(async (symbol: string) => {
    if (!symbol || symbol.length < 1) {
      setLookupStatus('idle')
      return
    }

    setIsLookingUp(true)
    setLookupStatus('idle')
    
    try {
      console.log(`🔍 Looking up ticker: ${symbol}`)
      const response = await fetch(`/api/ticker-lookup?symbol=${encodeURIComponent(symbol)}`)
      const result = await response.json()

      if (result.success && result.data) {
        // Auto-populate form with fetched data
        setFormData(prev => ({
          ...prev,
          name: result.data.name,
          exchange: result.data.exchange,
          sector: result.data.sector,
          industry: result.data.industry
        }))
        setLookupStatus('success')
        setLookupMessage(`Found: ${result.data.name}`)
        console.log(`✅ Successfully looked up ${symbol}:`, result.data)
      } else {
        // Not found in database
        setLookupStatus('error')
        setLookupMessage(result.error || 'Ticker not found. Please enter details manually.')
        console.log(`❌ Ticker ${symbol} not found`)
      }
    } catch (error) {
      console.error('❌ Error looking up ticker:', error)
      setLookupStatus('error')
      setLookupMessage('Error looking up ticker. Please enter details manually.')
    } finally {
      setIsLookingUp(false)
    }
  }, [])

  // Handle ticker input change with debounced lookup
  const handleTickerChange = useCallback((value: string) => {
    const upperValue = value.toUpperCase()
    setFormData(prev => ({ ...prev, ticker: upperValue }))
    
    // Clear previous lookup status
    setLookupStatus('idle')
    setLookupMessage('')
    
    // If user clears the ticker, clear other fields
    if (!upperValue) {
      setFormData(prev => ({
        ...prev,
        name: '',
        sector: '',
        industry: '',
        exchange: 'NASDAQ'
      }))
      return
    }
    
    // Trigger lookup after a short delay (debounce)
    const timeoutId = setTimeout(() => {
      lookupTicker(upperValue)
    }, 500)
    
    return () => clearTimeout(timeoutId)
  }, [lookupTicker])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.ticker.trim() || !formData.name.trim()) {
      return
    }

    try {
      await addTicker({
        ticker: formData.ticker.trim(),
        name: formData.name.trim(),
        sector: formData.sector || undefined,
        industry: formData.industry || undefined,
        exchange: formData.exchange || undefined
      })

      // Reset form and close dialog
      setFormData({
        ticker: '',
        name: '',
        sector: '',
        industry: '',
        exchange: 'NASDAQ'
      })
      setIsOpen(false)
      onSuccess?.()
      
    } catch (err) {
      // Error is handled by the hook
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      clearError()
      setFormData({
        ticker: '',
        name: '',
        sector: '',
        industry: '',
        exchange: 'NASDAQ'
      })
      setLookupStatus('idle')
      setLookupMessage('')
      setIsLookingUp(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="sm"
        className="flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Ticker
      </Button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-black border border-gray-700 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add New Ticker</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
                className="h-6 w-6 p-0 text-white hover:text-gray-300"
              >
                ×
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ticker">Ticker Symbol *</Label>
                  <div className="relative">
                    <Input
                      id="ticker"
                      value={formData.ticker}
                      onChange={(e) => handleTickerChange(e.target.value)}
                      placeholder="AAPL"
                      required
                      maxLength={10}
                      className={`pr-10 ${
                        lookupStatus === 'success' ? 'border-green-500' :
                        lookupStatus === 'error' ? 'border-yellow-500' : ''
                      }`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isLookingUp ? (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      ) : lookupStatus === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      ) : lookupStatus === 'error' ? (
                        <AlertCircle className="h-4 w-4 text-yellow-400" />
                      ) : formData.ticker ? (
                        <Search className="h-4 w-4 text-gray-400" />
                      ) : null}
                    </div>
                  </div>
                  {lookupMessage && (
                    <div className={`text-xs ${
                      lookupStatus === 'success' ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {lookupMessage}
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="exchange">Exchange</Label>
                  <Select 
                    value={formData.exchange} 
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      exchange: value 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXCHANGES.map(exchange => (
                        <SelectItem key={exchange} value={exchange}>
                          {exchange}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    name: e.target.value 
                  }))}
                  placeholder="Apple Inc."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sector">Sector</Label>
                <Select 
                  value={formData.sector} 
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    sector: value 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sector" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(sector => (
                      <SelectItem key={sector} value={sector}>
                        {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={formData.industry}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    industry: e.target.value 
                  }))}
                  placeholder="Consumer Electronics"
                />
              </div>

              {error && (
                <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 p-3 rounded">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  className="flex-1"
                  disabled={isAdding}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isAdding || !formData.ticker.trim() || !formData.name.trim()}
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Ticker'
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-4 text-xs text-gray-400">
              * Required fields. Enter a ticker symbol and we'll try to auto-populate the company details. After adding, you can use the "Refresh Data" button to fetch financial data for this ticker.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
