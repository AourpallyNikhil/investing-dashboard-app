#!/usr/bin/env tsx

/**
 * Batch Process Reddit Comments with LLM Analysis
 * Analyzes existing unanalyzed Reddit comments and updates them with LLM insights
 */

import { createClient } from '@supabase/supabase-js'
import { processCommentsBatch, saveProcessedComments, CommentWithContext } from '../lib/llm-comment-processor'

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RedditComment {
  comment_id: string
  post_id: string
  parent_id?: string
  body: string
  author: string
  score: number
  depth: number
  created_utc: number
  llm_analyzed_at?: string
}

interface RedditPost {
  post_id: string
  title: string
  selftext?: string
}

async function main() {
  console.log('🚀 Starting Reddit Comments LLM Processing...')
  
  try {
    // Get unanalyzed comments (those without llm_analyzed_at)
    console.log('📊 Fetching unanalyzed comments...')
    
    const { data: comments, error: commentsError } = await supabase
      .from('reddit_comments')
      .select(`
        comment_id,
        post_id,
        parent_id,
        body,
        author,
        score,
        depth,
        created_utc,
        llm_analyzed_at
      `)
      .is('llm_analyzed_at', null)
      .not('body', 'eq', '[deleted]')
      .not('body', 'eq', '[removed]')
      .not('body', 'eq', '')
      .order('created_utc', { ascending: false })
      .limit(100) // Process in batches of 100
    
    if (commentsError) {
      throw new Error(`Error fetching comments: ${commentsError.message}`)
    }
    
    if (!comments || comments.length === 0) {
      console.log('✅ No unanalyzed comments found. All comments are up to date!')
      return
    }
    
    console.log(`📝 Found ${comments.length} unanalyzed comments`)
    
    // Get unique post IDs to fetch post context
    const postIds = [...new Set(comments.map(c => c.post_id))]
    console.log(`📚 Fetching context for ${postIds.length} posts...`)
    
    const { data: posts, error: postsError } = await supabase
      .from('reddit_posts_raw')
      .select('post_id, title, selftext')
      .in('post_id', postIds)
    
    if (postsError) {
      throw new Error(`Error fetching posts: ${postsError.message}`)
    }
    
    // Create a map for quick post lookup
    const postsMap = new Map<string, RedditPost>()
    posts?.forEach(post => postsMap.set(post.post_id, post))
    
    // Get parent comments for context (for nested comments)
    const parentCommentIds = comments
      .filter(c => c.parent_id && c.parent_id !== c.post_id)
      .map(c => c.parent_id!)
      .filter(Boolean)
    
    let parentCommentsMap = new Map<string, string>()
    
    if (parentCommentIds.length > 0) {
      console.log(`🔗 Fetching ${parentCommentIds.length} parent comments for context...`)
      
      const { data: parentComments, error: parentError } = await supabase
        .from('reddit_comments')
        .select('comment_id, body')
        .in('comment_id', parentCommentIds)
      
      if (!parentError && parentComments) {
        parentComments.forEach(pc => parentCommentsMap.set(pc.comment_id, pc.body))
      }
    }
    
    // Prepare comments with context for LLM processing
    const commentsWithContext: CommentWithContext[] = comments.map(comment => {
      const post = postsMap.get(comment.post_id)
      const parentComment = comment.parent_id && comment.parent_id !== comment.post_id 
        ? parentCommentsMap.get(comment.parent_id) 
        : undefined
      
      return {
        comment,
        post_title: post?.title || 'Unknown Post',
        post_content: post?.selftext || '',
        parent_comment: parentComment
      }
    })
    
    // Process comments in smaller batches for better LLM performance
    const BATCH_SIZE = 10
    const batches = []
    
    for (let i = 0; i < commentsWithContext.length; i += BATCH_SIZE) {
      batches.push(commentsWithContext.slice(i, i + BATCH_SIZE))
    }
    
    console.log(`🧠 Processing ${commentsWithContext.length} comments in ${batches.length} batches of ${BATCH_SIZE}...`)
    
    let totalProcessed = 0
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      console.log(`\n📦 Processing batch ${i + 1}/${batches.length} (${batch.length} comments)...`)
      
      try {
        // Process batch with LLM
        const processedComments = await processCommentsBatch(batch)
        
        // Save to database
        await saveProcessedComments(processedComments)
        
        totalProcessed += processedComments.length
        console.log(`✅ Batch ${i + 1} completed. Total processed: ${totalProcessed}/${commentsWithContext.length}`)
        
        // Add delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
          console.log('⏳ Waiting 2 seconds before next batch...')
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        
      } catch (error) {
        console.error(`❌ Error processing batch ${i + 1}:`, error)
        console.log('⏭️ Continuing with next batch...')
      }
    }
    
    console.log(`\n🎉 Reddit Comments Processing Complete!`)
    console.log(`📊 Total comments processed: ${totalProcessed}/${commentsWithContext.length}`)
    
    // Show some statistics
    const { data: stats } = await supabase
      .from('reddit_comments')
      .select('comment_id, llm_analyzed_at, llm_confidence, sentiment_score')
      .not('llm_analyzed_at', 'is', null)
    
    if (stats) {
      const avgConfidence = stats.reduce((sum, s) => sum + (s.llm_confidence || 0), 0) / stats.length
      const avgSentiment = stats.reduce((sum, s) => sum + (s.sentiment_score || 0), 0) / stats.length
      
      console.log(`\n📈 Analysis Statistics:`)
      console.log(`   • Total analyzed comments: ${stats.length}`)
      console.log(`   • Average confidence: ${avgConfidence.toFixed(3)}`)
      console.log(`   • Average sentiment: ${avgSentiment.toFixed(3)}`)
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

// Handle command line execution
if (require.main === module) {
  main().catch(console.error)
}

export { main as processRedditComments }
















