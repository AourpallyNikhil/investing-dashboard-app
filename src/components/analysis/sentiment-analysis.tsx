'use client'

import { useQuery } from '@tanstack/react-query'
import { useSentimentData, useRefreshSentimentData, getSentimentColor, getSentimentEmoji, formatSentimentScore } from '@/hooks/use-sentiment-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { TrendingUp, TrendingDown, MessageCircle, Heart, Repeat2, ExternalLink } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface SentimentAnalysisProps {
  ticker: string
}

// Mock data - will be replaced with real Twitter/X API
const mockSentimentData = {
  overallSentiment: {
    score: 0.65,
    trend: 'up',
    total_mentions: 1247,
    positive_mentions: 810,
    negative_mentions: 297,
    neutral_mentions: 140
  },
  sentimentHistory: [
    { date: '2024-08-20', sentiment: 0.72, mentions: 156 },
    { date: '2024-08-21', sentiment: 0.68, mentions: 189 },
    { date: '2024-08-22', sentiment: 0.65, mentions: 234 },
    { date: '2024-08-23', sentiment: 0.71, mentions: 198 },
    { date: '2024-08-24', sentiment: 0.65, mentions: 147 },
  ],
  influencerTweets: [
    {
      author: "Cathie Wood",
      handle: "@CathieDWood",
      avatar: "/avatars/cathie-wood.jpg",
      followers: 1200000,
      content: "AAPL's AI integration strategy positions them well for the next computing paradigm shift. Innovation at scale. 🚀",
      sentiment: 0.85,
      timestamp: "2024-08-24T10:30:00Z",
      likes: 2847,
      retweets: 1205,
      replies: 342
    },
    {
      author: "Warren Buffett",
      handle: "@WarrenBuffett",
      avatar: "/avatars/warren-buffett.jpg",
      followers: 850000,
      content: "Quality businesses with strong moats continue to compound wealth over decades. Focus on fundamentals, not noise.",
      sentiment: 0.72,
      timestamp: "2024-08-24T08:15:00Z",
      likes: 5623,
      retweets: 2108,
      replies: 891
    },
    {
      author: "Chamath Palihapitiya",
      handle: "@chamath",
      avatar: "/avatars/chamath.jpg",
      followers: 1500000,
      content: "Big Tech margins under pressure from AI capex. Need to see revenue acceleration to justify current multiples. $AAPL",
      sentiment: 0.35,
      timestamp: "2024-08-23T16:45:00Z",
      likes: 1834,
      retweets: 756,
      replies: 423
    },
    {
      author: "Kathy Lien",
      handle: "@KathyLien",
      avatar: "/avatars/kathy-lien.jpg",
      followers: 680000,
      content: "Services revenue growth remains the key catalyst for AAPL. Ecosystem stickiness is unmatched.",
      sentiment: 0.78,
      timestamp: "2024-08-23T14:20:00Z",
      likes: 967,
      retweets: 234,
      replies: 156
    }
  ],
  trendingTopics: [
    { topic: "AI Integration", mentions: 342, sentiment: 0.76 },
    { topic: "Services Revenue", mentions: 289, sentiment: 0.68 },
    { topic: "iPhone 16", mentions: 567, sentiment: 0.82 },
    { topic: "Vision Pro", mentions: 234, sentiment: 0.45 },
    { topic: "Dividend", mentions: 123, sentiment: 0.71 }
  ]
}

function SentimentOverview({ sentiment, isLoading }: { sentiment: any, isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }

  const getSentimentColor = (score: number) => {
    if (score >= 0.7) return 'text-green-600'
    if (score >= 0.4) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getSentimentLabel = (score: number) => {
    if (score >= 0.7) return 'Bullish'
    if (score >= 0.4) return 'Neutral'
    return 'Bearish'
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Overall Sentiment</p>
            {sentiment.trend === 'up' ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </div>
          <p className={`text-2xl font-bold ${getSentimentColor(sentiment.score)}`}>
            {getSentimentLabel(sentiment.score)}
          </p>
          <p className="text-sm text-muted-foreground">
            {(sentiment.score * 100).toFixed(0)}% positive
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Mentions</p>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{sentiment.total_mentions.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">Last 7 days</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Positive Mentions</p>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">{sentiment.positive_mentions}</p>
          <p className="text-sm text-muted-foreground">
            {((sentiment.positive_mentions / sentiment.total_mentions) * 100).toFixed(0)}% of total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Negative Mentions</p>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-600">{sentiment.negative_mentions}</p>
          <p className="text-sm text-muted-foreground">
            {((sentiment.negative_mentions / sentiment.total_mentions) * 100).toFixed(0)}% of total
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function SentimentChart({ data, isLoading }: { data: any[], isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-64" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sentiment Trend (7 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis 
                domain={[0, 1]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
              />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Sentiment Score']}
              />
              <Line 
                type="monotone" 
                dataKey="sentiment" 
                stroke="#2563eb" 
                strokeWidth={2}
                dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function InfluencerTweets({ tweets, isLoading }: { tweets: any[], isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Influencer Sentiment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const getSentimentBadge = (sentiment: number) => {
    if (sentiment >= 0.7) return { variant: 'default' as const, label: 'Bullish' }
    if (sentiment >= 0.4) return { variant: 'secondary' as const, label: 'Neutral' }
    return { variant: 'destructive' as const, label: 'Bearish' }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Influencer Sentiment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {tweets.map((tweet, index) => {
            const sentimentBadge = getSentimentBadge(tweet.sentiment)
            return (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarImage src={tweet.avatar} alt={tweet.author} />
                    <AvatarFallback>
                      {tweet.author.split(' ').map((n: string) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{tweet.author}</span>
                      <span className="text-sm text-muted-foreground">{tweet.handle}</span>
                      <Badge {...sentimentBadge} className="text-xs">
                        {sentimentBadge.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {tweet.followers.toLocaleString()} followers
                    </p>
                    <p className="text-sm leading-relaxed">{tweet.content}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Heart className="h-4 w-4" />
                      {tweet.likes.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Repeat2 className="h-4 w-4" />
                      {tweet.retweets.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      {tweet.replies.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(tweet.timestamp).toLocaleDateString()}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function TrendingTopics({ topics, isLoading }: { topics: any[], isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trending Topics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trending Topics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topics.map((topic, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">{topic.topic}</div>
                <div className="text-sm text-muted-foreground">
                  {topic.mentions} mentions
                </div>
              </div>
              <Badge 
                variant={topic.sentiment >= 0.6 ? 'default' : topic.sentiment >= 0.4 ? 'secondary' : 'destructive'}
                className="text-xs"
              >
                {(topic.sentiment * 100).toFixed(0)}% positive
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function SentimentAnalysis({ ticker }: SentimentAnalysisProps) {
  // Fetch real sentiment data
  const { data: sentimentResponse, isLoading: sentimentLoading, error: sentimentError } = useSentimentData('all', '24h')
  const { mutate: refreshSentimentData, isPending: isRefreshing } = useRefreshSentimentData()
  
  // Find data for specific ticker or use overall data
  const tickerSentiment = sentimentResponse?.data?.find(item => item.ticker === ticker)
  const allSentimentData = sentimentResponse?.data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Sentiment Analysis</h2>
        <Badge variant="outline">Social Media Intelligence</Badge>
      </div>

      <div className="space-y-6">
        <SentimentOverview 
          sentiment={sentimentData?.overallSentiment} 
          isLoading={isLoading} 
        />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SentimentChart 
            data={sentimentData?.sentimentHistory || []} 
            isLoading={isLoading} 
          />
          <TrendingTopics 
            topics={sentimentData?.trendingTopics || []} 
            isLoading={isLoading} 
          />
        </div>
        
        <InfluencerTweets 
          tweets={sentimentData?.influencerTweets || []} 
          isLoading={isLoading} 
        />
        
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-900 mb-2">Positive Drivers</h4>
                <p className="text-sm text-green-700">
                  AI integration and iPhone 16 launch are driving positive sentiment, 
                  with 65% overall bullish sentiment from key influencers.
                </p>
              </div>
              
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-medium text-yellow-900 mb-2">Mixed Signals</h4>
                <p className="text-sm text-yellow-700">
                  Vision Pro adoption concerns and high valuation debates are creating 
                  some uncertainty among institutional voices.
                </p>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Key Themes</h4>
                <p className="text-sm text-blue-700">
                  Services revenue growth and ecosystem stickiness remain the most 
                  discussed positive themes across social media platforms.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
