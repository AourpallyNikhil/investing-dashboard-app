import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'

// Zod schema for sentiment analysis
const SentimentAnalysisSchema = z.object({
  sentiment_score: z.number().min(-1).max(1),
  sentiment_label: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
  key_themes: z.array(z.string()),
  summary: z.string()
})

interface SentimentDataPoint {
  ticker: string;
  sentiment_score: number;
  sentiment_label: string;
  mention_count: number;
  confidence?: number;
  key_themes?: string[];
  summary?: string;
  source_breakdown: {
    reddit: { mentions: number; avg_sentiment: number };
    twitter: { mentions: number; avg_sentiment: number };
  };
  trending_contexts?: string[];
  last_updated?: string;
}

/**
 * Analyze sentiment using OpenAI GPT-4o-mini with Structured Outputs
 */
export async function analyzeSentimentWithLLM(tickerData: any[], topRedditPosts: any[]): Promise<{ sentimentData: SentimentDataPoint[], topPosts: any[] }> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not found, falling back to keyword-based analysis');
    return {
      sentimentData: await analyzeSentimentFallback(tickerData),
      topPosts: topRedditPosts
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const sentimentResults = [];

  for (const item of tickerData) {
    try {
      const allContexts = [...item.reddit.contexts, ...item.twitter.contexts];
      
      // Create a comprehensive prompt for LLM sentiment analysis
      const sentimentPrompt = `Analyze the following social media discussions about the stock ticker "${item.ticker}".

SOCIAL MEDIA CONTEXTS:
${allContexts.map((context, idx) => `${idx + 1}. ${context}`).join('\n')}

Consider:
- Financial terminology (calls, puts, earnings, etc.)
- Market sentiment indicators (moon, rocket, crash, dump, etc.)
- Fundamental analysis mentions (undervalued, overvalued, etc.)
- Options activity and trading sentiment
- Overall tone and context of discussions

Provide:
- sentiment_score: number between -1 (very bearish) and 1 (very bullish)
- sentiment_label: "positive", "negative", or "neutral"
- confidence: number between 0 and 1
- key_themes: array of 3-5 main themes
- summary: 2-3 sentence summary`;

      const completion = await openai.beta.chat.completions.parse({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a financial sentiment analyst analyzing social media discussions about stocks.' },
          { role: 'user', content: sentimentPrompt }
        ],
        response_format: zodResponseFormat(SentimentAnalysisSchema, 'sentiment_analysis'),
        temperature: 0.1
      });

      const llmAnalysis = completion.choices[0].message.parsed
      
      if (!llmAnalysis) {
        throw new Error('Failed to parse OpenAI response')
      }

      // Calculate mention counts
      const redditMentions = item.reddit.mentions || 0;
      const twitterMentions = item.twitter.mentions || 0;
      const totalMentions = redditMentions + twitterMentions;

      if (totalMentions === 0) continue; // Skip tickers with no mentions

      // Calculate weighted sentiment scores
      const redditSentiment = item.reddit.sentiment || 0;
      const twitterSentiment = item.twitter.sentiment || 0;
      
      const weightedSentiment = totalMentions > 0 
        ? ((redditMentions * redditSentiment) + (twitterMentions * twitterSentiment)) / totalMentions
        : 0;

      // Combine LLM analysis with calculated metrics
      const sentimentPoint: SentimentDataPoint = {
        ticker: item.ticker,
        sentiment_score: llmAnalysis.sentiment_score || weightedSentiment,
        sentiment_label: llmAnalysis.sentiment_label || (weightedSentiment > 0.1 ? 'positive' : weightedSentiment < -0.1 ? 'negative' : 'neutral'),
        mention_count: totalMentions,
        confidence: llmAnalysis.confidence || 0.8,
        key_themes: llmAnalysis.key_themes || [],
        summary: llmAnalysis.summary || `${item.ticker} mentioned ${totalMentions} times across social media.`,
        source_breakdown: {
          reddit: { 
            mentions: redditMentions, 
            avg_sentiment: redditSentiment 
          },
          twitter: { 
            mentions: twitterMentions, 
            avg_sentiment: twitterSentiment 
          }
        },
        trending_contexts: allContexts.slice(0, 5), // Top 5 contexts
        last_updated: new Date().toISOString()
      };

      sentimentResults.push(sentimentPoint);

      // Rate limiting to avoid API limits
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`Error analyzing sentiment for ${item.ticker}:`, error);
      
      // Fallback to basic analysis for this ticker
      const fallbackResults = await analyzeSentimentFallback([item]);
      if (fallbackResults.length > 0) {
        sentimentResults.push(fallbackResults[0]);
      }
    }
  }

  // Sort by mention count and sentiment strength
  sentimentResults.sort((a, b) => {
    const scoreA = Math.abs(a.sentiment_score) * a.mention_count;
    const scoreB = Math.abs(b.sentiment_score) * b.mention_count;
    return scoreB - scoreA;
  });

  console.log(`🤖 LLM analyzed sentiment for ${sentimentResults.length} tickers`);

  return {
    sentimentData: sentimentResults,
    topPosts: topRedditPosts
  };
}

/**
 * Fallback sentiment analysis using keyword-based approach
 */
async function analyzeSentimentFallback(tickerData: any[]): Promise<SentimentDataPoint[]> {
  const sentimentResults: SentimentDataPoint[] = [];

  // Simple keyword-based sentiment scoring
  const positiveKeywords = ['bullish', 'moon', 'rocket', 'buy', 'calls', 'long', 'pump', 'up', 'green', 'gains'];
  const negativeKeywords = ['bearish', 'crash', 'dump', 'sell', 'puts', 'short', 'down', 'red', 'loss'];

  for (const item of tickerData) {
    const allContexts = [...item.reddit.contexts, ...item.twitter.contexts];
    const contextText = allContexts.join(' ').toLowerCase();

    let positiveScore = 0;
    let negativeScore = 0;

    positiveKeywords.forEach(keyword => {
      const matches = (contextText.match(new RegExp(keyword, 'g')) || []).length;
      positiveScore += matches;
    });

    negativeKeywords.forEach(keyword => {
      const matches = (contextText.match(new RegExp(keyword, 'g')) || []).length;
      negativeScore += matches;
    });

    const totalKeywords = positiveScore + negativeScore;
    const sentimentScore = totalKeywords > 0 
      ? (positiveScore - negativeScore) / totalKeywords
      : 0;

    const redditMentions = item.reddit.mentions || 0;
    const twitterMentions = item.twitter.mentions || 0;
    const totalMentions = redditMentions + twitterMentions;

    if (totalMentions === 0) continue;

    const sentimentPoint: SentimentDataPoint = {
      ticker: item.ticker,
      sentiment_score: Math.max(-1, Math.min(1, sentimentScore)), // Clamp between -1 and 1
      sentiment_label: sentimentScore > 0.1 ? 'positive' : sentimentScore < -0.1 ? 'negative' : 'neutral',
      mention_count: totalMentions,
      confidence: 0.6, // Lower confidence for keyword-based analysis
      key_themes: ['keyword-based analysis'],
      summary: `${item.ticker} mentioned ${totalMentions} times with ${sentimentScore > 0 ? 'positive' : sentimentScore < 0 ? 'negative' : 'neutral'} sentiment.`,
      source_breakdown: {
        reddit: { 
          mentions: redditMentions, 
          avg_sentiment: item.reddit.sentiment || 0
        },
        twitter: { 
          mentions: twitterMentions, 
          avg_sentiment: item.twitter.sentiment || 0
        }
      },
      trending_contexts: allContexts.slice(0, 5),
      last_updated: new Date().toISOString()
    };

    sentimentResults.push(sentimentPoint);
  }

  return sentimentResults;
}


