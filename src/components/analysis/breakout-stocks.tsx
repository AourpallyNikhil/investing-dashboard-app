'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  DollarSign, 
  Users, 
  MessageCircle,
  ExternalLink,
  Target,
  AlertTriangle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface BreakoutStock {
  ticker: string
  sentiment_score: number
  sentiment_label: string
  mention_count: number
  confidence: number
  key_themes: string[]
  summary: string
  breakout_score: number
  last_updated: string
}

interface SocialPost {
  ticker: string
  title: string
  subreddit?: string
  author: string
  score: number
  num_comments: number
  llm_sentiment_score: number
  llm_sentiment_label: string
  llm_confidence: number
  llm_key_themes: string[]
  llm_has_catalyst: boolean
  llm_catalysts: string[] | null
  llm_actionability_score?: number
  llm_reasoning?: string
  retrieved_at: string
  permalink: string
  content_preview: string
}

async function fetchBreakoutStocks(): Promise<BreakoutStock[]> {
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
        summary,
        last_updated
      `)
      .not('ticker', 'in', `(${megaCapTickers.map(t => `"${t}"`).join(',')})`)
      .gte('last_updated', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .gte('mention_count', 2) // At least some social media attention
      .not('sentiment_score', 'is', null)
      .order('last_updated', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error fetching breakout stocks:', error)
      return []
    }

    if (!data || data.length === 0) {
      return []
    }

    // Calculate breakout scores and filter
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

      return {
        ticker: stock.ticker,
        sentiment_score: sentimentScore,
        sentiment_label: stock.sentiment_label || 'neutral',
        mention_count: mentionCount,
        confidence: confidence,
        key_themes: stock.key_themes || [],
        summary: stock.summary || '',
        breakout_score: breakoutScore,
        last_updated: stock.last_updated
      }
    })

    // Sort by breakout score and return top candidates
    return breakoutStocks
      .filter(stock => stock.breakout_score > 0.5) // Minimum threshold
      .sort((a, b) => b.breakout_score - a.breakout_score)
      .slice(0, 10)

  } catch (error) {
    console.error('Error in fetchBreakoutStocks:', error)
    return []
  }
}

async function fetchSocialPosts(breakoutTickers?: string[]): Promise<SocialPost[]> {
  try {
    // If no breakout tickers provided, get them from sentiment data
    let tickersToQuery = breakoutTickers
    
    if (!tickersToQuery || tickersToQuery.length === 0) {
      // Get current breakout tickers from sentiment data
      const megaCapTickers = [
        'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'TSLA', 'META', 
        'BRK.A', 'BRK.B', 'UNH', 'JNJ', 'JPM', 'V', 'PG', 'HD', 'MA', 
        'AVGO', 'CVX', 'LLY', 'ABBV', 'PFE', 'KO', 'PEP', 'TMO', 'COST', 
        'MRK', 'BAC', 'ADBE', 'WMT', 'DIS', 'ABT', 'CRM', 'VZ', 'NFLX'
      ]

      const { data: sentimentData } = await supabase
        .from('sentiment_data')
        .select('ticker')
        .not('ticker', 'in', `(${megaCapTickers.map(t => `"${t}"`).join(',')})`)
        .gte('last_updated', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .gte('mention_count', 2)
        .limit(10)

      tickersToQuery = sentimentData?.map((s: any) => s.ticker) || []
    }

    if (tickersToQuery.length === 0) {
      return []
    }

    // Fetch both Reddit and Twitter posts
    const [redditData, twitterData] = await Promise.all([
      // Reddit posts
      supabase
        .from('reddit_posts_raw')
        .select(`
          llm_ticker,
          title,
          subreddit,
          author,
          score,
          num_comments,
          llm_sentiment_score,
          llm_sentiment_label,
          llm_confidence,
          llm_key_themes,
          llm_has_catalyst,
          llm_catalysts,
          retrieved_at,
          permalink,
          selftext
        `)
        .in('llm_ticker', tickersToQuery)
        .gte('retrieved_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .order('score', { ascending: false })
        .limit(20),
      
      // Twitter posts with high actionability
      supabase
        .from('twitter_posts_raw')
        .select(`
          llm_ticker,
          text,
          author_username,
          like_count,
          retweet_count,
          reply_count,
          llm_sentiment_score,
          llm_sentiment_label,
          llm_confidence,
          llm_key_themes,
          llm_has_catalyst,
          llm_actionability_score,
          llm_reasoning,
          created_at,
          url
        `)
        .in('llm_ticker', tickersToQuery)
        .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .gte('llm_actionability_score', 0.5) // Use 0.5 since that's the actual value
        .order('llm_actionability_score', { ascending: false })
        .order('like_count', { ascending: false })
        .limit(20)
    ])

    const allPosts: SocialPost[] = []

    // Process Reddit posts
    if (redditData.data) {
      const redditPosts = redditData.data.map((post: any) => ({
        ticker: post.llm_ticker,
        title: post.title,
        subreddit: post.subreddit,
        author: post.author,
        score: post.score,
        num_comments: post.num_comments,
        llm_sentiment_score: parseFloat(post.llm_sentiment_score || '0'),
        llm_sentiment_label: post.llm_sentiment_label || 'neutral',
        llm_confidence: parseFloat(post.llm_confidence || '0'),
        llm_key_themes: post.llm_key_themes || [],
        llm_has_catalyst: post.llm_has_catalyst || false,
        llm_catalysts: post.llm_catalysts,
        retrieved_at: post.retrieved_at,
        permalink: post.permalink,
        content_preview: post.selftext?.substring(0, 200) || ''
      }))
      allPosts.push(...redditPosts)
    }

    // Process Twitter posts
    if (twitterData.data) {
      const twitterPosts = twitterData.data.map((post: any) => ({
        ticker: post.llm_ticker,
        title: post.text, // Use tweet text as title
        subreddit: 'Twitter', // Mark as Twitter
        author: post.author_username,
        score: post.like_count + post.retweet_count + post.reply_count, // Engagement score
        num_comments: post.reply_count,
        llm_sentiment_score: parseFloat(post.llm_sentiment_score || '0'),
        llm_sentiment_label: post.llm_sentiment_label || 'neutral',
        llm_confidence: parseFloat(post.llm_confidence || '0'),
        llm_key_themes: post.llm_key_themes || [],
        llm_has_catalyst: post.llm_has_catalyst || false,
        llm_catalysts: null,
        llm_actionability_score: parseFloat(post.llm_actionability_score || '0'),
        llm_reasoning: post.llm_reasoning || '',
        retrieved_at: post.created_at,
        permalink: post.url || '',
        content_preview: post.text?.substring(0, 200) || ''
      }))
      allPosts.push(...twitterPosts)
    }

    // No mock data - only show real Twitter posts for breakout candidates

    // Sort by engagement/score and return
    return allPosts
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)

  } catch (error) {
    console.error('Error in fetchSocialPosts:', error)
    return []
  }
}

function BreakoutStockCard({ stock }: { stock: BreakoutStock }) {
  const getSentimentColor = (sentiment: string, score: number) => {
    if (sentiment === 'positive' && score > 0.6) return 'text-green-600 bg-green-50'
    if (sentiment === 'positive') return 'text-green-500 bg-green-50'
    if (sentiment === 'negative') return 'text-red-500 bg-red-50'
    return 'text-gray-500 bg-gray-50'
  }

  const getBreakoutLevel = (score: number) => {
    if (score >= 2.5) return { label: 'High', color: 'bg-red-500', icon: TrendingUp }
    if (score >= 1.5) return { label: 'Medium', color: 'bg-orange-500', icon: Target }
    return { label: 'Low', color: 'bg-yellow-500', icon: AlertTriangle }
  }

  const breakoutLevel = getBreakoutLevel(stock.breakout_score)
  const BreakoutIcon = breakoutLevel.icon

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-lg font-bold">${stock.ticker}</CardTitle>
            <Badge 
              variant="outline" 
              className={`${breakoutLevel.color} text-white border-0`}
            >
              <BreakoutIcon className="w-3 h-3 mr-1" />
              {breakoutLevel.label} Potential
            </Badge>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {stock.breakout_score.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">Breakout Score</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-1">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Sentiment</span>
            </div>
            <Badge className={getSentimentColor(stock.sentiment_label, stock.sentiment_score)}>
              {(stock.sentiment_score * 100).toFixed(0)}% {stock.sentiment_label}
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Mentions</span>
            </div>
            <div className="text-lg font-semibold">{stock.mention_count}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-1">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Key Themes</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {stock.key_themes.slice(0, 3).map((theme, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {theme}
              </Badge>
            ))}
            {stock.key_themes.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{stock.key_themes.length - 3} more
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Summary</div>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {stock.summary}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            Confidence: {(stock.confidence * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-muted-foreground">
            Updated: {new Date(stock.last_updated).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SocialPostCard({ post }: { post: SocialPost }) {
  const getSentimentIcon = (sentiment: string) => {
    if (sentiment === 'positive') return <TrendingUp className="w-4 h-4 text-green-500" />
    if (sentiment === 'negative') return <TrendingDown className="w-4 h-4 text-red-500" />
    return <MessageCircle className="w-4 h-4 text-gray-500" />
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="font-mono text-xs">
              ${post.ticker}
            </Badge>
            {post.llm_has_catalyst && (
              <Badge className="bg-orange-500 text-white text-xs">
                <Zap className="w-3 h-3 mr-1" />
                Catalyst
              </Badge>
            )}
            {post.subreddit === 'Twitter' && post.llm_actionability_score && post.llm_actionability_score > 0.4 && (
              <Badge className="bg-blue-500 text-white text-xs">
                Action: {(post.llm_actionability_score * 100).toFixed(0)}%
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-1">
            {getSentimentIcon(post.llm_sentiment_label)}
            <span className="text-xs text-muted-foreground">
              {(post.llm_sentiment_score * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        <CardTitle className="text-sm line-clamp-2">{post.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {post.content_preview && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {post.content_preview.replace(/&#\d+;/g, '').replace(/\[.*?\]/g, '')}
          </p>
        )}
        
        {post.llm_key_themes && post.llm_key_themes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.llm_key_themes.slice(0, 2).map((theme, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {theme}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-3">
            {post.subreddit === 'Twitter' ? (
              <>
                <span>@{post.author}</span>
                <span>Twitter</span>
              </>
            ) : (
              <>
                <span>r/{post.subreddit}</span>
                <span>u/{post.author}</span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {post.subreddit === 'Twitter' ? (
              <span>{post.score} engagement</span>
            ) : (
              <>
                <span>{post.score} upvotes</span>
                <span>{post.num_comments} comments</span>
              </>
            )}
          </div>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={() => {
            const url = post.subreddit === 'Twitter' 
              ? post.permalink 
              : `https://reddit.com${post.permalink}`
            window.open(url, '_blank')
          }}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          {post.subreddit === 'Twitter' ? 'View on Twitter' : 'View on Reddit'}
        </Button>
      </CardContent>
    </Card>
  )
}

export function BreakoutStocks() {
  const { data: breakoutStocks, isLoading: stocksLoading } = useQuery({
    queryKey: ['breakout-stocks'],
    queryFn: fetchBreakoutStocks,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const { data: socialPosts, isLoading: postsLoading } = useQuery({
    queryKey: ['breakout-social-posts', breakoutStocks?.map(s => s.ticker)],
    queryFn: () => fetchSocialPosts(breakoutStocks?.map(s => s.ticker)),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!breakoutStocks && breakoutStocks.length > 0, // Only run when we have breakout stocks
  })

  if (stocksLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-20" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Breakout Stocks Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Target className="w-6 h-6 text-primary" />
              Breakout Potential Stocks
            </h2>
            <p className="text-muted-foreground">
              Small-cap stocks with high breakout potential based on sentiment analysis
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            Real-time data • Excludes mega-caps
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {breakoutStocks?.map((stock, index) => (
            <BreakoutStockCard key={`${stock.ticker}-${stock.last_updated}-${index}`} stock={stock} />
          ))}
        </div>
      </div>

      {/* Social Media Posts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-primary" />
              Social Media Discussions
            </h2>
            <p className="text-muted-foreground">
              Recent Twitter and Reddit posts mentioning breakout candidates (48 hours)
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {socialPosts?.length || 0} posts found
          </Badge>
        </div>

        {postsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-full" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : socialPosts && socialPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {socialPosts.map((post, index) => (
              <SocialPostCard key={`${post.ticker}-${post.subreddit}-${post.retrieved_at}-${index}`} post={post} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">No social media posts found for breakout stocks in the last 48 hours</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
