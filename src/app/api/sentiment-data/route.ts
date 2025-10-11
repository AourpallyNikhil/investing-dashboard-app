import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (lazy initialization to avoid build errors)
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

interface RedditPostData {
  id: string;
  title: string;
  selftext: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  url: string;
  permalink: string;
  subreddit: string;
}

interface TwitterPostData {
  tweet_id: string;
  text: string;
  author: string;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  url: string;
  created_at: string;
  // Actionable tweet scoring fields
  score?: number;
  velocity_z?: number;
  authors_60m?: number;
  actionability_score?: number;
  catalyst_score?: number;
  author_novelty?: number;
  time_decay?: number;
  tickers?: string[];
  follower_count?: number;
}

interface SentimentResponse {
  data: SentimentDataPoint[];
  topPosts?: RedditPostData[];
  twitterPosts?: TwitterPostData[];
  sources: string[];
  lastUpdated: string;
  fromCache: boolean;
  cacheAge?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source'); // 'reddit', 'twitter', or 'all'
    const timeframe = searchParams.get('timeframe') || '24h'; // 24h, 7d, 30d

    console.log('📊 Fetching sentiment data from database...');

    // Always get data from database (populated by cron job)
    const cachedData = await getCachedSentimentData(source, timeframe);
    if (cachedData) {
      console.log('✅ Returning sentiment data from database');
      return NextResponse.json(cachedData);
    }

    // If no cached data exists, return fallback mock data with instructions
    console.log('📊 No cached data found, returning fallback mock data');
    return NextResponse.json({
      data: generateFallbackSentimentData(),
      topPosts: generateFallbackRedditPosts(),
      sources: ['Mock data - Real data will be available after the daily cron job runs'],
      lastUpdated: new Date().toISOString().split('T')[0],
      fromCache: false,
      message: 'No real sentiment data available yet. The cron job runs daily to fetch fresh data.'
    });

  } catch (error) {
    console.error('❌ Error in sentiment data API:', error);
    
    // Try to return any available cached data as fallback
    const cachedData = await getCachedSentimentData();
    if (cachedData) {
      console.log('⚠️ Returning cached data due to API error');
      return NextResponse.json({ ...cachedData, fromCache: true });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch sentiment data' },
      { status: 500 }
    );
  }
}



async function analyzeSentimentWithLLM(tickerData: any[], topRedditPosts: any[]): Promise<{ sentimentData: SentimentDataPoint[], topPosts: any[] }> {
  // Initialize Gemini Flash for sentiment analysis
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  
  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not found, falling back to keyword-based analysis');
    return {
      sentimentData: await analyzeSentimentFallback(tickerData),
      topPosts: topRedditPosts
    };
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const sentimentResults = [];

  for (const item of tickerData) {
    try {
      const allContexts = [...item.reddit.contexts, ...item.twitter.contexts];
      
      // Create a comprehensive prompt for LLM sentiment analysis
      const sentimentPrompt = `
You are a financial sentiment analyst. Analyze the following social media discussions about the stock ticker "${item.ticker}".

SOCIAL MEDIA CONTEXTS:
${allContexts.map((context, idx) => `${idx + 1}. ${context}`).join('\n')}

Please provide a JSON response with the following structure:
{
  "sentiment_score": <number between -1 and 1, where -1 is very bearish, 0 is neutral, 1 is very bullish>,
  "sentiment_label": <"positive", "negative", or "neutral">,
  "confidence": <number between 0 and 1 indicating confidence in the analysis>,
  "key_themes": [<array of 3-5 main themes or topics discussed>],
  "summary": "<2-3 sentence summary of the overall sentiment and key points>"
}

Consider:
- Financial terminology (calls, puts, earnings, etc.)
- Market sentiment indicators (moon, rocket, crash, dump, etc.)
- Fundamental analysis mentions (undervalued, overvalued, etc.)
- Options activity and trading sentiment
- Overall tone and context of discussions

Respond only with valid JSON.`;

      const result = await model.generateContent(sentimentPrompt);
      const response = await result.response;
      const text = response.text();

      let analysis;
      try {
        // Clean the response to extract JSON and fix common issues
        let jsonText = text;
        
        // Remove markdown code blocks if present
        jsonText = jsonText.replace(/```json\s*|\s*```/g, '');
        
        // Extract JSON object
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
        
        // Fix trailing commas before closing braces/brackets
        jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
        
        analysis = JSON.parse(jsonText);
      } catch (parseError) {
        console.error(`Failed to parse LLM response for ${item.ticker}:`, text);
        // Fallback to neutral sentiment
        analysis = {
          sentiment_score: 0,
          sentiment_label: 'neutral',
          confidence: 0.5,
          key_themes: ['Unable to analyze'],
          summary: 'Analysis unavailable due to parsing error'
        };
      }

      sentimentResults.push({
        ticker: item.ticker,
        sentiment_score: Math.round((analysis.sentiment_score || 0) * 1000) / 1000,
        sentiment_label: analysis.sentiment_label || 'neutral',
        mention_count: item.reddit.mentions + item.twitter.mentions,
        confidence: analysis.confidence || 0.5,
        key_themes: analysis.key_themes || [],
        summary: analysis.summary || '',
        source_breakdown: {
          reddit: {
            mentions: item.reddit.mentions,
            avg_sentiment: analysis.sentiment_score || 0
          },
          twitter: {
            mentions: item.twitter.mentions,
            avg_sentiment: analysis.sentiment_score || 0
          }
        },
        trending_contexts: allContexts.slice(0, 3),
        last_updated: new Date().toISOString()
      });

      // Add small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`Error analyzing sentiment for ${item.ticker}:`, error);
      
      // Fallback sentiment analysis
      sentimentResults.push({
        ticker: item.ticker,
        sentiment_score: 0,
        sentiment_label: 'neutral' as const,
        mention_count: item.reddit.mentions + item.twitter.mentions,
        confidence: 0.3,
        key_themes: ['Analysis failed'],
        summary: 'Sentiment analysis temporarily unavailable',
        source_breakdown: {
          reddit: {
            mentions: item.reddit.mentions,
            avg_sentiment: 0
          },
          twitter: {
            mentions: item.twitter.mentions,
            avg_sentiment: 0
          }
        },
        trending_contexts: [...item.reddit.contexts, ...item.twitter.contexts].slice(0, 3),
        last_updated: new Date().toISOString()
      });
    }
  }

  const filteredResults = sentimentResults
    .filter(item => item.mention_count >= 2)
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, 50);

  return {
    sentimentData: filteredResults,
    topPosts: topRedditPosts
  };
}

// Fallback function for when Gemini API is not available
async function analyzeSentimentFallback(tickerData: any[]): Promise<SentimentDataPoint[]> {
  return tickerData.map(item => {
    const allContexts = [...item.reddit.contexts, ...item.twitter.contexts];
    
    let sentimentScore = 0;
    let positiveWords = 0;
    let negativeWords = 0;

    const positiveKeywords = [
      'bullish', 'moon', 'rocket', 'buy', 'long', 'calls', 'pump', 'green', 'gains',
      'breakout', 'rally', 'strong', 'growth', 'opportunity', 'undervalued'
    ];

    const negativeKeywords = [
      'bearish', 'crash', 'dump', 'sell', 'short', 'puts', 'red', 'loss', 'drop',
      'decline', 'weak', 'overvalued', 'bubble', 'risk', 'warning'
    ];

    allContexts.forEach(context => {
      const lowerContext = context.toLowerCase();
      
      positiveKeywords.forEach(word => {
        if (lowerContext.includes(word)) positiveWords++;
      });
      
      negativeKeywords.forEach(word => {
        if (lowerContext.includes(word)) negativeWords++;
      });
    });

    const totalWords = positiveWords + negativeWords;
    if (totalWords > 0) {
      sentimentScore = (positiveWords - negativeWords) / totalWords;
    }

    let sentimentLabel: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (sentimentScore > 0.1) sentimentLabel = 'positive';
    else if (sentimentScore < -0.1) sentimentLabel = 'negative';

    return {
      ticker: item.ticker,
      sentiment_score: Math.round(sentimentScore * 1000) / 1000,
      sentiment_label: sentimentLabel,
      mention_count: item.reddit.mentions + item.twitter.mentions,
      confidence: 0.7, // Default confidence for fallback
      key_themes: allContexts.slice(0, 3),
      summary: `${sentimentLabel} sentiment based on ${item.reddit.mentions + item.twitter.mentions} mentions`,
      source_breakdown: {
        reddit: {
          mentions: item.reddit.mentions,
          avg_sentiment: sentimentScore
        },
        twitter: {
          mentions: item.twitter.mentions,
          avg_sentiment: sentimentScore
        }
      },
      trending_contexts: allContexts.slice(0, 3),
      last_updated: new Date().toISOString()
    };
  })
  .filter(item => item.mention_count >= 2)
  .sort((a, b) => b.mention_count - a.mention_count)
  .slice(0, 50);
}

async function getCachedSentimentData(
  source?: string | null,
  timeframe: string = '24h'
): Promise<SentimentResponse | null> {
  try {
    console.log(`📊 Checking for cached sentiment data in database (timeframe: ${timeframe})...`);
    
    const supabase = getSupabaseClient();
    
    // Calculate the date range based on timeframe
    const cutoffDate = new Date();
    switch (timeframe) {
      case '24h':
        cutoffDate.setHours(cutoffDate.getHours() - 24);
        break;
      case '7d':
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        break;
      case '30d':
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        break;
      default:
        cutoffDate.setHours(cutoffDate.getHours() - 24); // Default to 24h
    }
    
    // Query aggregated sentiment data (new system)
    let sentimentData = null;
    let sentimentError = null;
    
    // First try the new aggregations table (exclude GENERAL)
    const { data: aggregatedData, error: aggregatedError } = await supabase
      .from('sentiment_aggregations')
      .select('*')
      .eq('aggregation_period', timeframe)
      .neq('ticker', 'GENERAL') // Exclude GENERAL category
      .gte('calculated_at', cutoffDate.toISOString())
      .order('total_mentions', { ascending: false });
    
    if (!aggregatedError && aggregatedData && aggregatedData.length > 0) {
      console.log(`✅ Found ${aggregatedData.length} aggregated sentiment records`);
      
      // Transform aggregated data to match expected format
      sentimentData = aggregatedData.map(agg => ({
        ticker: agg.ticker,
        sentiment_score: agg.avg_sentiment || 0.0,
        sentiment_label: agg.avg_sentiment > 0.1 ? 'positive' : agg.avg_sentiment < -0.1 ? 'negative' : 'neutral',
        mention_count: agg.total_mentions,
        confidence: 0.85, // Default confidence for aggregated data
        key_themes: ['Aggregated Analysis'], // Placeholder
        summary: `${agg.total_mentions} mentions from ${agg.unique_posts} posts by ${agg.unique_authors} unique authors`,
        source_breakdown: agg.source_breakdown || {
          reddit: { mentions: 0, avg_sentiment: 0 },
          twitter: { mentions: 0, avg_sentiment: 0 }
        },
        trending_contexts: [`${agg.total_upvotes} total upvotes`, `${agg.total_comments} total comments`],
        last_updated: agg.calculated_at
      }));
    } else {
      console.warn('⚠️ No aggregated data found, falling back to old sentiment_data table');
      
      // Fallback to old sentiment_data table
      const { data: oldSentimentData, error: oldSentimentError } = await supabase
        .from('sentiment_data')
        .select('*')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false });
      
      sentimentData = oldSentimentData;
      sentimentError = oldSentimentError;
    }
    
    if (sentimentError) {
      console.error('❌ Error querying sentiment data:', sentimentError);
      return null;
    }
    
    // Query Reddit posts (try both possible table names)
    let postsData = null;
    let postsError = null;
    
    // First try the comprehensive schema table name
    const { data: rawPostsData, error: rawPostsError } = await supabase
      .from('reddit_posts_raw')
      .select('*')
      .gte('retrieved_at', cutoffDate.toISOString())
      .order('retrieved_at', { ascending: false })
      .limit(15);
    
    if (rawPostsError) {
      // If comprehensive schema table doesn't exist, try simple schema
      const { data: simplePostsData, error: simplePostsError } = await supabase
        .from('reddit_posts')
        .select('*')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(15);
      
      postsData = simplePostsData;
      postsError = simplePostsError;
    } else {
      postsData = rawPostsData;
    }
    
    if (postsError) {
      console.error('❌ Error querying reddit_posts:', postsError);
      return null;
    }
    
    if (!sentimentData || sentimentData.length === 0) {
      console.log('📊 No recent cached data found');
      return null;
    }
    
    console.log(`✅ Found cached data: ${sentimentData.length} sentiment records, ${postsData?.length || 0} posts`);
    
    // Transform database data to API format
    const transformedSentimentData = sentimentData.map(item => ({
      ticker: item.ticker,
      sentiment_score: parseFloat(item.sentiment_score),
      sentiment_label: item.sentiment_label,
      mention_count: item.mention_count,
      confidence: parseFloat(item.confidence || '0.8'),
      key_themes: item.key_themes || [],
      summary: item.summary || '',
      source_breakdown: item.source_breakdown || {},
      trending_contexts: item.trending_contexts || [],
      last_updated: item.last_updated || item.created_at
    }));
    
    // Transform posts data (handle both table schemas)
    const transformedPosts = (postsData || []).map(post => ({
      id: post.post_id,
      title: post.title,
      selftext: post.content || post.selftext || '',
      author: post.author,
      score: post.score || 0,
      num_comments: post.num_comments || 0,
      created_utc: post.created_utc,
      url: post.url || post.external_url || '',
      permalink: post.permalink,
      subreddit: post.subreddit
    }));
    
    // Query Twitter posts using actionable tweets ranking
    let twitterPostsData = null;
    
    // First try the actionable tweets view for smart ranking
    const { data: actionableTweets, error: actionableError } = await supabase
      .from('top_actionable_tweets')
      .select(`
        tweet_id, author_username, author_name, text, tickers, created_at, url,
        follower_count, engagement, velocity_z, authors_60m, 
        actionability_score, catalyst_score, author_novelty, time_decay, score
      `)
      .limit(15);
    
    if (!actionableError && actionableTweets && actionableTweets.length > 0) {
      console.log(`✅ Found ${actionableTweets.length} actionable tweets with smart ranking`);
      twitterPostsData = actionableTweets;
    } else {
      console.warn('⚠️ Actionable tweets view not available, falling back to simple query:', actionableError);
      
      // Fallback to simple twitter_posts table
      const { data: rawTwitterPosts, error: twitterError } = await supabase
        .from('twitter_posts')
        .select('*')
        .gte('retrieved_at', cutoffDate.toISOString())
        .order('retrieved_at', { ascending: false })
        .limit(15);
      
      if (twitterError) {
        console.warn('⚠️ Error querying twitter_posts (table may not exist yet):', twitterError);
      } else {
        twitterPostsData = rawTwitterPosts;
      }
    }
    
    // Transform Twitter posts data
    const transformedTwitterPosts = (twitterPostsData || []).map(post => ({
      tweet_id: post.tweet_id,
      text: post.text,
      author: post.author_username || post.author,
      like_count: post.like_count || 0,
      retweet_count: post.retweet_count || 0,
      reply_count: post.reply_count || 0,
      url: post.url,
      created_at: post.created_at,
      // Include actionable scoring if available
      score: post.score,
      velocity_z: post.velocity_z,
      authors_60m: post.authors_60m,
      actionability_score: post.actionability_score,
      catalyst_score: post.catalyst_score,
      author_novelty: post.author_novelty,
      time_decay: post.time_decay,
      tickers: post.tickers,
      follower_count: post.follower_count
    }));
    
    console.log(`✅ Found cached Twitter data: ${transformedTwitterPosts.length} Twitter posts`);
    
    return {
      data: transformedSentimentData,
      topPosts: transformedPosts,
      twitterPosts: transformedTwitterPosts,
      sources: ['Cached Reddit API', 'Cached Twitter API', 'Cached Gemini Flash AI Analysis'],
      lastUpdated: new Date().toISOString().split('T')[0],
      fromCache: true
    };

  } catch (error) {
    console.error('❌ Error fetching cached sentiment data:', error);
    return null;
  }
}

async function saveSentimentDataToDatabase(data: SentimentResponse): Promise<void> {
  try {
    console.log(`💾 Saving ${data.data.length} sentiment data points to database...`);

    const supabase = getSupabaseClient();

    // Clear existing sentiment data (keep only last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    await supabase
      .from('sentiment_data')
      .delete()
      .lt('created_at', sevenDaysAgo.toISOString());

    // Prepare sentiment data for insertion
    const sentimentRows = data.data.map(point => ({
      ticker: point.ticker,
      sentiment_score: point.sentiment_score,
      sentiment_label: point.sentiment_label,
      mention_count: point.mention_count,
      confidence: point.confidence || 0.8,
      key_themes: point.key_themes || [],
      summary: point.summary || '',
      source_breakdown: point.source_breakdown || {},
      trending_contexts: point.trending_contexts || [],
      created_at: new Date().toISOString(),
      last_updated: point.last_updated || new Date().toISOString()
    }));

    // Insert new sentiment data
    console.log(`📊 Inserting ${sentimentRows.length} sentiment records...`);
    console.log('📊 Sample record:', JSON.stringify(sentimentRows[0], null, 2));
    
    const { error: insertError } = await supabase
      .from('sentiment_data')
      .insert(sentimentRows);

    if (insertError) {
      console.error('❌ Error inserting sentiment data:', insertError);
      throw insertError;
    }
    
    console.log(`✅ Successfully saved ${sentimentRows.length} sentiment records to database`);

    // Save top Reddit posts to database
    if (data.topPosts && data.topPosts.length > 0) {
      console.log(`💾 Saving ${data.topPosts.length} Reddit posts to database...`);
      
      // Clear old posts (keep only last 3 days)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const { error: deleteError } = await supabase
        .from('reddit_posts')
        .delete()
        .lt('created_at', threeDaysAgo.toISOString());
      
      if (deleteError) {
        console.warn('⚠️ Error deleting old posts:', deleteError);
      }

      // Prepare Reddit posts for insertion
      const postRows = data.topPosts.map(post => ({
        post_id: post.id,
        title: post.title,
        content: post.selftext || '',
        author: post.author,
        score: post.score || 0,
        num_comments: post.num_comments || 0,
        url: post.url,
        permalink: post.permalink,
        subreddit: post.subreddit,
        created_utc: post.created_utc,
        created_at: new Date().toISOString()
      }));

      console.log(`📊 Inserting ${postRows.length} posts into reddit_posts table...`);
      
      const { error: postsError } = await supabase
        .from('reddit_posts')
        .insert(postRows);

      if (postsError) {
        console.warn('⚠️ Error inserting Reddit posts (non-critical):', postsError);
        // Don't throw - this is non-critical
      } else {
        console.log(`✅ Saved ${data.topPosts.length} Reddit posts to database`);
      }
    }

    console.log(`✅ Successfully saved ${data.data.length} sentiment data points to database`);

  } catch (error) {
    console.error('❌ Error saving sentiment data to database:', error);
    throw error;
  }
}

function generateFallbackSentimentData(): SentimentDataPoint[] {
  const mockTickers = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX'];
  
  return mockTickers.map(ticker => ({
    ticker,
    sentiment_score: (Math.random() - 0.5) * 2, // Random between -1 and 1
    sentiment_label: Math.random() > 0.6 ? 'positive' : Math.random() > 0.3 ? 'neutral' : 'negative',
    mention_count: Math.floor(Math.random() * 50) + 5,
    source_breakdown: {
      reddit: {
        mentions: Math.floor(Math.random() * 30) + 2,
        avg_sentiment: (Math.random() - 0.5) * 2
      },
      twitter: {
        mentions: Math.floor(Math.random() * 20) + 1,
        avg_sentiment: (Math.random() - 0.5) * 2
      }
    },
    trending_contexts: [
      `${ticker} looking strong for Q4 earnings`,
      `Just bought more ${ticker} on this dip`,
      `${ticker} breaking out of resistance`
    ],
    last_updated: new Date().toISOString()
  }));
}

function generateFallbackRedditPosts(): RedditPostData[] {
  const now = Math.floor(Date.now() / 1000);
  
  return [
    {
      id: 'fallback1',
      title: '🚀 TSLA delivery numbers beat expectations - Q4 looking strong',
      selftext: 'Tesla just announced record Q4 deliveries, crushing analyst estimates by 15%. The stock is already up 8% in after-hours trading. This could be the catalyst we\'ve been waiting for! Thoughts on calls for next week?',
      author: 'WSBDegenerate',
      score: 1247,
      num_comments: 89,
      created_utc: now - 3600,
      url: 'https://reddit.com/r/wallstreetbets/fallback1',
      permalink: '/r/wallstreetbets/comments/fallback1/tsla_delivery_numbers_beat/',
      subreddit: 'wallstreetbets'
    },
    {
      id: 'fallback2',
      title: 'NVDA earnings play - AI demand still going strong 💎',
      selftext: 'With AI demand continuing to surge, NVIDIA is positioned perfectly for their upcoming earnings. Data center revenue should be through the roof again. Anyone else loading up on calls?',
      author: 'ChipGuru',
      score: 892,
      num_comments: 134,
      created_utc: now - 7200,
      url: 'https://reddit.com/r/wallstreetbets/fallback2',
      permalink: '/r/wallstreetbets/comments/fallback2/nvda_earnings_play/',
      subreddit: 'wallstreetbets'
    },
    {
      id: 'fallback3',
      title: 'Apple services revenue hitting new records 📈',
      selftext: 'AAPL services business continues to be a cash cow. App Store, iCloud, and Apple Pay revenues are all growing double digits year-over-year. This is why I\'m long AAPL.',
      author: 'AppleFanatic',
      score: 567,
      num_comments: 67,
      created_utc: now - 10800,
      url: 'https://reddit.com/r/investing/fallback3',
      permalink: '/r/investing/comments/fallback3/apple_services_revenue/',
      subreddit: 'investing'
    },
    {
      id: 'fallback4',
      title: 'Microsoft Azure growth accelerating - cloud wars heating up ☁️',
      selftext: 'MSFT cloud business is firing on all cylinders. Azure revenue up 30% YoY and gaining market share against AWS. This is a long-term winner in my portfolio.',
      author: 'CloudInvestor',
      score: 423,
      num_comments: 45,
      created_utc: now - 14400,
      url: 'https://reddit.com/r/investing/fallback4',
      permalink: '/r/investing/comments/fallback4/microsoft_azure_growth/',
      subreddit: 'investing'
    },
    {
      id: 'fallback5',
      title: 'AMD vs Intel - the battle for server market share continues',
      selftext: 'AMD continues to take server market share from Intel. Their new EPYC chips are outperforming Intel in both performance and efficiency. Worth considering for a tech play.',
      author: 'SemiconductorAnalyst',
      score: 334,
      num_comments: 78,
      created_utc: now - 18000,
      url: 'https://reddit.com/r/stocks/fallback5',
      permalink: '/r/stocks/comments/fallback5/amd_vs_intel_battle/',
      subreddit: 'stocks'
    }
  ];
}

// POST endpoint for manual refresh
export async function POST(request: NextRequest) {
  console.log('🔄 Manual sentiment data refresh requested');
  const url = new URL(request.url);
  url.searchParams.set('refresh', 'true');
  
  const newRequest = new NextRequest(url, {
    method: 'GET',
    headers: request.headers,
  });
  
  return GET(newRequest);
}
