// Configuration for which tickers to fetch data for
// Only these tickers will be fetched from Financial Datasets API to control costs

export interface TickerConfig {
  ticker: string
  name: string
  sector: string
  industry: string
  priority: 'high' | 'medium' | 'low' // For update frequency
  enabled: boolean
}

// Your personalized ticker list - modify this to control costs
export const TRACKED_TICKERS: TickerConfig[] = [
  // High priority - daily updates
  {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    priority: 'high',
    enabled: true
  },
  {
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    sector: 'Technology', 
    industry: 'Software',
    priority: 'high',
    enabled: true
  },
  {
    ticker: 'GOOGL',
    name: 'Alphabet Inc.',
    sector: 'Technology',
    industry: 'Internet Services',
    priority: 'high',
    enabled: true
  },
  {
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    sector: 'Technology',
    industry: 'Semiconductors',
    priority: 'high',
    enabled: true
  },
  
  // Medium priority - weekly updates
  {
    ticker: 'AMZN',
    name: 'Amazon.com Inc.',
    sector: 'Consumer Discretionary',
    industry: 'E-commerce',
    priority: 'medium',
    enabled: true
  },
  {
    ticker: 'TSLA',
    name: 'Tesla Inc.',
    sector: 'Consumer Discretionary',
    industry: 'Electric Vehicles',
    priority: 'medium',
    enabled: true
  },
  {
    ticker: 'META',
    name: 'Meta Platforms Inc.',
    sector: 'Technology',
    industry: 'Social Media',
    priority: 'medium',
    enabled: true
  },
  
  // Low priority - monthly updates
  {
    ticker: 'JPM',
    name: 'JPMorgan Chase & Co.',
    sector: 'Financial Services',
    industry: 'Banking',
    priority: 'low',
    enabled: false // Disabled to save costs initially
  },
  {
    ticker: 'JNJ',
    name: 'Johnson & Johnson',
    sector: 'Healthcare',
    industry: 'Pharmaceuticals',
    priority: 'low',
    enabled: false // Disabled to save costs initially
  },
  {
    ticker: 'V',
    name: 'Visa Inc.',
    sector: 'Financial Services',
    industry: 'Payment Systems',
    priority: 'low',
    enabled: false // Disabled to save costs initially
  }
]

// Helper functions
export const getEnabledTickers = (): TickerConfig[] => {
  return TRACKED_TICKERS.filter(t => t.enabled)
}

export const getTickersByPriority = (priority: 'high' | 'medium' | 'low'): TickerConfig[] => {
  return TRACKED_TICKERS.filter(t => t.enabled && t.priority === priority)
}

export const getTickerConfig = (ticker: string): TickerConfig | undefined => {
  return TRACKED_TICKERS.find(t => t.ticker === ticker)
}
