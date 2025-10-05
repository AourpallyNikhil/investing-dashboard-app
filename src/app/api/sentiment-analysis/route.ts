import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );
}

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
  filters: {
    sentimentType: string;
    source: string;
    timeframe: string;
    tickerSearch: string;
    mentionCountRange: [number, number];
    confidenceRange: [number, number];
    sentimentScoreRange: [number, number];
    keyThemes: string[];
    hasSummary: boolean | null;
    sortBy: string;
    sortDirection: string;
  };
  fromCache: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract filters from query parameters
    const sentimentType = searchParams.get('sentimentType') || 'all';
    const source = searchParams.get('source') || 'all';
    const timeframe = searchParams.get('timeframe') || '24h';
    const tickerSearch = searchParams.get('tickerSearch') || '';
    const mentionCountMin = parseInt(searchParams.get('mentionCountMin') || '1');
    const mentionCountMax = parseInt(searchParams.get('mentionCountMax') || '1000');
    const confidenceMin = parseFloat(searchParams.get('confidenceMin') || '0.0');
    const confidenceMax = parseFloat(searchParams.get('confidenceMax') || '1.0');
    const sentimentScoreMin = parseFloat(searchParams.get('sentimentScoreMin') || '-1.0');
    const sentimentScoreMax = parseFloat(searchParams.get('sentimentScoreMax') || '1.0');
    const keyThemes = searchParams.get('keyThemes')?.split(',').filter(Boolean) || [];
    const hasSummary = searchParams.get('hasSummary') === 'true' ? true : searchParams.get('hasSummary') === 'false' ? false : null;
    const sortBy = searchParams.get('sortBy') || 'mentions';
    const sortDirection = searchParams.get('sortDirection') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '25');

    console.log('🔍 [API] Sentiment analysis request:', {
      sentimentType, source, timeframe, tickerSearch, 
      mentionCountRange: [mentionCountMin, mentionCountMax],
      confidenceRange: [confidenceMin, confidenceMax],
      sentimentScoreRange: [sentimentScoreMin, sentimentScoreMax],
      keyThemes, hasSummary, sortBy, sortDirection, page, pageSize
    });

    const supabase = getSupabaseClient();
    
    // Calculate the date range based on timeframe
    const cutoffDate = new Date();
    switch (timeframe) {
      case '1h':
        cutoffDate.setHours(cutoffDate.getHours() - 1);
        break;
      case '6h':
        cutoffDate.setHours(cutoffDate.getHours() - 6);
        break;
      case '24h':
        cutoffDate.setHours(cutoffDate.getHours() - 24);
        break;
      case '3d':
        cutoffDate.setDate(cutoffDate.getDate() - 3);
        break;
      case '7d':
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        break;
      default:
        cutoffDate.setHours(cutoffDate.getHours() - 24);
    }

    // Build query for sentiment data
    // First try sentiment_aggregations if timeframe matches available periods
    let query;
    let useAggregatedData = false;
    
    // Check if we have aggregated data for this timeframe
    const { data: availablePeriods } = await supabase
      .from('sentiment_aggregations')
      .select('aggregation_period')
      .eq('aggregation_period', timeframe)
      .limit(1);
    
    if (availablePeriods && availablePeriods.length > 0) {
      // Use aggregated data
      useAggregatedData = true;
      console.log(`📊 Using aggregated data for timeframe: ${timeframe}`);
      query = supabase
        .from('sentiment_aggregations')
        .select('*', { count: 'exact' })
        .eq('aggregation_period', timeframe)
        .neq('ticker', 'GENERAL')
        .gte('calculated_at', cutoffDate.toISOString());
    } else {
      // Fall back to sentiment_data table - we'll aggregate manually
      console.log(`📊 Using regular sentiment_data for timeframe: ${timeframe} (no aggregated data available)`);
      query = supabase
        .from('sentiment_data')
        .select('*')
        .gte('created_at', cutoffDate.toISOString());
    }

    // Apply filters
    if (tickerSearch) {
      query = query.ilike('ticker', `%${tickerSearch}%`);
    }

    // Apply filters based on data source
    if (useAggregatedData) {
      // Filters for aggregated data
      if (mentionCountMin > 1 || mentionCountMax < 1000) {
        query = query.gte('total_mentions', mentionCountMin).lte('total_mentions', mentionCountMax);
      }

      // Apply sentiment type filter
      if (sentimentType !== 'all') {
        switch (sentimentType) {
          case 'bullish':
            query = query.gt('avg_sentiment', 0.1);
            break;
          case 'bearish':
            query = query.lt('avg_sentiment', -0.1);
            break;
          case 'neutral':
            query = query.gte('avg_sentiment', -0.1).lte('avg_sentiment', 0.1);
            break;
        }
      }

      // Apply sentiment score range filter
      if (sentimentScoreMin > -1 || sentimentScoreMax < 1) {
        query = query.gte('avg_sentiment', sentimentScoreMin).lte('avg_sentiment', sentimentScoreMax);
      }
    } else {
      // Filters for regular sentiment data
      if (mentionCountMin > 1 || mentionCountMax < 1000) {
        query = query.gte('mention_count', mentionCountMin).lte('mention_count', mentionCountMax);
      }

      // Apply sentiment type filter
      if (sentimentType !== 'all') {
        const sentimentLabel = sentimentType === 'bullish' ? 'positive' : 
                              sentimentType === 'bearish' ? 'negative' : 'neutral';
        query = query.eq('sentiment_label', sentimentLabel);
      }

      // Apply sentiment score range filter
      if (sentimentScoreMin > -1 || sentimentScoreMax < 1) {
        query = query.gte('sentiment_score', sentimentScoreMin).lte('sentiment_score', sentimentScoreMax);
      }

      // Apply confidence filter
      if (confidenceMin > 0 || confidenceMax < 1) {
        query = query.gte('confidence', confidenceMin).lte('confidence', confidenceMax);
      }

      // Apply summary filter
      if (hasSummary !== null) {
        if (hasSummary) {
          query = query.not('summary', 'is', null).neq('summary', '');
        } else {
          query = query.or('summary.is.null,summary.eq.');
        }
      }
    }

    // Apply source filter (this would need to be implemented in the aggregation logic)
    // For now, we'll handle this in post-processing if needed

    // Apply sorting
    let sortField;
    if (useAggregatedData) {
      sortField = sortBy === 'mentions' ? 'total_mentions' : 
                  sortBy === 'sentiment' ? 'avg_sentiment' :
                  sortBy === 'confidence' ? 'avg_confidence' :
                  sortBy === 'updated' ? 'calculated_at' :
                  sortBy === 'alphabetical' ? 'ticker' : 'total_mentions';
    } else {
      sortField = sortBy === 'mentions' ? 'mention_count' : 
                  sortBy === 'sentiment' ? 'sentiment_score' :
                  sortBy === 'confidence' ? 'confidence' :
                  sortBy === 'updated' ? 'last_updated' :
                  sortBy === 'alphabetical' ? 'ticker' : 'mention_count';
    }
    
    query = query.order(sortField, { ascending: sortDirection === 'asc' });

    // Execute query - for regular sentiment_data, we need to get all data first to aggregate
    let sentimentData, sentimentError, count;
    
    if (useAggregatedData) {
      // For aggregated data, we can use pagination directly
      const result = await query.range((page - 1) * pageSize, page * pageSize - 1);
      sentimentData = result.data;
      sentimentError = result.error;
      count = result.count;
    } else {
      // For regular sentiment_data, get all data first (we'll aggregate and paginate later)
      const result = await query;
      sentimentData = result.data;
      sentimentError = result.error;
      count = null; // We'll calculate this after aggregation
    }

    if (sentimentError) {
      console.error('❌ Error querying sentiment data:', sentimentError);
      
      // Fallback to old sentiment_data table
      let fallbackQuery = supabase
        .from('sentiment_data')
        .select('*', { count: 'exact' })
        .gte('created_at', cutoffDate.toISOString());

      if (tickerSearch) {
        fallbackQuery = fallbackQuery.ilike('ticker', `%${tickerSearch}%`);
      }

      if (sentimentType !== 'all') {
        fallbackQuery = fallbackQuery.eq('sentiment_label', 
          sentimentType === 'bullish' ? 'positive' : 
          sentimentType === 'bearish' ? 'negative' : 'neutral');
      }

      if (mentionCountMin > 1 || mentionCountMax < 1000) {
        fallbackQuery = fallbackQuery.gte('mention_count', mentionCountMin).lte('mention_count', mentionCountMax);
      }

      if (confidenceMin > 0 || confidenceMax < 1) {
        fallbackQuery = fallbackQuery.gte('confidence', confidenceMin).lte('confidence', confidenceMax);
      }

      if (sentimentScoreMin > -1 || sentimentScoreMax < 1) {
        fallbackQuery = fallbackQuery.gte('sentiment_score', sentimentScoreMin).lte('sentiment_score', sentimentScoreMax);
      }

      if (hasSummary !== null) {
        if (hasSummary) {
          fallbackQuery = fallbackQuery.not('summary', 'is', null).neq('summary', '');
        } else {
          fallbackQuery = fallbackQuery.or('summary.is.null,summary.eq.');
        }
      }

      const fallbackSortField = sortBy === 'mentions' ? 'mention_count' : 
                               sortBy === 'sentiment' ? 'sentiment_score' :
                               sortBy === 'confidence' ? 'confidence' :
                               sortBy === 'updated' ? 'last_updated' :
                               sortBy === 'alphabetical' ? 'ticker' : 'mention_count';
      
      fallbackQuery = fallbackQuery.order(fallbackSortField, { ascending: sortDirection === 'asc' });

      const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (fallbackError) {
        throw fallbackError;
      }

      // Transform fallback data
      const transformedData = (fallbackData || []).map(item => ({
        ticker: item.ticker,
        sentiment_score: parseFloat(item.sentiment_score),
        sentiment_label: item.sentiment_label,
        mention_count: item.mention_count,
        confidence: parseFloat(item.confidence || '0.8'),
        key_themes: item.key_themes || [],
        summary: item.summary || '',
        source_breakdown: item.source_breakdown || {
          reddit: { mentions: 0, avg_sentiment: 0 },
          twitter: { mentions: 0, avg_sentiment: 0 }
        },
        trending_contexts: item.trending_contexts || [],
        last_updated: item.last_updated || item.created_at
      }));

      // Get available themes for filters
      const allThemes = transformedData.flatMap(item => item.key_themes || []);
      const availableThemes = [...new Set(allThemes)].sort();
      
      // Get max mention count for slider
      const mentionCounts = transformedData.map(item => item.mention_count);
      const maxMentionCount = Math.max(...mentionCounts, 100);

      return NextResponse.json({
        data: transformedData,
        totalCount: fallbackCount || 0,
        availableThemes,
        mentionCountMax: maxMentionCount,
        filters: {
          sentimentType, source, timeframe, tickerSearch,
          mentionCountRange: [mentionCountMin, mentionCountMax],
          confidenceRange: [confidenceMin, confidenceMax],
          sentimentScoreRange: [sentimentScoreMin, sentimentScoreMax],
          keyThemes, hasSummary, sortBy, sortDirection
        },
        fromCache: true
      });
    }

    // Transform data to match expected format
    let transformedData;
    
    if (useAggregatedData) {
      // Transform aggregated data
      transformedData = (sentimentData || []).map(agg => ({
        ticker: agg.ticker,
        sentiment_score: agg.avg_sentiment || 0.0,
        sentiment_label: agg.avg_sentiment > 0.1 ? 'positive' as const : 
                        agg.avg_sentiment < -0.1 ? 'negative' as const : 'neutral' as const,
        mention_count: agg.total_mentions,
        confidence: agg.avg_confidence || 0.85, // Use actual confidence if available
        key_themes: agg.top_themes || ['Aggregated Analysis'], // Use actual themes if available
        summary: `${agg.total_mentions} mentions from ${agg.unique_posts} posts by ${agg.unique_authors} unique authors`,
        source_breakdown: agg.source_breakdown || {
          reddit: { mentions: 0, avg_sentiment: 0 },
          twitter: { mentions: 0, avg_sentiment: 0 }
        },
        trending_contexts: [`${agg.total_upvotes || 0} total upvotes`, `${agg.total_comments || 0} total comments`],
        last_updated: agg.calculated_at
      }));
    } else {
      // Aggregate regular sentiment data by ticker
      const tickerMap = new Map();
      
      (sentimentData || []).forEach(item => {
        const ticker = item.ticker;
        
        if (!tickerMap.has(ticker)) {
          tickerMap.set(ticker, {
            ticker,
            entries: [],
            total_mentions: 0,
            sentiment_scores: [],
            confidences: [],
            all_themes: [],
            all_contexts: [],
            source_breakdown: { reddit: { mentions: 0, sentiment_sum: 0 }, twitter: { mentions: 0, sentiment_sum: 0 } },
            latest_date: item.created_at || item.last_updated
          });
        }
        
        const tickerData = tickerMap.get(ticker);
        tickerData.entries.push(item);
        tickerData.total_mentions += item.mention_count || 0;
        tickerData.sentiment_scores.push(parseFloat(item.sentiment_score));
        tickerData.confidences.push(parseFloat(item.confidence || '0.8'));
        
        // Aggregate themes
        if (item.key_themes && Array.isArray(item.key_themes)) {
          tickerData.all_themes.push(...item.key_themes);
        }
        
        // Aggregate contexts
        if (item.trending_contexts && Array.isArray(item.trending_contexts)) {
          tickerData.all_contexts.push(...item.trending_contexts);
        }
        
        // Aggregate source breakdown
        if (item.source_breakdown) {
          if (item.source_breakdown.reddit) {
            tickerData.source_breakdown.reddit.mentions += item.source_breakdown.reddit.mentions || 0;
            tickerData.source_breakdown.reddit.sentiment_sum += (item.source_breakdown.reddit.avg_sentiment || 0) * (item.source_breakdown.reddit.mentions || 0);
          }
          if (item.source_breakdown.twitter) {
            tickerData.source_breakdown.twitter.mentions += item.source_breakdown.twitter.mentions || 0;
            tickerData.source_breakdown.twitter.sentiment_sum += (item.source_breakdown.twitter.avg_sentiment || 0) * (item.source_breakdown.twitter.mentions || 0);
          }
        }
        
        // Keep latest date
        if (item.created_at > tickerData.latest_date) {
          tickerData.latest_date = item.created_at;
        }
      });
      
      // Transform aggregated data
      transformedData = Array.from(tickerMap.values()).map(tickerData => {
        const avgSentiment = tickerData.sentiment_scores.length > 0 
          ? tickerData.sentiment_scores.reduce((sum, score) => sum + score, 0) / tickerData.sentiment_scores.length 
          : 0;
        
        const avgConfidence = tickerData.confidences.length > 0 
          ? tickerData.confidences.reduce((sum, conf) => sum + conf, 0) / tickerData.confidences.length 
          : 0.8;
        
        // Get unique themes (top 5)
        const uniqueThemes = [...new Set(tickerData.all_themes)].slice(0, 5);
        
        // Get unique contexts (top 3)
        const uniqueContexts = [...new Set(tickerData.all_contexts)].slice(0, 3);
        
        // Calculate average sentiment for each source
        const redditAvgSentiment = tickerData.source_breakdown.reddit.mentions > 0 
          ? tickerData.source_breakdown.reddit.sentiment_sum / tickerData.source_breakdown.reddit.mentions 
          : 0;
        const twitterAvgSentiment = tickerData.source_breakdown.twitter.mentions > 0 
          ? tickerData.source_breakdown.twitter.sentiment_sum / tickerData.source_breakdown.twitter.mentions 
          : 0;
        
        return {
          ticker: tickerData.ticker,
          sentiment_score: Math.round(avgSentiment * 1000) / 1000,
          sentiment_label: avgSentiment > 0.1 ? 'positive' as const : 
                          avgSentiment < -0.1 ? 'negative' as const : 'neutral' as const,
          mention_count: tickerData.total_mentions,
          confidence: Math.round(avgConfidence * 100) / 100,
          key_themes: uniqueThemes,
          summary: `Aggregated from ${tickerData.entries.length} sentiment entries`,
          source_breakdown: {
            reddit: { 
              mentions: tickerData.source_breakdown.reddit.mentions, 
              avg_sentiment: Math.round(redditAvgSentiment * 1000) / 1000 
            },
            twitter: { 
              mentions: tickerData.source_breakdown.twitter.mentions, 
              avg_sentiment: Math.round(twitterAvgSentiment * 1000) / 1000 
            }
          },
          trending_contexts: uniqueContexts,
          last_updated: tickerData.latest_date
        };
      });
      
      // Update count after aggregation
      count = transformedData.length;
    }

    // Post-process filters that couldn't be applied at database level
    let filteredData = transformedData;

    // Apply confidence filter (using fixed 0.85 for aggregated data)
    if (confidenceMin > 0 || confidenceMax < 1) {
      filteredData = filteredData.filter(item => 
        (item.confidence || 0.85) >= confidenceMin && (item.confidence || 0.85) <= confidenceMax
      );
    }

    // Apply key themes filter
    if (keyThemes.length > 0) {
      filteredData = filteredData.filter(item =>
        keyThemes.some(theme => (item.key_themes || []).includes(theme))
      );
    }

    // Apply summary filter
    if (hasSummary !== null) {
      filteredData = filteredData.filter(item => {
        const hasSummaryValue = item.summary && item.summary.trim() !== '';
        return hasSummary ? hasSummaryValue : !hasSummaryValue;
      });
    }

    // Apply source filter (basic implementation)
    if (source !== 'all') {
      filteredData = filteredData.filter(item => {
        const breakdown = item.source_breakdown;
        if (source === 'reddit') return breakdown.reddit.mentions > 0;
        if (source === 'twitter') return breakdown.twitter.mentions > 0;
        if (source === 'both') return breakdown.reddit.mentions > 0 && breakdown.twitter.mentions > 0;
        return true;
      });
    }

    // Apply sorting for non-aggregated data (aggregated data is already sorted by the query)
    if (!useAggregatedData) {
      filteredData.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
          case 'mentions':
            aValue = a.mention_count;
            bValue = b.mention_count;
            break;
          case 'sentiment':
            aValue = a.sentiment_score;
            bValue = b.sentiment_score;
            break;
          case 'confidence':
            aValue = a.confidence;
            bValue = b.confidence;
            break;
          case 'updated':
            aValue = new Date(a.last_updated).getTime();
            bValue = new Date(b.last_updated).getTime();
            break;
          case 'alphabetical':
            aValue = a.ticker.toLowerCase();
            bValue = b.ticker.toLowerCase();
            break;
          default:
            aValue = a.mention_count;
            bValue = b.mention_count;
        }
        
        if (sortDirection === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
    }

    // Apply pagination for non-aggregated data
    let paginatedData = filteredData;
    if (!useAggregatedData) {
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      paginatedData = filteredData.slice(startIndex, endIndex);
      count = filteredData.length; // Update count with filtered data length
    } else {
      paginatedData = filteredData; // Aggregated data is already paginated
    }

    // Get available themes for filters (from all data, not just current page)
    const allThemesQuery = await supabase
      .from('sentiment_data')
      .select('key_themes')
      .gte('created_at', cutoffDate.toISOString())
      .limit(1000);

    const allThemes = (allThemesQuery.data || [])
      .flatMap(item => item.key_themes || [])
      .filter(Boolean);
    const availableThemes = [...new Set(allThemes)].sort().slice(0, 20); // Limit to top 20 themes

    // Get max mention count for slider
    const mentionCounts = transformedData.map(item => item.mention_count);
    const maxMentionCount = Math.max(...mentionCounts, 100);

    console.log(`✅ Found ${paginatedData.length} sentiment records (total: ${count}) using ${useAggregatedData ? 'aggregated' : 'regular'} data for timeframe: ${timeframe}`);

    return NextResponse.json({
      data: paginatedData,
      totalCount: count || 0,
      availableThemes,
      mentionCountMax: maxMentionCount,
      filters: {
        sentimentType, source, timeframe, tickerSearch,
        mentionCountRange: [mentionCountMin, mentionCountMax],
        confidenceRange: [confidenceMin, confidenceMax],
        sentimentScoreRange: [sentimentScoreMin, sentimentScoreMax],
        keyThemes, hasSummary, sortBy, sortDirection
      },
      fromCache: true
    } as SentimentAnalysisResponse);

  } catch (error) {
    console.error('❌ Error in sentiment analysis API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sentiment analysis data' },
      { status: 500 }
    );
  }
}
