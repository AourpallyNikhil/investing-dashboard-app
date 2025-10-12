/**
 * Real-time LLM Post Processor
 * Processes individual posts immediately after fetching from APIs
 */

import OpenAI from 'openai'
import { updateTickerAggregation, saveBatchWithRealTimeAggregation } from './real-time-aggregator'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'

// Lazy initialization of OpenAI to avoid issues when env vars aren't loaded yet
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('🔑 [LLM-PROCESSOR-DEBUG] OPENAI_API_KEY present:', !!apiKey);
    console.log('🔑 [LLM-PROCESSOR-DEBUG] OPENAI_API_KEY length:', apiKey?.length || 0);
    
    if (!apiKey) {
      console.error('❌ [LLM-PROCESSOR-DEBUG] OPENAI_API_KEY environment variable is not set');
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    console.log('✅ [LLM-PROCESSOR-DEBUG] Creating OpenAI client...');
    openai = new OpenAI({ apiKey });
    console.log('✅ [LLM-PROCESSOR-DEBUG] OpenAI client created successfully:', !!openai);
    console.log('✅ [LLM-PROCESSOR-DEBUG] OpenAI client has chat:', !!openai.chat);
    console.log('✅ [LLM-PROCESSOR-DEBUG] OpenAI client has completions:', !!openai.chat?.completions);
  }
  return openai;
}

// Zod schema for structured output
const PostAnalysisSchema = z.object({
  ticker: z.string().nullable(),
  sentiment_score: z.number().min(-1).max(1),
  sentiment_label: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
  key_themes: z.array(z.string()),
  actionability_score: z.number().min(0).max(1),
  has_catalyst: z.boolean(),
  reasoning: z.string()
})

const BatchAnalysisSchema = z.object({
  analyses: z.array(PostAnalysisSchema)
})

export interface LLMPostAnalysis {
  ticker: string | null
  sentiment_score: number  // -1 to 1
  sentiment_label: 'positive' | 'negative' | 'neutral'
  confidence: number       // 0 to 1
  key_themes: string[]
  actionability_score: number  // 0 to 1
  has_catalyst: boolean
  reasoning: string
}

export interface ProcessedPost {
  // Original post data
  original: any
  // LLM analysis
  llm_analysis: LLMPostAnalysis
  // Processing metadata
  processed_at: string
  analysis_version: string
}

/**
 * Process multiple posts in a single LLM call for efficiency WITH REAL-TIME AGGREGATION
 */
export async function processPostsBatch(posts: any[], source: 'reddit' | 'twitter'): Promise<ProcessedPost[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️ [LLM] No OPENAI_API_KEY found, using fallback analysis')
    return posts.map(post => ({
      original: post,
      llm_analysis: getFallbackAnalysis(post, source),
      processed_at: new Date().toISOString(),
      analysis_version: '1.0-fallback'
    }))
  }

  try {
    console.log(`🤖 [LLM] Processing batch of ${posts.length} ${source} posts...`)
    
    const client = getOpenAI()
    const prompt = buildBatchPrompt(posts, source)
    
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a financial sentiment analyzer. Analyze social media posts and return structured sentiment data.' },
        { role: 'user', content: prompt + '\n\nRespond with valid JSON matching the expected schema.' }
      ],
      max_tokens: 2000,
      temperature: 0.1
    })

    const responseText = completion.choices[0].message.content
    
    if (!responseText) {
      throw new Error('Empty response from OpenAI')
    }

    // Parse JSON from response
    let response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        response = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in OpenAI response')
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI JSON:', parseError)
      throw new Error(`Failed to parse OpenAI response: ${parseError.message}`)
    }
    
    if (!response || !response.analyses) {
      throw new Error('Invalid response structure from OpenAI')
    }

    console.log(`🤖 [LLM] Successfully parsed ${response.analyses.length} analyses`)
    
    const analyses = response.analyses
    
    if (analyses.length !== posts.length) {
      console.warn(`⚠️ [LLM] Analysis count mismatch: got ${analyses.length}, expected ${posts.length}`)
    }
    
    // Combine posts with analyses
    const processedPosts: ProcessedPost[] = posts.map((post, index) => ({
      original: post,
      llm_analysis: analyses[index] || getFallbackAnalysis(post, source),
      processed_at: new Date().toISOString(),
      analysis_version: '1.0-gpt4o-mini'
    }))
    
    console.log(`✅ [LLM] Successfully processed ${processedPosts.length} posts`)
    
    // 🚨 IMMEDIATE REAL-TIME AGGREGATION
    console.log(`🚨 [LLM] Triggering real-time aggregation for processed posts...`)
    await saveBatchWithRealTimeAggregation(processedPosts, source)
    
    return processedPosts
    
  } catch (error) {
    console.error('❌ [LLM] Error processing posts batch:', error)
    
    // Return fallback analyses WITH REAL-TIME AGGREGATION
    const fallbackPosts = posts.map(post => ({
      original: post,
      llm_analysis: getFallbackAnalysis(post, source),
      processed_at: new Date().toISOString(),
      analysis_version: '1.0-fallback'
    }))
    
    console.log(`🚨 [LLM] Triggering real-time aggregation for fallback posts...`)
    await saveBatchWithRealTimeAggregation(fallbackPosts, source)
    
    return fallbackPosts
  }
}

/**
 * Build optimized prompt for batch processing
 */
function buildBatchPrompt(posts: any[], source: 'reddit' | 'twitter'): string {
  const postTexts = posts.map((post, index) => {
    if (source === 'reddit') {
      return `POST_${index}: ${post.title} ${post.selftext || ''}`.trim()
    } else {
      return `POST_${index}: ${post.text}`.trim()
    }
  }).join('\n\n')
  
  return `Analyze these ${posts.length} ${source} posts and extract sentiment data for each.

POSTS TO ANALYZE:
${postTexts}

INSTRUCTIONS:
- For ticker: Extract stock ticker symbol (e.g., "NVDA", "AAPL", "TSLA") or null if none mentioned
- Company names should be converted to tickers (e.g., "NVIDIA" → "NVDA", "Apple" → "AAPL")
- Only well-known public companies (no crypto, no private companies)
- If multiple tickers mentioned, pick the PRIMARY one
- For sentiment_score: Rate from -1.0 (very negative) to 1.0 (very positive), most posts are neutral (around 0)
- For sentiment_label: "positive", "negative", or "neutral"
- For confidence: Rate from 0.0 to 1.0
- For key_themes: List 1-3 key themes (e.g., ["earnings", "AI", "growth"])
- For actionability_score: Rate 0.0-1.0 how actionable/specific this is for traders
- For has_catalyst: true if mentions earnings, FDA approval, contracts, product launches, etc.
- For reasoning: Brief explanation of your analysis

Return exactly ${posts.length} analysis objects in this format:
{
  "analyses": [
    {
      "ticker": "AAPL",
      "sentiment_score": 0.7,
      "sentiment_label": "positive",
      "confidence": 0.8,
      "key_themes": ["earnings", "growth"],
      "actionability_score": 0.6,
      "has_catalyst": true,
      "reasoning": "Positive earnings discussion"
    }
  ]
}`
}

/**
 * Fallback analysis when LLM is unavailable
 */
function getFallbackAnalysis(post: any, source: 'reddit' | 'twitter'): LLMPostAnalysis {
  const text = source === 'reddit' 
    ? `${post.title} ${post.selftext || ''}` 
    : post.text
    
  // Simple keyword-based ticker extraction
  const tickerMatch = text.match(/\$([A-Z]{1,5})\b/)
  const ticker = tickerMatch ? tickerMatch[1] : null
  
  // Basic sentiment keywords
  const positiveWords = ['good', 'great', 'bullish', 'buy', 'moon', 'rocket']
  const negativeWords = ['bad', 'bearish', 'sell', 'crash', 'dump']
  
  const lowerText = text.toLowerCase()
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length
  
  let sentiment_score = 0
  let sentiment_label: 'positive' | 'negative' | 'neutral' = 'neutral'
  
  if (positiveCount > negativeCount) {
    sentiment_score = 0.3
    sentiment_label = 'positive'
  } else if (negativeCount > positiveCount) {
    sentiment_score = -0.3
    sentiment_label = 'negative'
  }
  
  return {
    ticker,
    sentiment_score,
    sentiment_label,
    confidence: 0.3, // Low confidence for fallback
    key_themes: [],
    actionability_score: ticker ? 0.5 : 0.1,
    has_catalyst: /earnings|guidance|fda|contract/.test(lowerText),
    reasoning: 'Fallback keyword-based analysis'
  }
}

/**
 * Cost estimation helper for OpenAI GPT-4o-mini
 */
export function estimateBatchCost(postCount: number): { tokens: number, cost: number } {
  // Rough estimates for batch processing
  const inputTokensPerPost = 50  // Average post length
  const outputTokensPerPost = 100 // JSON response per post
  const instructionTokens = 500   // Prompt overhead
  
  const totalInputTokens = (postCount * inputTokensPerPost) + instructionTokens
  const totalOutputTokens = postCount * outputTokensPerPost
  
  // GPT-4o-mini pricing
  const inputCostPer1M = 0.15   // $0.15 per 1M input tokens
  const outputCostPer1M = 0.60  // $0.60 per 1M output tokens
  
  const cost = (totalInputTokens / 1000000 * inputCostPer1M) + 
               (totalOutputTokens / 1000000 * outputCostPer1M)
  
  return {
    tokens: totalInputTokens + totalOutputTokens,
    cost: Math.round(cost * 100000) / 100000 // Round to 5 decimal places
  }
}