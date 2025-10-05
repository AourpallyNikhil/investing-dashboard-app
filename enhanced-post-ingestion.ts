/**
 * Enhanced Post Ingestion with Real-time LLM Processing
 * This replaces the current saveRawRedditPosts and saveRawTwitterPosts functions
 */

import { createClient } from '@supabase/supabase-js'
import { processPostsBatch, ProcessedPost, estimateBatchCost } from './src/lib/llm-post-processor'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * ENHANCED: Save raw Reddit posts with immediate LLM processing
 */
export async function saveRawRedditPostsWithLLM(rawPosts: any[]): Promise<void> {
  try {
    console.log(`💾 [ENHANCED] Processing ${rawPosts.length} raw Reddit posts with LLM...`)
    
    // Step 1: Process posts through LLM in batches of 25
    const batchSize = 25
    const allProcessedPosts: ProcessedPost[] = []
    
    for (let i = 0; i < rawPosts.length; i += batchSize) {
      const batch = rawPosts.slice(i, i + batchSize)
      const costEstimate = estimateBatchCost(batch.length)
      
      console.log(`🤖 [ENHANCED] Processing Reddit batch ${i + 1}-${i + batch.length} (cost: $${costEstimate.cost.toFixed(5)})`)
      
      const processedBatch = await processPostsBatch(batch, 'reddit')
      allProcessedPosts.push(...processedBatch)
      
      // Small delay to avoid rate limits
      if (i + batchSize < rawPosts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    // Step 2: Clear old posts (keep only last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { error: deleteError } = await supabase
      .from('reddit_posts_raw')
      .delete()
      .lt('retrieved_at', thirtyDaysAgo.toISOString())
    
    if (deleteError) {
      console.warn('⚠️ [ENHANCED] Error deleting old raw posts:', deleteError)
    }
    
    // Step 3: Prepare enhanced posts for insertion
    const enhancedPostRows = allProcessedPosts.map(processed => {
      const post = processed.original
      const analysis = processed.llm_analysis
      
      return {
        // Original fields
        post_id: post.id,
        fullname: post.name || `t3_${post.id}`,
        title: post.title,
        selftext: post.selftext || '',
        selftext_html: post.selftext_html || '',
        author: post.author,
        author_fullname: post.author_fullname || '',
        author_flair_text: post.author_flair_text || '',
        subreddit: post.subreddit,
        subreddit_id: post.subreddit_id || '',
        subreddit_name_prefixed: post.subreddit_name_prefixed || `r/${post.subreddit}`,
        score: post.score || 0,
        upvote_ratio: post.upvote_ratio || 0.5,
        ups: post.ups || post.score || 0,
        downs: post.downs || 0,
        num_comments: post.num_comments || 0,
        created_utc: post.created_utc,
        edited: post.edited || false,
        distinguished: post.distinguished || null,
        stickied: post.stickied || false,
        locked: post.locked || false,
        archived: post.archived || false,
        url: post.url,
        permalink: post.permalink,
        shortlink: post.shortlink || '',
        thumbnail: post.thumbnail || '',
        post_hint: post.post_hint || '',
        domain: post.domain || '',
        is_self: post.is_self !== undefined ? post.is_self : true,
        is_video: post.is_video || false,
        over_18: post.over_18 || false,
        total_awards_received: post.total_awards_received || 0,
        gilded: post.gilded || 0,
        all_awardings: post.all_awardings || [],
        link_flair_text: post.link_flair_text || '',
        link_flair_css_class: post.link_flair_css_class || '',
        raw_json: post.raw_json || post,
        
        // NEW: LLM Analysis Fields
        llm_ticker: analysis.ticker,
        llm_sentiment_score: analysis.sentiment_score,
        llm_sentiment_label: analysis.sentiment_label,
        llm_confidence: analysis.confidence,
        llm_key_themes: analysis.key_themes,
        llm_actionability_score: analysis.actionability_score,
        llm_has_catalyst: analysis.has_catalyst,
        llm_reasoning: analysis.reasoning,
        llm_analyzed_at: processed.processed_at,
        llm_analysis_version: processed.analysis_version,
        
        // Metadata
        retrieved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    })
    
    console.log(`📊 [ENHANCED] Inserting ${enhancedPostRows.length} enhanced Reddit posts...`)
    
    // Step 4: Insert in batches to avoid timeout
    const insertBatchSize = 50
    let successCount = 0
    let llmAnalyzedCount = 0
    
    for (let i = 0; i < enhancedPostRows.length; i += insertBatchSize) {
      const batch = enhancedPostRows.slice(i, i + insertBatchSize)
      
      const { error: insertError } = await supabase
        .from('reddit_posts_raw')
        .insert(batch)

      if (insertError) {
        console.error(`❌ [ENHANCED] Error inserting Reddit batch ${i}-${i + batch.length}:`, insertError)
      } else {
        successCount += batch.length
        llmAnalyzedCount += batch.filter(row => row.llm_ticker).length
        console.log(`✅ [ENHANCED] Inserted batch ${i}-${i + batch.length} Reddit posts`)
      }
    }
    
    console.log(`✅ [ENHANCED] Reddit processing complete:`)
    console.log(`   📊 ${successCount}/${rawPosts.length} posts saved`)
    console.log(`   🤖 ${llmAnalyzedCount} posts with LLM tickers`)
    console.log(`   💰 Total LLM cost: $${allProcessedPosts.reduce((sum, p) => sum + estimateBatchCost(1).cost, 0).toFixed(5)}`)
    
    // Step 5: Trigger aggregation refresh
    await refreshAggregations()
    
  } catch (error) {
    console.error('❌ [ENHANCED] Error in enhanced Reddit post processing:', error)
    throw error
  }
}

/**
 * ENHANCED: Save raw Twitter posts with immediate LLM processing
 */
export async function saveRawTwitterPostsWithLLM(rawTwitterPosts: any[]): Promise<void> {
  try {
    console.log(`💾 [ENHANCED] Processing ${rawTwitterPosts.length} raw Twitter posts with LLM...`)
    
    // Step 1: Process posts through LLM in batches
    const batchSize = 30  // Slightly larger for Twitter (shorter posts)
    const allProcessedPosts: ProcessedPost[] = []
    
    for (let i = 0; i < rawTwitterPosts.length; i += batchSize) {
      const batch = rawTwitterPosts.slice(i, i + batchSize)
      const costEstimate = estimateBatchCost(batch.length)
      
      console.log(`🤖 [ENHANCED] Processing Twitter batch ${i + 1}-${i + batch.length} (cost: $${costEstimate.cost.toFixed(5)})`)
      
      const processedBatch = await processPostsBatch(batch, 'twitter')
      allProcessedPosts.push(...processedBatch)
      
      // Small delay to avoid rate limits
      if (i + batchSize < rawTwitterPosts.length) {
        await new Promise(resolve => setTimeout(resolve, 800))
      }
    }
    
    // Step 2: Clear old posts (keep only last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { error: deleteError } = await supabase
      .from('twitter_posts_raw')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString())
    
    if (deleteError) {
      console.warn('⚠️ [ENHANCED] Error deleting old Twitter posts:', deleteError)
    }
    
    // Step 3: Prepare enhanced posts for insertion
    const enhancedPostRows = allProcessedPosts.map(processed => {
      const post = processed.original
      const analysis = processed.llm_analysis
      
      return {
        // Original fields
        tweet_id: post.tweet_id,
        text: post.text,
        author_username: post.author_username,
        author_id: post.author_id,
        author_name: post.author_name,
        created_at: post.created_at,
        retweet_count: post.retweet_count || 0,
        like_count: post.like_count || 0,
        reply_count: post.reply_count || 0,
        quote_count: post.quote_count || 0,
        url: post.url,
        cashtags: post.cashtags || [],
        raw_json: post.raw_json || post,
        
        // NEW: LLM Analysis Fields
        llm_ticker: analysis.ticker,
        llm_sentiment_score: analysis.sentiment_score,
        llm_sentiment_label: analysis.sentiment_label,
        llm_confidence: analysis.confidence,
        llm_key_themes: analysis.key_themes,
        llm_actionability_score: analysis.actionability_score,
        llm_has_catalyst: analysis.has_catalyst,
        llm_reasoning: analysis.reasoning,
        llm_analyzed_at: processed.processed_at,
        llm_analysis_version: processed.analysis_version,
        
        // Metadata
        retrieved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    })
    
    console.log(`📊 [ENHANCED] Inserting ${enhancedPostRows.length} enhanced Twitter posts...`)
    
    // Step 4: Insert with UPSERT to handle duplicates
    const { error: insertError } = await supabase
      .from('twitter_posts_raw')
      .upsert(enhancedPostRows, { 
        onConflict: 'tweet_id',
        ignoreDuplicates: false 
      })

    if (insertError) {
      console.error(`❌ [ENHANCED] Error inserting enhanced Twitter posts:`, insertError)
      throw insertError
    }
    
    const llmAnalyzedCount = enhancedPostRows.filter(row => row.llm_ticker).length
    
    console.log(`✅ [ENHANCED] Twitter processing complete:`)
    console.log(`   📊 ${enhancedPostRows.length}/${rawTwitterPosts.length} posts saved`)
    console.log(`   🤖 ${llmAnalyzedCount} posts with LLM tickers`)
    console.log(`   💰 Total LLM cost: $${allProcessedPosts.reduce((sum, p) => sum + estimateBatchCost(1).cost, 0).toFixed(5)}`)
    
    // Step 5: Trigger aggregation refresh
    await refreshAggregations()
    
  } catch (error) {
    console.error('❌ [ENHANCED] Error in enhanced Twitter post processing:', error)
    throw error
  }
}

/**
 * Refresh aggregations after new LLM-processed posts
 */
async function refreshAggregations(): Promise<void> {
  try {
    console.log('🔄 [ENHANCED] Refreshing LLM-powered aggregations...')
    
    const { data, error } = await supabase.rpc('refresh_llm_sentiment_aggregations')
    
    if (error) {
      console.error('❌ [ENHANCED] Error refreshing aggregations:', error)
    } else {
      console.log('✅ [ENHANCED] Aggregations refreshed successfully')
    }
  } catch (error) {
    console.error('❌ [ENHANCED] Error in aggregation refresh:', error)
  }
}

/**
 * Migration helper: Process existing posts that don't have LLM analysis
 */
export async function migrateLegacyPosts(): Promise<void> {
  try {
    console.log('🔄 [MIGRATION] Processing legacy posts without LLM analysis...')
    
    // Get Reddit posts without LLM analysis
    const { data: redditPosts, error: redditError } = await supabase
      .from('reddit_posts_raw')
      .select('*')
      .is('llm_ticker', null)
      .gt('created_utc', Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)) // Last 7 days
      .limit(100)
    
    if (redditError) {
      console.error('❌ [MIGRATION] Error fetching Reddit posts:', redditError)
    } else if (redditPosts && redditPosts.length > 0) {
      console.log(`🔄 [MIGRATION] Processing ${redditPosts.length} legacy Reddit posts...`)
      
      const processedPosts = await processPostsBatch(redditPosts, 'reddit')
      
      // Update posts with LLM analysis
      for (const processed of processedPosts) {
        const analysis = processed.llm_analysis
        
        await supabase
          .from('reddit_posts_raw')
          .update({
            llm_ticker: analysis.ticker,
            llm_sentiment_score: analysis.sentiment_score,
            llm_sentiment_label: analysis.sentiment_label,
            llm_confidence: analysis.confidence,
            llm_key_themes: analysis.key_themes,
            llm_actionability_score: analysis.actionability_score,
            llm_has_catalyst: analysis.has_catalyst,
            llm_reasoning: analysis.reasoning,
            llm_analyzed_at: processed.processed_at,
            llm_analysis_version: processed.analysis_version,
            updated_at: new Date().toISOString()
          })
          .eq('post_id', processed.original.post_id)
      }
      
      console.log(`✅ [MIGRATION] Updated ${processedPosts.length} Reddit posts with LLM analysis`)
    }
    
    // Get Twitter posts without LLM analysis
    const { data: twitterPosts, error: twitterError } = await supabase
      .from('twitter_posts_raw')
      .select('*')
      .is('llm_ticker', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .limit(100)
    
    if (twitterError) {
      console.error('❌ [MIGRATION] Error fetching Twitter posts:', twitterError)
    } else if (twitterPosts && twitterPosts.length > 0) {
      console.log(`🔄 [MIGRATION] Processing ${twitterPosts.length} legacy Twitter posts...`)
      
      const processedPosts = await processPostsBatch(twitterPosts, 'twitter')
      
      // Update posts with LLM analysis
      for (const processed of processedPosts) {
        const analysis = processed.llm_analysis
        
        await supabase
          .from('twitter_posts_raw')
          .update({
            llm_ticker: analysis.ticker,
            llm_sentiment_score: analysis.sentiment_score,
            llm_sentiment_label: analysis.sentiment_label,
            llm_confidence: analysis.confidence,
            llm_key_themes: analysis.key_themes,
            llm_actionability_score: analysis.actionability_score,
            llm_has_catalyst: analysis.has_catalyst,
            llm_reasoning: analysis.reasoning,
            llm_analyzed_at: processed.processed_at,
            llm_analysis_version: processed.analysis_version,
            updated_at: new Date().toISOString()
          })
          .eq('tweet_id', processed.original.tweet_id)
      }
      
      console.log(`✅ [MIGRATION] Updated ${processedPosts.length} Twitter posts with LLM analysis`)
    }
    
    console.log('✅ [MIGRATION] Legacy post migration complete')
    
  } catch (error) {
    console.error('❌ [MIGRATION] Error in legacy post migration:', error)
  }
}





































