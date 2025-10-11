import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface BreakoutStockSummary {
  ticker: string
  sentiment_score: number
  sentiment_label: string
  mention_count: number
  breakout_score: number
  key_catalyst: string
}

async function fetchBreakoutStocksSummary(): Promise<BreakoutStockSummary[]> {
  try {
    // Define mega-cap tickers to exclude
    const megaCapTickers = [
      'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'TSLA', 'META', 
      'BRK.A', 'BRK.B', 'UNH', 'JNJ', 'JPM', 'V', 'PG', 'HD', 'MA', 
      'AVGO', 'CVX', 'LLY', 'ABBV', 'PFE', 'KO', 'PEP', 'TMO', 'COST', 
      'MRK', 'BAC', 'ADBE', 'WMT', 'DIS', 'ABT', 'CRM', 'VZ', 'NFLX'
    ]

    // Fetch sentiment data excluding mega-caps
    const { data, error } = await supabase
      .from('sentiment_data')
      .select(`
        ticker,
        sentiment_score,
        sentiment_label,
        mention_count,
        confidence,
        key_themes,
        summary
      `)
      .not('ticker', 'in', `(${megaCapTickers.map(t => `"${t}"`).join(',')})`)
      .gte('last_updated', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .gte('mention_count', 2)
      .not('sentiment_score', 'is', null)
      .order('last_updated', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching breakout stocks summary:', error)
      return []
    }

    if (!data || data.length === 0) {
      return []
    }

    // Calculate breakout scores and return top 3
    const breakoutStocks = data.map((stock: any) => {
      const sentimentScore = parseFloat(stock.sentiment_score || '0')
      const mentionCount = stock.mention_count || 0
      const confidence = parseFloat(stock.confidence || '0')
      
      // Calculate breakout potential score
      let breakoutScore = sentimentScore * mentionCount * confidence
      
      // Apply bonuses for high activity
      if (mentionCount >= 10 && sentimentScore > 0.5) {
        breakoutScore *= 1.5
      } else if (mentionCount >= 5 && sentimentScore > 0.3) {
        breakoutScore *= 1.2
      }

      // Extract key catalyst from themes or summary
      let keyCatalyst = 'Social media buzz'
      if (stock.key_themes && stock.key_themes.length > 0) {
        keyCatalyst = stock.key_themes[0]
      } else if (stock.summary && stock.summary.includes('investment')) {
        keyCatalyst = 'Investment activity'
      } else if (stock.summary && stock.summary.includes('growth')) {
        keyCatalyst = 'Growth potential'
      }

      return {
        ticker: stock.ticker,
        sentiment_score: sentimentScore,
        sentiment_label: stock.sentiment_label || 'neutral',
        mention_count: mentionCount,
        breakout_score: breakoutScore,
        key_catalyst: keyCatalyst
      }
    })

    return breakoutStocks
      .filter(stock => stock.breakout_score > 0.5)
      .sort((a, b) => b.breakout_score - a.breakout_score)
      .slice(0, 3)

  } catch (error) {
    console.error('Error in fetchBreakoutStocksSummary:', error)
    return []
  }
}

export function useBreakoutStocks() {
  return useQuery({
    queryKey: ['breakout-stocks-summary'],
    queryFn: fetchBreakoutStocksSummary,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  })
}

