/**
 * Real-time LLM Post Processor
 * Processes individual posts immediately after fetching from APIs
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { updateTickerAggregation, saveBatchWithRealTimeAggregation } from './real-time-aggregator'

// Lazy initialization of Gemini to avoid issues when env vars aren't loaded yet
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
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ [LLM] No GEMINI_API_KEY found, using fallback analysis')
    return posts.map(post => ({
      original: post,
      llm_analysis: getFallbackAnalysis(post, source),
      processed_at: new Date().toISOString(),
      analysis_version: '1.0-fallback'
    }))
  }

  try {
    console.log(`🤖 [LLM] Processing batch of ${posts.length} ${source} posts...`)
    
    const model = getGenAI().getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.1
      }
    })
    
    const prompt = buildBatchPrompt(posts, source)
    
    const result = await model.generateContent(prompt)
    const response = result.response.text()
    
    console.log(`🤖 [LLM] Raw response length: ${response.length} chars`)
    
    // Log response truncation warning
    if (response.length > 3000 && !response.trim().endsWith(']')) {
      console.warn(`⚠️ [LLM] Response may be truncated - length: ${response.length}, ends with: "${response.slice(-50)}"`)
    }
    
    // Parse JSON response
    const analyses = parseGeminiResponse(response, posts.length)
    
    if (analyses.length !== posts.length) {
      console.warn(`⚠️ [LLM] Analysis count mismatch: got ${analyses.length}, expected ${posts.length}`)
    }
    
    // Combine posts with analyses
    const processedPosts: ProcessedPost[] = posts.map((post, index) => ({
      original: post,
      llm_analysis: analyses[index] || getFallbackAnalysis(post, source),
      processed_at: new Date().toISOString(),
      analysis_version: '1.0-gemini'
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
      return `POST_${index}: "${post.title} ${post.selftext || ''}".trim()`
    } else {
      return `POST_${index}: "${post.text}".trim()`
    }
  }).join('\n')
  
  return `You are a financial sentiment analyzer. Analyze these ${source} posts and return a JSON array with exactly ${posts.length} objects.

For each post, extract:
1. **ticker**: Stock ticker mentioned (e.g., "NVDA", "AAPL") or null if none
2. **sentiment_score**: Float from -1.0 (very negative) to 1.0 (very positive)  
3. **sentiment_label**: "positive", "negative", or "neutral"
4. **confidence**: Float from 0.0 to 1.0 (how confident you are)
5. **key_themes**: Array of 1-3 key themes (e.g., ["earnings", "AI", "growth"])
6. **actionability_score**: Float 0.0-1.0 (how actionable/specific is this for traders)
7. **has_catalyst**: Boolean (mentions earnings, FDA approval, contracts, etc.)
8. **reasoning**: Brief explanation of your analysis

POSTS TO ANALYZE:
${postTexts}

IMPORTANT RULES:
- Company names → tickers (e.g., "NVIDIA" → "NVDA", "Apple" → "AAPL", "Tesla" → "TSLA")
- Only well-known public companies (no crypto, no private companies)
- If multiple tickers mentioned, pick the PRIMARY one
- Be conservative with sentiment scores (most posts are neutral)
- Return valid JSON array with EXACTLY ${posts.length} objects
- Use null for ticker if no stock mentioned
- Always use true/false for has_catalyst (never incomplete)

CRITICAL: Return ONLY valid JSON. No explanations, no markdown, no extra text.

RESPONSE FORMAT (exactly ${posts.length} objects):
[
  {
    "ticker": "NVDA",
    "sentiment_score": 0.7,
    "sentiment_label": "positive",
    "confidence": 0.9,
    "key_themes": ["earnings", "AI"],
    "actionability_score": 0.8,
    "has_catalyst": true,
    "reasoning": "Positive discussion about NVIDIA's AI earnings potential"
  },
  {
    "ticker": null,
    "sentiment_score": 0.0,
    "sentiment_label": "neutral",
    "confidence": 0.5,
    "key_themes": ["general"],
    "actionability_score": 0.1,
    "has_catalyst": false,
    "reasoning": "No specific stock mentioned"
  }
]`
}

/**
 * Parse Gemini's JSON response with robust error handling
 */
function parseGeminiResponse(response: string, expectedCount: number = 10): LLMPostAnalysis[] {
  try {
    // Clean response (remove markdown, extra text, fix common JSON issues)
    let cleanResponse = response.trim()
    
    // Remove markdown code blocks
    cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    
    // Find JSON array - try complete array first, then partial
    let jsonMatch = cleanResponse.match(/\[[\s\S]*?\]/)
    
    if (!jsonMatch) {
      // If no complete array found, try to extract and repair partial JSON
      console.log('⚠️ [LLM] No complete JSON array found, trying partial extraction...')
      return extractPartialJsonObjects(cleanResponse, expectedCount)
    }
    
    let jsonStr = jsonMatch[0]
    
    // Fix common JSON issues
    jsonStr = fixCommonJsonIssues(jsonStr)
    
    // Try to parse the JSON
    try {
      const parsed = JSON.parse(jsonStr)
      if (Array.isArray(parsed)) {
        console.log(`✅ [LLM] Successfully parsed complete JSON with ${parsed.length} objects`)
        return parsed.map(validateAnalysis)
      } else {
        throw new Error('Response is not an array')
      }
    } catch (error) {
      // If JSON parsing fails, try to extract the valid portion using a different approach
      console.log('⚠️ [LLM] JSON parsing failed, attempting simpler extraction...')
      
      // Try extracting individual complete JSON objects
      const objectMatches = cleanResponse.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)
      if (objectMatches && objectMatches.length > 0) {
        console.log(`🔧 [LLM] Found ${objectMatches.length} potential JSON objects`)
        const results: LLMPostAnalysis[] = []
        
        for (const match of objectMatches) {
          try {
            const cleanMatch = fixCommonJsonIssues(match)
            const obj = JSON.parse(cleanMatch)
            results.push(validateAnalysis(obj))
            console.log(`✅ [LLM] Successfully parsed object ${results.length}`)
          } catch (err) {
            console.warn('⚠️ [LLM] Failed to parse object:', match.substring(0, 100))
          }
        }
        
        if (results.length > 0) {
          console.log(`✅ [LLM] Extracted ${results.length} valid objects using simple extraction`)
          return results
        }
      }
      
      // Final fallback - try partial extraction
      return extractPartialJsonObjects(cleanResponse, expectedCount)
    }
    
  } catch (error) {
    console.error('❌ [LLM] Error parsing Gemini response:', error)
    console.log('📄 [LLM] Raw response:', response.substring(0, 1000))
    
    // Try to extract partial valid JSON objects
    return extractPartialJson(response)
  }
}

/**
 * Fix common JSON formatting issues from LLM responses
 */
function fixCommonJsonIssues(jsonStr: string): string {
  // Remove control characters that break JSON parsing
  jsonStr = jsonStr.replace(/[\x00-\x1F\x7F-\x9F]/g, '')
  
  // Fix trailing commas
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1')
  
  // Fix unquoted property names
  jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
  
  // Fix incomplete boolean values
  jsonStr = jsonStr.replace(/:\s*tru$/gm, ': true')
  jsonStr = jsonStr.replace(/:\s*fals$/gm, ': false')
  jsonStr = jsonStr.replace(/:\s*nul$/gm, ': null')
  
  // Fix incomplete strings (add closing quotes)
  jsonStr = jsonStr.replace(/"([^"]*?)$/gm, '"$1"')
  
  // Fix specific truncation patterns we're seeing
  jsonStr = jsonStr.replace(/:\s*"?confiden?c?e?$/gm, ': 0.8')
  jsonStr = jsonStr.replace(/:\s*"?actionability_scor?e?$/gm, ': 0.5')
  jsonStr = jsonStr.replace(/:\s*"?key_theme?s?$/gm, ': ["general"]')
  jsonStr = jsonStr.replace(/:\s*"?has_catalys?t?$/gm, ': false')
  jsonStr = jsonStr.replace(/:\s*"?reasonin?g?$/gm, ': "Analysis incomplete"')
  
  // Fix truncated field names (the main issue we're seeing)
  jsonStr = jsonStr.replace(/"confiden?c?e?$/gm, '"confidence": 0.8')
  jsonStr = jsonStr.replace(/"confide?$/gm, '"confidence": 0.8')
  jsonStr = jsonStr.replace(/"actionability_scor?e?$/gm, '"actionability_score": 0.5')
  jsonStr = jsonStr.replace(/"key_theme?s?$/gm, '"key_themes": ["general"]')
  jsonStr = jsonStr.replace(/"has_catalys?t?$/gm, '"has_catalyst": false')
  jsonStr = jsonStr.replace(/"reasonin?g?$/gm, '"reasoning": "Analysis incomplete"')
  jsonStr = jsonStr.replace(/"sentiment_scor?e?$/gm, '"sentiment_score": 0.0')
  jsonStr = jsonStr.replace(/"sentiment_labe?l?$/gm, '"sentiment_label": "neutral"')
  
  // Handle incomplete objects at the end more aggressively
  const lastCompleteObject = jsonStr.lastIndexOf('}')
  if (lastCompleteObject > 0) {
    const afterLastObject = jsonStr.substring(lastCompleteObject + 1).trim()
    if (afterLastObject && !afterLastObject.startsWith(']')) {
      // Check if there's an incomplete object after the last complete one
      const incompleteStart = jsonStr.indexOf('{', lastCompleteObject + 1)
      if (incompleteStart > 0) {
        // Remove the incomplete object and close the array
        jsonStr = jsonStr.substring(0, lastCompleteObject + 1) + ']'
      } else {
        // Just close the array if no incomplete object
        jsonStr = jsonStr.substring(0, lastCompleteObject + 1) + ']'
      }
    }
  }
  
  // Ensure the JSON ends with a proper array closing
  if (!jsonStr.trim().endsWith(']') && !jsonStr.trim().endsWith('}')) {
    if (jsonStr.includes('[')) {
      jsonStr = jsonStr.trim() + ']'
    }
  }
  
  return jsonStr
}

/**
 * Extract partial JSON objects when full parsing fails
 */
function extractPartialJson(response: string): LLMPostAnalysis[] {
  const results: LLMPostAnalysis[] = []
  
  try {
    // Find individual JSON objects using regex
    const objectRegex = /\{[^{}]*"ticker"[^{}]*\}/g
    const matches = response.match(objectRegex) || []
    
    console.log(`🔧 [LLM] Attempting to extract ${matches.length} partial objects`)
    
    for (const match of matches) {
      try {
        let cleanMatch = fixCommonJsonIssues(match)
        const obj = JSON.parse(cleanMatch)
        results.push(validateAnalysis(obj))
      } catch (err) {
        console.warn('⚠️ [LLM] Failed to parse partial object:', match.substring(0, 100))
      }
    }
    
    console.log(`✅ [LLM] Extracted ${results.length} valid objects from partial parsing`)
    return results
    
  } catch (error) {
    console.error('❌ [LLM] Partial extraction failed:', error)
    return []
  }
}

/**
 * Extract partial JSON objects from response when complete parsing fails
 */
function extractPartialJsonObjects(response: string, expectedCount: number): LLMPostAnalysis[] {
  try {
    console.log(`🔧 [LLM] Attempting to extract ${expectedCount} partial objects`)
    
    // Find all potential JSON objects in the response
    const objectPattern = /\{[\s\S]*?\}/g
    const matches = response.match(objectPattern) || []
    
    const results: LLMPostAnalysis[] = []
    
    for (const match of matches) {
      try {
        let cleanMatch = fixCommonJsonIssues(match)
        const obj = JSON.parse(cleanMatch)
        results.push(validateAnalysis(obj))
      } catch (err) {
        console.warn('⚠️ [LLM] Failed to parse partial object:', match.substring(0, 100))
      }
    }
    
    console.log(`✅ [LLM] Extracted ${results.length} valid objects from partial parsing`)
    return results
    
  } catch (error) {
    console.error('❌ [LLM] Partial extraction failed:', error)
    return []
  }
}

/**
 * Extract valid JSON portion from a string that has valid JSON followed by invalid content
 */
function extractValidJsonPortion(jsonStr: string, expectedCount: number): LLMPostAnalysis[] {
  try {
    console.log('🔧 [LLM] Attempting to extract valid JSON portion...')
    
    // Try to find complete objects within the JSON string
    const results: LLMPostAnalysis[] = []
    let currentPos = 0
    let bracketDepth = 0
    let inString = false
    let escaped = false
    let objectStart = -1
    
    // Skip the opening bracket
    if (jsonStr[0] === '[') {
      currentPos = 1
    }
    
    for (let i = currentPos; i < jsonStr.length; i++) {
      const char = jsonStr[i]
      
      if (escaped) {
        escaped = false
        continue
      }
      
      if (char === '\\') {
        escaped = true
        continue
      }
      
      if (char === '"') {
        inString = !inString
        continue
      }
      
      if (inString) {
        continue
      }
      
      if (char === '{') {
        if (bracketDepth === 0) {
          objectStart = i
        }
        bracketDepth++
      } else if (char === '}') {
        bracketDepth--
        
        if (bracketDepth === 0 && objectStart >= 0) {
          // Found a complete object
          const objectStr = jsonStr.substring(objectStart, i + 1)
          try {
            const cleanObj = fixCommonJsonIssues(objectStr)
            const obj = JSON.parse(cleanObj)
            results.push(validateAnalysis(obj))
            console.log(`✅ [LLM] Extracted valid object ${results.length}/${expectedCount}`)
          } catch (err) {
            console.warn('⚠️ [LLM] Failed to parse extracted object:', objectStr.substring(0, 100))
          }
          objectStart = -1
        }
      }
      
      // Stop if we've found enough objects
      if (results.length >= expectedCount) {
        break
      }
    }
    
    console.log(`✅ [LLM] Extracted ${results.length} valid objects from JSON portion`)
    return results
    
  } catch (error) {
    console.error('❌ [LLM] Valid portion extraction failed:', error)
    return []
  }
}

/**
 * Validate and sanitize individual analysis
 */
function validateAnalysis(analysis: any): LLMPostAnalysis {
  return {
    ticker: typeof analysis.ticker === 'string' ? analysis.ticker.toUpperCase() : null,
    sentiment_score: Math.max(-1, Math.min(1, Number(analysis.sentiment_score) || 0)),
    sentiment_label: ['positive', 'negative', 'neutral'].includes(analysis.sentiment_label) 
      ? analysis.sentiment_label : 'neutral',
    confidence: Math.max(0, Math.min(1, Number(analysis.confidence) || 0.5)),
    key_themes: Array.isArray(analysis.key_themes) 
      ? analysis.key_themes.slice(0, 3).map(String) : [],
    actionability_score: Math.max(0, Math.min(1, Number(analysis.actionability_score) || 0)),
    has_catalyst: Boolean(analysis.has_catalyst),
    reasoning: String(analysis.reasoning || '').substring(0, 200)
  }
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
 * Process Reddit posts with LLM analysis
 */
export async function processRedditPostsBatch(posts: any[]): Promise<ProcessedPost[]> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ [LLM] No GEMINI_API_KEY found, using fallback analysis for Reddit')
    return posts.map(post => ({
      original: post,
      llm_analysis: getRedditFallbackAnalysis(post),
      processed_at: new Date().toISOString(),
      analysis_version: '1.0-fallback'
    }))
  }

  try {
    console.log(`🤖 [LLM] Processing batch of ${posts.length} Reddit posts...`)
    
    const model = getGenAI().getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.1
      }
    })
    
    const prompt = buildRedditBatchPrompt(posts)
    
    const result = await model.generateContent(prompt)
    const response = result.response.text()
    
    console.log(`🤖 [LLM] Raw Reddit response length: ${response.length} chars`)
    
    // Parse JSON response
    const analyses = parseGeminiResponse(response, posts.length)
    
    if (analyses.length !== posts.length) {
      console.warn(`⚠️ [LLM] Reddit analysis count mismatch: got ${analyses.length}, expected ${posts.length}`)
    }
    
    // Combine posts with analyses
    const processedPosts: ProcessedPost[] = posts.map((post, index) => ({
      original: post,
      llm_analysis: analyses[index] || getRedditFallbackAnalysis(post),
      processed_at: new Date().toISOString(),
      analysis_version: '1.0-gemini-reddit'
    }))
    
    console.log(`✅ [LLM] Successfully processed ${processedPosts.length} Reddit posts`)
    
    return processedPosts
    
  } catch (error) {
    console.error('❌ [LLM] Error processing Reddit posts batch:', error)
    
    // Return fallback analyses
    return posts.map(post => ({
      original: post,
      llm_analysis: getRedditFallbackAnalysis(post),
      processed_at: new Date().toISOString(),
      analysis_version: '1.0-fallback'
    }))
  }
}

/**
 * Build optimized prompt for Reddit posts
 */
function buildRedditBatchPrompt(posts: any[]): string {
  const postTexts = posts.map((post, index) => {
    // Limit content to avoid response truncation
    const content = `${post.title}`.trim() // Only use title to minimize tokens
    return `${index}: ${content}`
  }).join('\n')
  
  return `Analyze Reddit posts. Return JSON array with ${posts.length} objects:

${postTexts}

Format: [{"ticker":"AAPL","sentiment_score":0.5,"sentiment_label":"positive","confidence":0.8,"key_themes":["news"],"actionability_score":0.7,"has_catalyst":true,"reasoning":"Brief"}]

Return ONLY JSON array.`
}

/**
 * Fallback analysis for Reddit posts when LLM is unavailable
 */
function getRedditFallbackAnalysis(post: any): LLMPostAnalysis {
  const content = `${post.title} ${post.selftext || ''}`
  
  // Simple keyword-based ticker extraction
  const tickerMatch = content.match(/\$([A-Z]{1,5})\b/)
  const ticker = tickerMatch ? tickerMatch[1] : null
  
  // Basic sentiment keywords for Reddit
  const positiveWords = ['bullish', 'moon', 'rocket', 'buy', 'calls', 'DD', 'undervalued']
  const negativeWords = ['bearish', 'puts', 'overvalued', 'crash', 'dump', 'short']
  
  const lowerContent = content.toLowerCase()
  const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length
  const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length
  
  let sentiment_score = 0
  let sentiment_label: 'positive' | 'negative' | 'neutral' = 'neutral'
  
  if (positiveCount > negativeCount) {
    sentiment_score = 0.3
    sentiment_label = 'positive'
  } else if (negativeCount > positiveCount) {
    sentiment_score = -0.3
    sentiment_label = 'negative'
  }
  
  // Reddit posts tend to be more analytical, so higher base actionability
  const hasNumbers = /\$?\d+(\.\d+)?/.test(content)
  const hasAnalysis = /DD|due diligence|analysis|target|PT/i.test(content)
  
  return {
    ticker,
    sentiment_score,
    sentiment_label,
    confidence: 0.4, // Lower confidence for fallback
    key_themes: hasAnalysis ? ['analysis'] : ['discussion'],
    actionability_score: ticker && (hasNumbers || hasAnalysis) ? 0.4 : 0.1,
    has_catalyst: /earnings|guidance|fda|contract|merger|acquisition/i.test(lowerContent),
    reasoning: 'Reddit fallback keyword-based analysis'
  }
}

/**
 * Cost estimation helper
 */
export function estimateBatchCost(postCount: number): { tokens: number, cost: number } {
  // Rough estimates for batch processing
  const inputTokensPerPost = 50  // Average post length
  const outputTokensPerPost = 100 // JSON response per post
  const instructionTokens = 500   // Prompt overhead
  
  const totalInputTokens = (postCount * inputTokensPerPost) + instructionTokens
  const totalOutputTokens = postCount * outputTokensPerPost
  
  // Gemini 2.0 Flash pricing (as of late 2024)
  const inputCostPer1M = 0.075  // $0.075 per 1M input tokens
  const outputCostPer1M = 0.30  // $0.30 per 1M output tokens
  
  const cost = (totalInputTokens / 1000000 * inputCostPer1M) + 
               (totalOutputTokens / 1000000 * outputCostPer1M)
  
  return {
    tokens: totalInputTokens + totalOutputTokens,
    cost: Math.round(cost * 100000) / 100000 // Round to 5 decimal places
  }
}
