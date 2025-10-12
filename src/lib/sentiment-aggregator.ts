/**
 * Advanced sentiment aggregation utilities
 * Provides different strategies for aggregating sentiment data over time periods
 * Compatible with GPT-4o-mini processed sentiment data via OpenAI Responses API with structured outputs
 */

interface SentimentEntry {
  ticker: string;
  sentiment_score: number;
  mention_count: number;
  confidence: number;
  created_at: string;
  source: 'reddit' | 'twitter';
  key_themes?: string[];
}

interface AggregatedSentiment {
  ticker: string;
  sentiment_score: number;
  sentiment_label: 'positive' | 'negative' | 'neutral';
  mention_count: number;
  confidence: number;
  entry_count: number;
  key_themes: string[];
  source_breakdown: {
    reddit: { mentions: number; avg_sentiment: number };
    twitter: { mentions: number; avg_sentiment: number };
  };
  time_range: {
    start: string;
    end: string;
    hours: number;
  };
  aggregation_method: string;
}

export type AggregationStrategy = 
  | 'simple_average'
  | 'mention_weighted'
  | 'confidence_weighted' 
  | 'time_decay_weighted'
  | 'hybrid';

export class SentimentAggregator {
  
  /**
   * Aggregate sentiment entries for a ticker over a time period
   */
  static aggregateByTicker(
    entries: SentimentEntry[], 
    strategy: AggregationStrategy = 'hybrid'
  ): Map<string, AggregatedSentiment> {
    
    const tickerMap = new Map<string, SentimentEntry[]>();
    
    // Group entries by ticker
    entries.forEach(entry => {
      if (!tickerMap.has(entry.ticker)) {
        tickerMap.set(entry.ticker, []);
      }
      tickerMap.get(entry.ticker)!.push(entry);
    });
    
    // Aggregate each ticker
    const results = new Map<string, AggregatedSentiment>();
    
    for (const [ticker, tickerEntries] of tickerMap) {
      const aggregated = this.aggregateTickerEntries(tickerEntries, strategy);
      results.set(ticker, aggregated);
    }
    
    return results;
  }
  
  /**
   * Aggregate multiple entries for a single ticker
   */
  private static aggregateTickerEntries(
    entries: SentimentEntry[], 
    strategy: AggregationStrategy
  ): AggregatedSentiment {
    
    if (entries.length === 0) {
      throw new Error('No entries to aggregate');
    }
    
    const ticker = entries[0].ticker;
    const now = new Date();
    const dates = entries.map(e => new Date(e.created_at));
    const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const endDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    
    // Calculate aggregated sentiment based on strategy
    let aggregatedSentiment: number;
    
    switch (strategy) {
      case 'simple_average':
        aggregatedSentiment = this.simpleAverage(entries);
        break;
        
      case 'mention_weighted':
        aggregatedSentiment = this.mentionWeighted(entries);
        break;
        
      case 'confidence_weighted':
        aggregatedSentiment = this.confidenceWeighted(entries);
        break;
        
      case 'time_decay_weighted':
        aggregatedSentiment = this.timeDecayWeighted(entries, now);
        break;
        
      case 'hybrid':
        aggregatedSentiment = this.hybridWeighted(entries, now);
        break;
        
      default:
        aggregatedSentiment = this.simpleAverage(entries);
    }
    
    // Calculate other aggregated metrics
    const totalMentions = entries.reduce((sum, e) => sum + e.mention_count, 0);
    const avgConfidence = entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length;
    const allThemes = [...new Set(entries.flatMap(e => e.key_themes || []))];
    
    // Source breakdown
    const redditEntries = entries.filter(e => e.source === 'reddit');
    const twitterEntries = entries.filter(e => e.source === 'twitter');
    
    const redditMentions = redditEntries.reduce((sum, e) => sum + e.mention_count, 0);
    const twitterMentions = twitterEntries.reduce((sum, e) => sum + e.mention_count, 0);
    
    const redditSentiment = redditEntries.length > 0 
      ? redditEntries.reduce((sum, e) => sum + e.sentiment_score, 0) / redditEntries.length 
      : 0;
    const twitterSentiment = twitterEntries.length > 0 
      ? twitterEntries.reduce((sum, e) => sum + e.sentiment_score, 0) / twitterEntries.length 
      : 0;
    
    return {
      ticker,
      sentiment_score: Math.round(aggregatedSentiment * 1000) / 1000,
      sentiment_label: aggregatedSentiment > 0.1 ? 'positive' : 
                      aggregatedSentiment < -0.1 ? 'negative' : 'neutral',
      mention_count: totalMentions,
      confidence: Math.round(avgConfidence * 100) / 100,
      entry_count: entries.length,
      key_themes: allThemes.slice(0, 10), // Top 10 themes
      source_breakdown: {
        reddit: { mentions: redditMentions, avg_sentiment: Math.round(redditSentiment * 1000) / 1000 },
        twitter: { mentions: twitterMentions, avg_sentiment: Math.round(twitterSentiment * 1000) / 1000 }
      },
      time_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        hours: Math.round(hours * 100) / 100
      },
      aggregation_method: strategy
    };
  }
  
  /**
   * Simple average of all sentiment scores
   */
  private static simpleAverage(entries: SentimentEntry[]): number {
    return entries.reduce((sum, e) => sum + e.sentiment_score, 0) / entries.length;
  }
  
  /**
   * Weighted by mention count - entries with more mentions have more influence
   */
  private static mentionWeighted(entries: SentimentEntry[]): number {
    const totalMentions = entries.reduce((sum, e) => sum + e.mention_count, 0);
    return entries.reduce((sum, e) => 
      sum + (e.sentiment_score * e.mention_count), 0
    ) / totalMentions;
  }
  
  /**
   * Weighted by confidence - more confident entries have more influence
   */
  private static confidenceWeighted(entries: SentimentEntry[]): number {
    const totalConfidence = entries.reduce((sum, e) => sum + e.confidence, 0);
    return entries.reduce((sum, e) => 
      sum + (e.sentiment_score * e.confidence), 0
    ) / totalConfidence;
  }
  
  /**
   * Time decay weighted - newer entries have more influence
   */
  private static timeDecayWeighted(entries: SentimentEntry[], now: Date): number {
    let totalWeight = 0;
    let weightedSum = 0;
    
    entries.forEach(entry => {
      const ageHours = (now.getTime() - new Date(entry.created_at).getTime()) / (1000 * 60 * 60);
      const weight = Math.exp(-ageHours / 24); // Decay over 24 hours
      
      weightedSum += entry.sentiment_score * weight;
      totalWeight += weight;
    });
    
    return weightedSum / totalWeight;
  }
  
  /**
   * Hybrid approach - combines mention count, confidence, and time decay
   */
  private static hybridWeighted(entries: SentimentEntry[], now: Date): number {
    let totalWeight = 0;
    let weightedSum = 0;
    
    entries.forEach(entry => {
      const ageHours = (now.getTime() - new Date(entry.created_at).getTime()) / (1000 * 60 * 60);
      const timeWeight = Math.exp(-ageHours / 48); // Slower decay over 48 hours
      const mentionWeight = Math.log(entry.mention_count + 1); // Log scale for mentions
      const confidenceWeight = entry.confidence;
      
      const combinedWeight = timeWeight * mentionWeight * confidenceWeight;
      
      weightedSum += entry.sentiment_score * combinedWeight;
      totalWeight += combinedWeight;
    });
    
    return weightedSum / totalWeight;
  }
  
  /**
   * Get sentiment trend over time (requires entries to be sorted by date)
   */
  static getSentimentTrend(entries: SentimentEntry[]): 'rising' | 'falling' | 'stable' {
    if (entries.length < 2) return 'stable';
    
    const sortedEntries = [...entries].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    const firstHalf = sortedEntries.slice(0, Math.floor(sortedEntries.length / 2));
    const secondHalf = sortedEntries.slice(Math.floor(sortedEntries.length / 2));
    
    const firstAvg = this.simpleAverage(firstHalf);
    const secondAvg = this.simpleAverage(secondHalf);
    
    const difference = secondAvg - firstAvg;
    
    if (difference > 0.1) return 'rising';
    if (difference < -0.1) return 'falling';
    return 'stable';
  }
}








