'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { RedditPostsCarousel } from '@/components/reddit-posts-carousel'
import { 
  TrendingUp, 
  TrendingDown, 
  MessageCircle, 
  RefreshCw, 
  Search,
  Filter,
  BarChart3,
  Activity,
  Target,
  Zap
} from 'lucide-react'
import { 
  useSentimentData, 
  useRefreshSentimentData, 
  useBullishTickers,
  useBearishTickers,
  useMostMentionedTickers,
  getSentimentColor, 
  getSentimentEmoji, 
  formatSentimentScore,
  SentimentSource,
  SentimentTimeframe
} from '@/hooks/use-sentiment-data'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ScatterChart, Scatter } from 'recharts'

export default function SentimentPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [source, setSource] = useState<SentimentSource>('all')
  const [timeframe, setTimeframe] = useState<SentimentTimeframe>('24h')
  const [searchTicker, setSearchTicker] = useState('')

  // Fetch sentiment data
  const { data: sentimentResponse, isLoading: sentimentLoading } = useSentimentData(source, timeframe)
  const { data: bullishData, isLoading: bullishLoading } = useBullishTickers(10, source, timeframe)
  const { data: bearishData, isLoading: bearishLoading } = useBearishTickers(10, source, timeframe)
  const { data: mentionedData, isLoading: mentionedLoading } = useMostMentionedTickers(10, source, timeframe)
  const { mutate: refreshSentimentData, isPending: isRefreshing } = useRefreshSentimentData(source, timeframe)

  // Filter data based on search
  const filteredData = sentimentResponse?.data?.filter(item => 
    item.ticker.toLowerCase().includes(searchTicker.toLowerCase())
  ) || []

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sentiment Analysis</h1>
          <p className="text-muted-foreground">
            Track social media sentiment to identify growth opportunities
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refreshSentimentData()}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Source:</label>
          <Select value={source} onValueChange={(value: SentimentSource) => setSource(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="reddit">Reddit</SelectItem>
              <SelectItem value="twitter">Twitter/X</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Timeframe:</label>
          <Select value={timeframe} onValueChange={(value: SentimentTimeframe) => setTimeframe(value)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24h</SelectItem>
              <SelectItem value="7d">7d</SelectItem>
              <SelectItem value="30d">30d</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ticker..."
            value={searchTicker}
            onChange={(e) => setSearchTicker(e.target.value)}
            className="w-40"
          />
        </div>

        {sentimentResponse?.sources && (
          <div className="flex items-center gap-2">
            {sentimentResponse.sources.includes('Reddit API') && (
              <Badge variant="default">Live Reddit</Badge>
            )}
            {sentimentResponse.sources.includes('Twitter API') && (
              <Badge variant="default">Live Twitter</Badge>
            )}
            {sentimentResponse.sources.includes('Mock data') && (
              <Badge variant="destructive">Mock Data</Badge>
            )}
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="text-xs">
            <BarChart3 className="h-4 w-4 mr-1" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="bullish" className="text-xs">
            <TrendingUp className="h-4 w-4 mr-1" />
            Most Bullish
          </TabsTrigger>
          <TabsTrigger value="bearish" className="text-xs">
            <TrendingDown className="h-4 w-4 mr-1" />
            Most Bearish
          </TabsTrigger>
          <TabsTrigger value="trending" className="text-xs">
            <Activity className="h-4 w-4 mr-1" />
            Trending
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Mentions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sentimentResponse?.data?.reduce((sum, item) => sum + item.mention_count, 0) || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across {sentimentResponse?.data?.length || 0} stocks
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Bullish Stocks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {sentimentResponse?.data?.filter(item => item.sentiment_score > 0.1).length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Positive sentiment
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Bearish Stocks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {sentimentResponse?.data?.filter(item => item.sentiment_score < -0.1).length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Negative sentiment
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Neutral Stocks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">
                  {sentimentResponse?.data?.filter(item => Math.abs(item.sentiment_score) <= 0.1).length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Mixed sentiment
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Reddit Posts Carousel */}
          {sentimentResponse?.topPosts && sentimentResponse.topPosts.length > 0 ? (
            <RedditPostsCarousel posts={sentimentResponse.topPosts} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📱 Top Reddit Posts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Click "Refresh Data" to fetch latest Reddit posts with real-time sentiment analysis.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Sentiment vs Mentions Scatter Plot */}
          <Card>
            <CardHeader>
              <CardTitle>Sentiment vs Mention Volume</CardTitle>
            </CardHeader>
            <CardContent>
              {sentimentLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <ScatterChart data={filteredData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="mention_count" 
                      name="Mentions"
                      tickFormatter={(value) => `${value}`}
                    />
                    <YAxis 
                      dataKey="sentiment_score" 
                      name="Sentiment"
                      domain={[-1, 1]}
                      tickFormatter={(value) => formatSentimentScore(value)}
                    />
                    <Tooltip 
                      formatter={(value, name, props) => {
                        if (name === 'sentiment_score') {
                          return [formatSentimentScore(value as number), 'Sentiment']
                        }
                        return [value, name]
                      }}
                      labelFormatter={(value, payload) => {
                        if (payload && payload[0]) {
                          return `${payload[0].payload.ticker}`
                        }
                        return value
                      }}
                    />
                    <Scatter 
                      dataKey="sentiment_score" 
                      fill="#8884d8"
                      name="Stocks"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* All Stocks Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Stocks by Sentiment</CardTitle>
            </CardHeader>
            <CardContent>
              {sentimentLoading ? (
                <div className="space-y-3">
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredData
                    .sort((a, b) => b.sentiment_score - a.sentiment_score)
                    .map((stock) => (
                      <div key={stock.ticker} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-lg font-bold">{stock.ticker}</div>
                            <div className="text-2xl">{getSentimentEmoji(stock.sentiment_score)}</div>
                            <div className={`font-medium ${getSentimentColor(stock.sentiment_score)}`}>
                              {formatSentimentScore(stock.sentiment_score)}
                            </div>
                            <Badge variant={stock.sentiment_label === 'positive' ? 'default' : 
                                           stock.sentiment_label === 'negative' ? 'destructive' : 'secondary'}>
                              {stock.sentiment_label}
                            </Badge>
                            {stock.confidence && (
                              <Badge variant="outline">
                                {Math.round(stock.confidence * 100)}% confidence
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <MessageCircle className="h-4 w-4" />
                              {stock.mention_count} mentions
                            </div>
                            <div>
                              Reddit: {stock.source_breakdown.reddit.mentions} | 
                              Twitter: {stock.source_breakdown.twitter.mentions}
                            </div>
                          </div>
                        </div>
                        
                        {/* LLM Analysis Summary */}
                        {stock.summary && (
                          <div className="text-sm text-muted-foreground">
                            <strong>AI Summary:</strong> {stock.summary}
                          </div>
                        )}
                        
                        {/* Key Themes */}
                        {stock.key_themes && stock.key_themes.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {stock.key_themes.map((theme, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {theme}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bullish" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Most Bullish Stocks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bullishLoading ? (
                <div className="space-y-3">
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {bullishData?.data?.map((stock, index) => (
                    <div key={stock.ticker} className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl font-bold text-green-600">#{index + 1}</div>
                        <div>
                          <div className="text-lg font-bold">{stock.ticker}</div>
                          <div className="text-sm text-muted-foreground">
                            {stock.mention_count} mentions
                          </div>
                        </div>
                        <div className="text-3xl">{getSentimentEmoji(stock.sentiment_score)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-green-600">
                          {formatSentimentScore(stock.sentiment_score)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {stock.trending_contexts[0]?.substring(0, 50)}...
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bearish" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                Most Bearish Stocks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bearishLoading ? (
                <div className="space-y-3">
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {bearishData?.data?.map((stock, index) => (
                    <div key={stock.ticker} className="flex items-center justify-between p-4 border rounded-lg bg-red-50">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl font-bold text-red-600">#{index + 1}</div>
                        <div>
                          <div className="text-lg font-bold">{stock.ticker}</div>
                          <div className="text-sm text-muted-foreground">
                            {stock.mention_count} mentions
                          </div>
                        </div>
                        <div className="text-3xl">{getSentimentEmoji(stock.sentiment_score)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-red-600">
                          {formatSentimentScore(stock.sentiment_score)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {stock.trending_contexts[0]?.substring(0, 50)}...
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trending" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Most Mentioned Stocks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mentionedLoading ? (
                <div className="space-y-3">
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {mentionedData?.data?.map((stock, index) => (
                    <div key={stock.ticker} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl font-bold text-blue-600">#{index + 1}</div>
                        <div>
                          <div className="text-lg font-bold">{stock.ticker}</div>
                          <div className="text-sm text-muted-foreground">
                            Reddit: {stock.source_breakdown.reddit.mentions} | 
                            Twitter: {stock.source_breakdown.twitter.mentions}
                          </div>
                        </div>
                        <div className="text-2xl">{getSentimentEmoji(stock.sentiment_score)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">
                          {stock.mention_count} mentions
                        </div>
                        <div className={`text-sm font-medium ${getSentimentColor(stock.sentiment_score)}`}>
                          {formatSentimentScore(stock.sentiment_score)} sentiment
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}