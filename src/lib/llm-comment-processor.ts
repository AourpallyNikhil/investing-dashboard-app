/**
 * LLM Comment Processor
 * Specialized processor for Reddit comments with thread context analysis
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

// Lazy initialization of Gemini
let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

export interface LLMCommentAnalysis {
  ticker: string | null
  sentiment_score: number          // -1 to 1
  sentiment_label: 'positive' | 'negative' | 'neutral'
  confidence: number               // 0 to 1
  key_themes: string[]
  actionability_score: number     // 0 to 1
  has_catalyst: boolean
  reasoning: string
  thread_context_score: number    // 0 to 1 - how relevant to original post
  argument_strength: number       // 0 to 1 - strength of argument/evidence
}

export interface ProcessedComment {
  // Original comment data
  original: any
  // LLM analysis
  llm_analysis: LLMCommentAnalysis
  // Processing metadata
  processed_at: string
  analysis_version: string
}

export interface CommentWithContext {
  comment: any
  post_title: string
  post_content: string
  parent_comment?: string
}

/**
 * Process Reddit comments with thread context in batches
 */
export async function processCommentsBatch(
  commentsWithContext: CommentWithContext[]
): Promise<ProcessedComment[]> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ [LLM] No GEMINI_API_KEY found, using fallback analysis for comments')
    return commentsWithContext.map(({ comment }) => ({
      original: comment,
      llm_analysis: generateFallbackCommentAnalysis(comment),
      processed_at: new Date().toISOString(),
      analysis_version: '1.0-fallback'
    }))
  }

  try {
    console.log(`🧠 [LLM] Processing ${commentsWithContext.length} comments...`)
    
    const model = getGenAI().getGenerativeModel({ model: 'gemini-2.5-flash' })
    const prompt = buildCommentBatchPrompt(commentsWithContext)
    
    console.log(`📝 [LLM] Sending comment analysis request to Gemini...`)
    const result = await model.generateContent(prompt)
    const response = result.response.text()
    
    console.log(`✅ [LLM] Received response, parsing comment analysis...`)
    const analyses = parseGeminiCommentResponse(response, commentsWithContext.length)
    
    // Map analyses back to comments
    const processedComments = commentsWithContext.map((commentContext, index) => ({
      original: commentContext.comment,
      llm_analysis: analyses[index] || generateFallbackCommentAnalysis(commentContext.comment),
      processed_at: new Date().toISOString(),
      analysis_version: '1.0'
    }))
    
    console.log(`✅ [LLM] Successfully processed ${processedComments.length} comments`)
    return processedComments
    
  } catch (error) {
    console.error('❌ [LLM] Error processing comments:', error)
    
    // Fallback to simple analysis
    return commentsWithContext.map(({ comment }) => ({
      original: comment,
      llm_analysis: generateFallbackCommentAnalysis(comment),
      processed_at: new Date().toISOString(),
      analysis_version: '1.0-fallback'
    }))
  }
}

/**
 * Build specialized prompt for comment analysis with thread context
 */
function buildCommentBatchPrompt(commentsWithContext: CommentWithContext[]): string {
  const commentTexts = commentsWithContext.map((ctx, index) => {
    const parentInfo = ctx.parent_comment ? `\nParent Comment: "${ctx.parent_comment}"` : ''
    
    return `COMMENT_${index}:
Original Post: "${ctx.post_title} ${ctx.post_content}".trim()${parentInfo}
Comment: "${ctx.comment.body}".trim()
Score: ${ctx.comment.score || 0} upvotes
Author: ${ctx.comment.author}
Depth: ${ctx.comment.depth || 0}`
  }).join('\n\n')
  
  return `You are a financial sentiment analyzer specializing in Reddit comment analysis. Analyze these comments in the context of their original posts and return a JSON array with exactly ${commentsWithContext.length} objects.

For each comment, extract:
1. **ticker**: Stock ticker mentioned (e.g., "NVDA", "AAPL") or null if none
2. **sentiment_score**: Float from -1.0 (very negative) to 1.0 (very positive)  
3. **sentiment_label**: "positive", "negative", or "neutral"
4. **confidence**: Float from 0.0 to 1.0 (how confident you are)
5. **key_themes**: Array of 1-3 key themes (e.g., ["earnings", "valuation", "technical"])
6. **actionability_score**: Float 0.0-1.0 (how actionable for traders - specific price targets, entry/exit points, etc.)
7. **has_catalyst**: Boolean (mentions earnings, FDA approval, contracts, upgrades, etc.)
8. **reasoning**: Brief explanation of your analysis
9. **thread_context_score**: Float 0.0-1.0 (how relevant the comment is to the original post topic)
10. **argument_strength**: Float 0.0-1.0 (strength of evidence/reasoning provided in comment)

COMMENTS TO ANALYZE:
${commentTexts}

COMMENT-SPECIFIC ANALYSIS RULES:
- **Thread Context**: Score how well the comment relates to the original post topic
- **Argument Strength**: Evaluate the quality of reasoning, evidence, or analysis provided
- **Actionability**: Comments with specific price targets, technical levels, or trading advice score higher
- **Sentiment**: Consider the comment's sentiment toward the stock, not just general tone
- **Confidence**: Lower confidence for vague or off-topic comments

GENERAL RULES:
- Company names → tickers (e.g., "NVIDIA" → "NVDA", "Apple" → "AAPL", "Tesla" → "TSLA")
- Only well-known public companies (no crypto, no private companies)
- If multiple tickers mentioned, pick the PRIMARY one
- Be conservative with sentiment scores (most comments are neutral)
- Return valid JSON array with EXACTLY ${commentsWithContext.length} objects
- Use null for ticker if no stock mentioned
- Always use true/false for has_catalyst (never incomplete)

CRITICAL: Return ONLY valid JSON. No explanations, no markdown, no extra text.

RESPONSE FORMAT (exactly ${commentsWithContext.length} objects):
[
  {
    "ticker": "NVDA",
    "sentiment_score": 0.7,
    "sentiment_label": "positive",
    "confidence": 0.9,
    "key_themes": ["earnings", "AI"],
    "actionability_score": 0.8,
    "has_catalyst": true,
    "reasoning": "Strong bullish comment with specific price target based on AI growth",
    "thread_context_score": 0.95,
    "argument_strength": 0.85
  },
  {
    "ticker": null,
    "sentiment_score": 0.0,
    "sentiment_label": "neutral",
    "confidence": 0.5,
    "key_themes": ["general"],
    "actionability_score": 0.1,
    "has_catalyst": false,
    "reasoning": "Off-topic comment, no stock discussion",
    "thread_context_score": 0.2,
    "argument_strength": 0.3
  }
]`
}

/**
 * Parse Gemini's JSON response for comment analysis
 */
function parseGeminiCommentResponse(response: string, expectedCount: number): LLMCommentAnalysis[] {
  try {
    // Clean response (remove markdown, extra text)
    let cleanResponse = response.trim()
    cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    
    // Find JSON array - be more flexible with incomplete responses
    let jsonMatch = cleanResponse.match(/\[[\s\S]*/)
    
    if (!jsonMatch) {
      console.log('⚠️ [LLM] No JSON array found for comments, using fallback')
      return Array(expectedCount).fill(null).map(() => generateFallbackCommentAnalysis({}))
    }
    
    let jsonStr = jsonMatch[0]
    
    // If the JSON is incomplete (doesn't end with ]), try to fix it
    if (!jsonStr.trim().endsWith(']')) {
      console.log('🔧 [LLM] Detected incomplete JSON response, attempting to fix...')
      
      // Find the last complete object
      const lastCompleteMatch = jsonStr.match(/.*}(?=\s*,?\s*$)/s)
      if (lastCompleteMatch) {
        jsonStr = lastCompleteMatch[0]
        if (!jsonStr.trim().startsWith('[')) {
          jsonStr = '[' + jsonStr
        }
        if (!jsonStr.trim().endsWith(']')) {
          jsonStr = jsonStr + ']'
        }
      } else {
        // Fallback to partial parsing
        console.log('⚠️ [LLM] Could not fix incomplete JSON, using fallback')
        return Array(expectedCount).fill(null).map(() => generateFallbackCommentAnalysis({}))
      }
    }
    
    // Fix common JSON issues
    jsonStr = fixCommonJsonIssues(jsonStr)
    
    const parsed = JSON.parse(jsonStr)
    
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array')
    }
    
    // Validate and sanitize each comment analysis
    const validAnalyses = parsed.map((item: any): LLMCommentAnalysis => {
      return {
        ticker: typeof item.ticker === 'string' ? item.ticker.toUpperCase() : null,
        sentiment_score: Math.max(-1, Math.min(1, parseFloat(item.sentiment_score) || 0)),
        sentiment_label: ['positive', 'negative', 'neutral'].includes(item.sentiment_label) 
          ? item.sentiment_label : 'neutral',
        confidence: Math.max(0, Math.min(1, parseFloat(item.confidence) || 0.5)),
        key_themes: Array.isArray(item.key_themes) ? item.key_themes.slice(0, 5) : ['general'],
        actionability_score: Math.max(0, Math.min(1, parseFloat(item.actionability_score) || 0)),
        has_catalyst: Boolean(item.has_catalyst),
        reasoning: typeof item.reasoning === 'string' ? item.reasoning.slice(0, 500) : 'No reasoning provided',
        thread_context_score: Math.max(0, Math.min(1, parseFloat(item.thread_context_score) || 0.5)),
        argument_strength: Math.max(0, Math.min(1, parseFloat(item.argument_strength) || 0.5))
      }
    })
    
    // Ensure we have exactly the expected count
    while (validAnalyses.length < expectedCount) {
      validAnalyses.push(generateFallbackCommentAnalysis({}))
    }
    
    return validAnalyses.slice(0, expectedCount)
    
  } catch (error) {
    console.error('❌ [LLM] Error parsing comment response:', error)
    console.log('Raw response:', response.slice(0, 500))
    
    // Return fallback analyses
    return Array(expectedCount).fill(null).map(() => generateFallbackCommentAnalysis({}))
  }
}

/**
 * Fix common JSON formatting issues
 */
function fixCommonJsonIssues(jsonStr: string): string {
  return jsonStr
    .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
    .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // Quote unquoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"')  // Convert single quotes to double
    .replace(/\n/g, ' ')  // Remove newlines
    .replace(/\s+/g, ' ')  // Normalize whitespace
}

/**
 * Generate fallback analysis when LLM fails
 */
function generateFallbackCommentAnalysis(comment: any): LLMCommentAnalysis {
  const body = comment.body || ''
  const score = comment.score || 0
  
  // Simple keyword-based analysis
  const positiveKeywords = ['good', 'great', 'excellent', 'bullish', 'buy', 'strong', 'growth', 'up']
  const negativeKeywords = ['bad', 'terrible', 'bearish', 'sell', 'weak', 'decline', 'down', 'crash']
  
  const positiveCount = positiveKeywords.filter(word => 
    body.toLowerCase().includes(word)).length
  const negativeCount = negativeKeywords.filter(word => 
    body.toLowerCase().includes(word)).length
  
  let sentiment_score = 0
  let sentiment_label: 'positive' | 'negative' | 'neutral' = 'neutral'
  
  if (positiveCount > negativeCount) {
    sentiment_score = 0.3
    sentiment_label = 'positive'
  } else if (negativeCount > positiveCount) {
    sentiment_score = -0.3
    sentiment_label = 'negative'
  }
  
  // Factor in Reddit score
  if (score > 5) sentiment_score += 0.1
  if (score < -2) sentiment_score -= 0.2
  
  // Clamp sentiment score
  sentiment_score = Math.max(-1, Math.min(1, sentiment_score))
  
  return {
    ticker: null,
    sentiment_score,
    sentiment_label,
    confidence: 0.3, // Low confidence for fallback
    key_themes: ['general'],
    actionability_score: 0.1,
    has_catalyst: false,
    reasoning: 'Fallback keyword-based analysis',
    thread_context_score: 0.5,
    argument_strength: 0.3
  }
}

/**
 * Save processed comments to database
 */
export async function saveProcessedComments(
  processedComments: ProcessedComment[]
): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js')
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  try {
    console.log(`💾 [LLM] Saving ${processedComments.length} processed comments...`)
    
    // Prepare update data
    const updates = processedComments.map(pc => ({
      comment_id: pc.original.comment_id,
      extracted_tickers: pc.llm_analysis.ticker ? [pc.llm_analysis.ticker] : [],
      sentiment_score: pc.llm_analysis.sentiment_score,
      sentiment_label: pc.llm_analysis.sentiment_label,
      key_topics: pc.llm_analysis.key_themes,
      llm_confidence: pc.llm_analysis.confidence,
      llm_actionability_score: pc.llm_analysis.actionability_score,
      llm_analysis_version: pc.analysis_version,
      llm_analyzed_at: pc.processed_at,
      llm_has_catalyst: pc.llm_analysis.has_catalyst,
      llm_reasoning: pc.llm_analysis.reasoning,
      llm_thread_context_score: pc.llm_analysis.thread_context_score,
      llm_argument_strength: pc.llm_analysis.argument_strength,
      processed_at: pc.processed_at
    }))
    
    // Batch update comments
    for (const update of updates) {
      const { error } = await supabase
        .from('reddit_comments')
        .update(update)
        .eq('comment_id', update.comment_id)
      
      if (error) {
        console.error(`❌ [LLM] Error updating comment ${update.comment_id}:`, error)
      }
    }
    
    console.log(`✅ [LLM] Successfully saved ${processedComments.length} processed comments`)
    
  } catch (error) {
    console.error('❌ [LLM] Error saving processed comments:', error)
    throw error
  }
}
