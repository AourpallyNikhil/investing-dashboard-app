import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface SentimentDataPoint {
  ticker: string;
  sentiment_score: number;
  sentiment_label: 'positive' | 'negative' | 'neutral';
  mention_count: number;
  confidence?: number;
  key_themes?: string[];
  summary?: string;
  source_breakdown: {
    reddit: { mentions: number; avg_sentiment: number };
    twitter: { mentions: number; avg_sentiment: number };
  };
  trending_contexts: string[];
  last_updated: string;
}

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  url: string;
  permalink: string;
  subreddit: string;
}

interface SentimentResponse {
  data: SentimentDataPoint[];
  topPosts?: RedditPost[];
  sources: string[];
  lastUpdated: string;
  fromCache: boolean;
  cacheAge?: string;
}

export type SentimentSource = 'reddit' | 'twitter' | 'all';
export type SentimentTimeframe = '24h' | '7d' | '30d';

export function useSentimentData(
  source: SentimentSource = 'all',
  timeframe: SentimentTimeframe = '24h'
) {
  return useQuery<SentimentResponse>({
    queryKey: ['sentiment-data', source, timeframe],
    queryFn: async () => {
      const params = new URLSearchParams({
        source,
        timeframe
      });
      
      const response = await fetch(`/api/sentiment-data?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch sentiment data');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 30, // 30 minutes (data updated daily by cron)
    refetchOnWindowFocus: false,
  });
}



// Specialized hooks for different use cases
export function useRedditSentiment(timeframe: SentimentTimeframe = '24h') {
  return useSentimentData('reddit', timeframe);
}

export function useTwitterSentiment(timeframe: SentimentTimeframe = '24h') {
  return useSentimentData('twitter', timeframe);
}

export function useTopSentimentTickers(
  limit: number = 10,
  source: SentimentSource = 'all',
  timeframe: SentimentTimeframe = '24h'
) {
  const { data, ...rest } = useSentimentData(source, timeframe);
  
  const topTickers = data?.data
    .sort((a, b) => {
      // Sort by sentiment score first, then by mention count
      if (Math.abs(a.sentiment_score - b.sentiment_score) > 0.1) {
        return b.sentiment_score - a.sentiment_score;
      }
      return b.mention_count - a.mention_count;
    })
    .slice(0, limit);

  return {
    data: topTickers ? { ...data, data: topTickers } : data,
    ...rest
  };
}

export function useMostMentionedTickers(
  limit: number = 10,
  source: SentimentSource = 'all',
  timeframe: SentimentTimeframe = '24h'
) {
  const { data, ...rest } = useSentimentData(source, timeframe);
  
  const mostMentioned = data?.data
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, limit);

  return {
    data: mostMentioned ? { ...data, data: mostMentioned } : data,
    ...rest
  };
}

export function useBullishTickers(
  limit: number = 10,
  source: SentimentSource = 'all',
  timeframe: SentimentTimeframe = '24h'
) {
  const { data, ...rest } = useSentimentData(source, timeframe);
  
  const bullishTickers = data?.data
    .filter(ticker => ticker.sentiment_score > 0.1)
    .sort((a, b) => b.sentiment_score - a.sentiment_score)
    .slice(0, limit);

  return {
    data: bullishTickers ? { ...data, data: bullishTickers } : data,
    ...rest
  };
}

export function useBearishTickers(
  limit: number = 10,
  source: SentimentSource = 'all',
  timeframe: SentimentTimeframe = '24h'
) {
  const { data, ...rest } = useSentimentData(source, timeframe);
  
  const bearishTickers = data?.data
    .filter(ticker => ticker.sentiment_score < -0.1)
    .sort((a, b) => a.sentiment_score - b.sentiment_score)
    .slice(0, limit);

  return {
    data: bearishTickers ? { ...data, data: bearishTickers } : data,
    ...rest
  };
}

// Helper function to get sentiment color for UI
export function getSentimentColor(sentimentScore: number): string {
  if (sentimentScore > 0.3) return 'text-green-600';
  if (sentimentScore > 0.1) return 'text-green-500';
  if (sentimentScore < -0.3) return 'text-red-600';
  if (sentimentScore < -0.1) return 'text-red-500';
  return 'text-gray-500';
}

// Helper function to get sentiment emoji
export function getSentimentEmoji(sentimentScore: number): string {
  if (sentimentScore > 0.5) return '🚀';
  if (sentimentScore > 0.2) return '📈';
  if (sentimentScore > 0) return '👍';
  if (sentimentScore < -0.5) return '💥';
  if (sentimentScore < -0.2) return '📉';
  if (sentimentScore < 0) return '👎';
  return '😐';
}

// Helper function to format sentiment score
export function formatSentimentScore(score: number): string {
  return (score * 100).toFixed(1) + '%';
}

// Hook to refresh sentiment data
export function useRefreshSentimentData(
  source: SentimentSource = 'all',
  timeframe: SentimentTimeframe = '24h'
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      console.log('🔄 Refreshing sentiment data...');
      
      const response = await fetch('/api/cron/sentiment-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer R+4asd5JITElFBC59X/jsMkJEkOcq30B7a72i1vlkFg=`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Sentiment refresh completed:', data);
      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch sentiment data queries
      queryClient.invalidateQueries({ queryKey: ['sentiment-data'] });
      console.log('🔄 Sentiment data cache invalidated');
    },
    onError: (error) => {
      console.error('❌ Sentiment refresh failed:', error);
    }
  });
}
