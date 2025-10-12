/**
 * Enhanced LLM Ingestion with Real-time Application-level Aggregation
 * This replaces the current saveRawRedditPosts and saveRawTwitterPosts functions
 * Now using OpenAI Responses API with structured outputs and GPT-4o-mini for guaranteed valid JSON
 */

import { processPostsBatch } from './llm-post-processor'

/**
 * ENHANCED: Save raw Reddit posts with immediate LLM processing + real-time aggregation
 */
export async function saveRawRedditPostsWithLLM(rawPosts: any[]): Promise<void> {
  try {
    console.log(`💾 [ENHANCED] Processing ${rawPosts.length} raw Reddit posts with LLM + real-time aggregation...`)
    
    if (rawPosts.length === 0) {
      console.log('⚠️ [ENHANCED] No Reddit posts to process')
      return
    }
    
    // Process posts through LLM in batches of 3 (reduced to prevent response truncation)
    // This automatically saves to DB and triggers real-time aggregation
    const batchSize = 3
    
    for (let i = 0; i < rawPosts.length; i += batchSize) {
      const batch = rawPosts.slice(i, i + batchSize)
      
      console.log(`🤖 [ENHANCED] Processing Reddit batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(rawPosts.length/batchSize)} (${batch.length} posts) with OpenAI Chat Completions API`)
      
      // This function now handles:
      // 1. LLM processing with GPT-4o-mini via OpenAI Chat Completions API
      // 2. Database saving  
      // 3. Real-time aggregation
      await processPostsBatch(batch, 'reddit')
      
      // Small delay to avoid overwhelming the system
      if (i + batchSize < rawPosts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    console.log(`✅ [ENHANCED] Completed Reddit processing with real-time aggregation for ${rawPosts.length} posts`)
    
  } catch (error) {
    console.error('❌ [ENHANCED] Error in enhanced Reddit post processing:', error)
    throw error
  }
}

/**
 * ENHANCED: Save raw Twitter posts with immediate LLM processing + real-time aggregation
 */
export async function saveRawTwitterPostsWithLLM(rawTwitterPosts: any[]): Promise<void> {
  try {
    console.log(`💾 [ENHANCED] Processing ${rawTwitterPosts.length} raw Twitter posts with LLM + real-time aggregation...`)
    
    if (rawTwitterPosts.length === 0) {
      console.log('⚠️ [ENHANCED] No Twitter posts to process')
      return
    }
    
    // Process posts through LLM in batches of 3 (reduced to prevent response truncation)
    // This automatically saves to DB and triggers real-time aggregation
    const batchSize = 3
    
    for (let i = 0; i < rawTwitterPosts.length; i += batchSize) {
      const batch = rawTwitterPosts.slice(i, i + batchSize)
      
      console.log(`🤖 [ENHANCED] Processing Twitter batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(rawTwitterPosts.length/batchSize)} (${batch.length} posts) with OpenAI Chat Completions API`)
      
      // This function now handles:
      // 1. LLM processing with GPT-4o-mini via OpenAI Chat Completions API
      // 2. Database saving
      // 3. Real-time aggregation  
      await processPostsBatch(batch, 'twitter')
      
      // Small delay to avoid overwhelming the system
      if (i + batchSize < rawTwitterPosts.length) {
        await new Promise(resolve => setTimeout(resolve, 800))
      }
    }
    
    console.log(`✅ [ENHANCED] Completed Twitter processing with real-time aggregation for ${rawTwitterPosts.length} posts`)
    
  } catch (error) {
    console.error('❌ [ENHANCED] Error in enhanced Twitter post processing:', error)
    throw error
  }
}




































