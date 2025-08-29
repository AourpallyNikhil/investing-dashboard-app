import { Badge } from '@/components/ui/badge'
import { Company } from '@/lib/types'

interface CompanyHeaderProps {
  company: Company
  currentPrice: number | null
  priceChange: number | null
  priceChangePercent: number | null
}

export function CompanyHeader({
  company,
  currentPrice,
  priceChange,
  priceChangePercent,
}: CompanyHeaderProps) {
  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price)
  }

  const formatChange = (change: number | null, isPercent = false) => {
    if (change === null) return 'N/A'
    const prefix = change > 0 ? '+' : ''
    const suffix = isPercent ? '%' : ''
    return `${prefix}${change.toFixed(2)}${suffix}`
  }

  const getChangeColor = (change: number | null) => {
    if (change === null) return 'text-gray-500'
    if (change > 0) return 'text-green-600'
    if (change < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  return (
    <div className="border-b pb-6 mb-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold">{company.ticker}</h1>
            {company.exchange && (
              <Badge variant="secondary">{company.exchange}</Badge>
            )}
          </div>
          
          <h2 className="text-xl text-muted-foreground">
            {company.name || 'N/A'}
          </h2>
          
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            {company.sector && (
              <span>Sector: {company.sector}</span>
            )}
            {company.industry && (
              <span>Industry: {company.industry}</span>
            )}
            {company.country && (
              <span>Country: {company.country}</span>
            )}
          </div>
        </div>

        <div className="text-right space-y-1">
          <div className="text-3xl font-bold">
            {formatPrice(currentPrice)}
          </div>
          
          {(priceChange !== null || priceChangePercent !== null) && (
            <div className={`text-sm ${getChangeColor(priceChange)}`}>
              <span>{formatChange(priceChange)}</span>
              {priceChangePercent !== null && (
                <span className="ml-2">
                  ({formatChange(priceChangePercent, true)})
                </span>
              )}
            </div>
          )}
          
          <div className="text-xs text-muted-foreground">
            {company.currency || 'USD'}
          </div>
        </div>
      </div>
    </div>
  )
}
