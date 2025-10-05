'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { SocialMediaPostsTable } from '@/components/ui/social-media-posts-table'
import { SocialPostsFilters } from '@/components/ui/social-posts-filters'
import { SentimentAnalysisTable } from '@/components/ui/sentiment-analysis-table'
import { SentimentFilters } from '@/components/ui/sentiment-filters'
import type { SentimentFilters as SentimentFiltersType } from '@/components/ui/sentiment-filters'
import { RefreshCw } from 'lucide-react'
import { 
  useSentimentData, 
  useRefreshSentimentData
} from '@/hooks/use-sentiment-data'
import { useSocialPosts } from '@/hooks/use-social-posts'
import { useSentimentAnalysis } from '@/hooks/use-sentiment-analysis'


export default function SentimentPage() {

  // New unified social posts filters
  const [socialFilters, setSocialFilters] = useState({
    source: 'all' as 'all' | 'twitter' | 'reddit',
    hours: 168, // 7 days to capture Reddit posts
    actionability: 0.0, // Don't filter by actionability by default
    sentiment: 'all' as 'all' | 'positive' | 'negative' | 'neutral',
    confidence: 0.0, // Don't filter by confidence by default
    ticker: ''
  })

  // New unified sentiment analysis filters
  const [sentimentFilters, setSentimentFilters] = useState<SentimentFiltersType>({
    sentimentType: 'all',
    source: 'all',
    timeframe: '24h',
    tickerSearch: '',
    mentionCountRange: [1, 1000],
    confidenceRange: [0.0, 1.0],
    sentimentScoreRange: [-1.0, 1.0],
    keyThemes: [],
    hasSummary: null,
    sortBy: 'mentions',
    sortDirection: 'desc'
  })

  // Fetch sentiment data (legacy - for overview stats)
  const { data: sentimentResponse, isLoading: sentimentLoading } = useSentimentData('all', '24h')
  const { mutate: refreshSentimentData, isPending: isRefreshing } = useRefreshSentimentData('all', '24h')

  // Fetch unified sentiment analysis data
  const { data: sentimentAnalysisData, isLoading: sentimentAnalysisLoading } = useSentimentAnalysis(sentimentFilters)

  // Fetch unified social posts
  const { data: socialPostsData, isLoading: socialPostsLoading } = useSocialPosts(socialFilters)



  // Handle ticker click navigation
  const handleTickerClick = (ticker: string) => {
    // Navigate to ticker detail page or open in new tab
    window.open(`/?ticker=${ticker}`, '_blank')
  }

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

      {/* Unified Sentiment Analysis Table */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <SentimentFilters
            filters={sentimentFilters}
            onFiltersChange={setSentimentFilters}
            availableThemes={sentimentAnalysisData?.availableThemes || []}
            mentionCountMax={sentimentAnalysisData?.mentionCountMax || 1000}
          />
        </div>
        
        <div className="lg:col-span-3">
          <SentimentAnalysisTable
            data={sentimentAnalysisData?.data || []}
            isLoading={sentimentAnalysisLoading}
            title={`Sentiment Analysis - ${sentimentAnalysisData?.totalCount || 0} Stocks`}
            onTickerClick={handleTickerClick}
          />
        </div>
      </div>

      {/* Social Media Posts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <SocialPostsFilters
            source={socialFilters.source}
            timeFilter={socialFilters.hours}
            actionabilityFilter={socialFilters.actionability}
            sentimentFilter={socialFilters.sentiment}
            confidenceFilter={socialFilters.confidence}
            tickerFilter={socialFilters.ticker}
            onSourceChange={(source) => setSocialFilters(f => ({...f, source}))}
            onTimeFilterChange={(hours) => setSocialFilters(f => ({...f, hours}))}
            onActionabilityFilterChange={(actionability) => setSocialFilters(f => ({...f, actionability}))}
            onSentimentFilterChange={(sentiment) => setSocialFilters(f => ({...f, sentiment}))}
            onConfidenceFilterChange={(confidence) => setSocialFilters(f => ({...f, confidence}))}
            onTickerFilterChange={(ticker) => setSocialFilters(f => ({...f, ticker}))}
          />
        </div>
        
        <div className="lg:col-span-3">
          <SocialMediaPostsTable 
            unifiedPosts={socialPostsData?.posts || []}
            title={`${socialPostsData?.count || 0} Actionable Posts`}
            selectedSource={socialFilters.source}
          />
        </div>
      </div>
    </div>
  )
}