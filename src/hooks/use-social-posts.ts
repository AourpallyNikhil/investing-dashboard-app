import { useQuery } from '@tanstack/react-query';

interface UnifiedPost {
  id: string;
  source: 'twitter' | 'reddit';
  content: string;
  title?: string;
  author: string;
  created_at: string;
  url: string;
  
  // Engagement metrics
  engagement_score: number;
  engagement_details: {
    likes?: number;
    retweets?: number;
    replies?: number;
    score?: number;
    comments?: number;
  };
  
  // LLM Analysis
  llm_ticker?: string;
  llm_actionability_score?: number;
  llm_sentiment_score?: number;
  llm_confidence?: number;
  llm_has_catalyst?: boolean;
  llm_key_themes?: string[];
  
  // Platform-specific
  platform_data: {
    subreddit?: string;
    hashtags?: string[];
    follower_count?: number;
  };
}

interface SocialPostsResponse {
  posts: UnifiedPost[];
  count: number;
  breakdown: {
    twitter: number;
    reddit: number;
  };
  filters: {
    source: string;
    hours: number;
    actionability: number;
    sentiment: string;
    confidence: number;
    ticker?: string;
  };
}

interface SocialPostsFilters {
  source?: 'all' | 'twitter' | 'reddit';
  hours?: number;
  actionability?: number;
  sentiment?: 'all' | 'positive' | 'negative' | 'neutral';
  confidence?: number;
  limit?: number;
  ticker?: string;
}

export function useSocialPosts(filters: SocialPostsFilters = {}) {
  const {
    source = 'all',
    hours = 168, // Default to 7 days to capture Reddit posts
    actionability = 0.0,
    sentiment = 'all',
    confidence = 0.0, // Don't filter by confidence by default
    limit = 50,
    ticker
  } = filters;

  return useQuery({
    queryKey: ['social-posts', source, hours, actionability, sentiment, confidence, limit, ticker],
    queryFn: async (): Promise<SocialPostsResponse> => {
      const params = new URLSearchParams({
        source,
        hours: hours.toString(),
        actionability: actionability.toString(),
        sentiment,
        confidence: confidence.toString(),
        limit: limit.toString(),
      });
      
      if (ticker) {
        params.append('ticker', ticker);
      }

      const response = await fetch(`/api/social-posts?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch social posts: ${response.statusText}`);
      }
      
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}

// Convenience hooks for specific sources
export function useTwitterPosts(filters: Omit<SocialPostsFilters, 'source'> = {}) {
  return useSocialPosts({ ...filters, source: 'twitter' });
}

export function useRedditPosts(filters: Omit<SocialPostsFilters, 'source'> = {}) {
  return useSocialPosts({ ...filters, source: 'reddit' });
}

// Hook for actionable posts only
export function useActionablePosts(filters: SocialPostsFilters = {}) {
  return useSocialPosts({
    ...filters,
    actionability: Math.max(filters.actionability || 0.3, 0.3), // Minimum 0.3 actionability
    confidence: Math.max(filters.confidence || 0.5, 0.5), // Minimum 0.5 confidence
  });
}
