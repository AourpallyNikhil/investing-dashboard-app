/**
 * Real-time Aggregation Service
 * Updates aggregations immediately when LLM-analyzed posts are saved
 */

import { createClient } from '@supabase/supabase-js'

// Lazy initialization of Supabase client to avoid issues when env vars aren't loaded yet
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Missing Supabase environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

/**
 * Update aggregation for a specific ticker immediately
 */
export async function updateTickerAggregation(ticker: string): Promise<void> {
  try {
    console.log(`🔄 [REAL-TIME] Updating aggregation for ticker: ${ticker}`)
    
    const { data, error } = await getSupabaseClient().rpc('update_sentiment_aggregation_for_ticker', {
      p_ticker: ticker
    })
    
    if (error) {
      console.error(`❌ [REAL-TIME] Error updating ${ticker} aggregation:`, error)
    } else {
      console.log(`✅ [REAL-TIME] Updated ${ticker} aggregation successfully`)
    }
  } catch (error) {
    console.error(`❌ [REAL-TIME] Exception updating ${ticker} aggregation:`, error)
  }
}

/**
 * Enhanced save function that triggers real-time aggregation
 */
export async function savePostWithRealTimeAggregation(
  post: any, 
  analysis: any, 
  source: 'reddit' | 'twitter'
): Promise<void> {
  try {
    // Step 1: Save the post with LLM analysis
    const tableName = source === 'reddit' ? 'reddit_posts_raw' : 'twitter_posts_raw'
    
    // Filter post data to only include fields that exist in the schema
    const basePost = source === 'reddit' ? {
      post_id: post.id,
      title: post.title,
      selftext: post.selftext || '',
      author: post.author,
      subreddit: post.subreddit,
      score: post.score || 0,
      num_comments: post.num_comments || 0,
      created_utc: post.created_utc,
      url: post.url,
      permalink: post.permalink,
      is_self: post.is_self || false,
      domain: post.domain || null
    } : post // For Twitter, use the full post object

    const enhancedPost = {
      ...basePost,
      llm_ticker: analysis.ticker,
      llm_sentiment_score: analysis.sentiment_score,
      llm_sentiment_label: analysis.sentiment_label,
      llm_confidence: analysis.confidence,
      llm_key_themes: analysis.key_themes,
      llm_actionability_score: analysis.actionability_score,
      llm_has_catalyst: analysis.has_catalyst,
      // Note: llm_reasoning not available in reddit_posts_raw schema
      llm_analyzed_at: new Date().toISOString(),
      llm_analysis_version: '1.0-gpt5-nano',
      retrieved_at: new Date().toISOString()
      // Note: reddit_posts_raw doesn't have updated_at column
    }
    
    const { error: saveError } = await getSupabaseClient()
      .from(tableName)
      .upsert(enhancedPost, { 
        onConflict: source === 'reddit' ? 'post_id' : 'tweet_id'
      })
    
    if (saveError) {
      console.error(`❌ [REAL-TIME] Error saving ${source} post:`, saveError)
      return
    }
    
    // Step 2: IMMEDIATE aggregation update if ticker found
    if (analysis.ticker && analysis.confidence > 0.3) {
      console.log(`🚨 [REAL-TIME] Triggering immediate aggregation for ${analysis.ticker}`)
      await updateTickerAggregation(analysis.ticker)
    }
    
  } catch (error) {
    console.error(`❌ [REAL-TIME] Error in real-time save:`, error)
  }
}

/**
 * Batch save with real-time aggregation updates
 */
export async function saveBatchWithRealTimeAggregation(
  processedPosts: Array<{original: any, llm_analysis: any}>,
  source: 'reddit' | 'twitter'
): Promise<void> {
  const tickersToUpdate = new Set<string>()
  
  try {
    // Step 1: Save all posts in batch
    const tableName = source === 'reddit' ? 'reddit_posts_raw' : 'twitter_posts_raw'
    const idField = source === 'reddit' ? 'post_id' : 'tweet_id'
    
    const enhancedPosts = processedPosts.map(processed => {
      const post = processed.original
      const analysis = processed.llm_analysis
      
      // Collect tickers for aggregation
      if (analysis.ticker && analysis.confidence > 0.3) {
        tickersToUpdate.add(analysis.ticker)
      }
      
      // Filter post data to only include fields that exist in the schema
      const basePost = source === 'reddit' ? {
        post_id: post.id,
        title: post.title,
        selftext: post.selftext || '',
        author: post.author,
        subreddit: post.subreddit,
        score: post.score || 0,
        num_comments: post.num_comments || 0,
        created_utc: post.created_utc,
        url: post.url,
        permalink: post.permalink,
        is_self: post.is_self || false,
        domain: post.domain || null
      } : post // For Twitter, use the full post object

      return {
        ...basePost,
        llm_ticker: analysis.ticker,
        llm_sentiment_score: analysis.sentiment_score,
        llm_sentiment_label: analysis.sentiment_label,
        llm_confidence: analysis.confidence,
        llm_key_themes: analysis.key_themes,
        llm_actionability_score: analysis.actionability_score,
        llm_has_catalyst: analysis.has_catalyst,
        // Note: llm_reasoning not available in reddit_posts_raw schema
        llm_analyzed_at: new Date().toISOString(),
        llm_analysis_version: '1.0-gpt5-nano',
        retrieved_at: new Date().toISOString()
        // Note: reddit_posts_raw doesn't have updated_at column
      }
    })
    
    console.log(`💾 [REAL-TIME] Saving batch of ${enhancedPosts.length} ${source} posts...`)
    
    const { error: saveError } = await getSupabaseClient()
      .from(tableName)
      .upsert(enhancedPosts, { onConflict: idField })
    
    if (saveError) {
      console.error(`❌ [REAL-TIME] Error saving ${source} batch:`, saveError)
      return
    }
    
    // Step 2: Update aggregations for all affected tickers
    console.log(`🚨 [REAL-TIME] Updating aggregations for ${tickersToUpdate.size} tickers: ${Array.from(tickersToUpdate).join(', ')}`)
    
    const aggregationPromises = Array.from(tickersToUpdate).map(ticker => 
      updateTickerAggregation(ticker)
    )
    
    await Promise.all(aggregationPromises)
    
    console.log(`✅ [REAL-TIME] Completed batch save and aggregation for ${processedPosts.length} posts`)
    
  } catch (error) {
    console.error(`❌ [REAL-TIME] Error in batch real-time save:`, error)
  }
}

/**
 * Check aggregation freshness
 */
export async function getAggregationStatus(): Promise<{
  totalTickers: number,
  freshTickers: number,
  staleTickers: number,
  lastUpdate: string
}> {
  try {
    const { data, error } = await getSupabaseClient()
      .from('sentiment_aggregations')
      .select('ticker, calculated_at')
      .order('calculated_at', { ascending: false })
    
    if (error) {
      console.error('❌ [REAL-TIME] Error checking aggregation status:', error)
      return { totalTickers: 0, freshTickers: 0, staleTickers: 0, lastUpdate: 'unknown' }
    }
    
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    
    const freshTickers = data.filter(row => new Date(row.calculated_at) > oneHourAgo).length
    const staleTickers = data.length - freshTickers
    const lastUpdate = data[0]?.calculated_at || 'never'
    
    return {
      totalTickers: data.length,
      freshTickers,
      staleTickers,
      lastUpdate
    }
  } catch (error) {
    console.error('❌ [REAL-TIME] Exception checking aggregation status:', error)
    return { totalTickers: 0, freshTickers: 0, staleTickers: 0, lastUpdate: 'error' }
  }
}
