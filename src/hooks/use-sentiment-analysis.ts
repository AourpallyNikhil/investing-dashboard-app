import { useQuery } from '@tanstack/react-query';
import { SentimentFilters } from '@/components/ui/sentiment-filters';

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

interface SentimentAnalysisResponse {
  data: SentimentDataPoint[];
  totalCount: number;
  availableThemes: string[];
  mentionCountMax: number;
  filters: SentimentFilters;
  fromCache: boolean;
}

export function useSentimentAnalysis(filters: SentimentFilters, page: number = 1, pageSize: number = 25) {
  return useQuery({
    queryKey: ['sentiment-analysis', filters, page, pageSize],
    queryFn: async (): Promise<SentimentAnalysisResponse> => {
      const searchParams = new URLSearchParams({
        sentimentType: filters.sentimentType,
        source: filters.source,
        timeframe: filters.timeframe,
        tickerSearch: filters.tickerSearch,
        mentionCountMin: filters.mentionCountRange[0].toString(),
        mentionCountMax: filters.mentionCountRange[1].toString(),
        confidenceMin: filters.confidenceRange[0].toString(),
        confidenceMax: filters.confidenceRange[1].toString(),
        sentimentScoreMin: filters.sentimentScoreRange[0].toString(),
        sentimentScoreMax: filters.sentimentScoreRange[1].toString(),
        keyThemes: filters.keyThemes.join(','),
        hasSummary: filters.hasSummary?.toString() || '',
        sortBy: filters.sortBy,
        sortDirection: filters.sortDirection,
        page: page.toString(),
        pageSize: pageSize.toString()
      });

      const response = await fetch(`/api/sentiment-analysis?${searchParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch sentiment analysis data');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}















