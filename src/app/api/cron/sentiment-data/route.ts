import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { redditRSSAPI } from '@/lib/reddit-rss'
import { RedditAPI } from '@/lib/reddit-api'
import { TwitterAPI } from '@/lib/twitter-api'
import { analyzeSentimentWithLLM } from '@/lib/sentiment-llm'
import { saveRawRedditPostsWithLLM, saveRawTwitterPostsWithLLM } from '@/lib/enhanced-llm-ingestion'

// Initialize Supabase client (lazy initialization to avoid build errors)
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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

interface SentimentResponse {
  data: SentimentDataPoint[];
  topPosts?: RedditPostData[];
  rawRedditPosts?: RawRedditPost[];
  rawRedditComments?: RawRedditComment[];
  rawTwitterPosts?: any[];
  sources: string[];
  lastUpdated: string;
  fromCache: boolean;
  cacheAge?: string;
}

interface RawRedditPost {
  // Reddit identifiers
  id: string;
  name?: string; // fullname
  
  // Post content
  title: string;
  selftext: string;
  selftext_html?: string;
  
  // Author info
  author: string;
  author_fullname?: string;
  author_flair_text?: string;
  
  // Subreddit info
  subreddit: string;
  subreddit_id?: string;
  subreddit_name_prefixed?: string;
  
  // Engagement metrics
  score: number;
  upvote_ratio?: number;
  ups?: number;
  downs?: number;
  num_comments: number;
  
  // Post metadata
  created_utc: number;
  edited?: boolean;
  distinguished?: string;
  stickied?: boolean;
  locked?: boolean;
  archived?: boolean;
  
  // URLs and links
  url: string;
  permalink: string;
  shortlink?: string;
  thumbnail?: string;
  
  // Post classification
  post_hint?: string;
  domain?: string;
  is_self?: boolean;
  is_video?: boolean;
  over_18?: boolean;
  
  // Awards
  total_awards_received?: number;
  gilded?: number;
  all_awardings?: any[];
  
  // Flair
  link_flair_text?: string;
  link_flair_css_class?: string;
  
  // Raw data
  raw_json?: any;
}

interface RawRedditComment {
  // Reddit identifiers
  id: string;
  name?: string; // fullname
  post_id: string;
  parent_id?: string;
  
  // Comment content
  body: string;
  body_html?: string;
  
  // Author info
  author: string;
  author_fullname?: string;
  author_flair_text?: string;
  
  // Engagement metrics
  score: number;
  ups?: number;
  downs?: number;
  controversiality?: number;
  
  // Comment metadata
  created_utc: number;
  edited?: boolean;
  distinguished?: string;
  stickied?: boolean;
  depth?: number;
  
  // Comment classification
  is_submitter?: boolean;
  score_hidden?: boolean;
  archived?: boolean;
  locked?: boolean;
  
  // Awards
  total_awards_received?: number;
  gilded?: number;
  all_awardings?: any[];
  
  // Raw data
  raw_json?: any;
}

/**
 * Cron job endpoint for fetching and saving sentiment data
 * This should be called daily by a scheduler (pg_cron, GitHub Actions, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🤖 [CRON] ========== SENTIMENT DATA FETCH STARTED ==========')
    console.log('🤖 [CRON] Timestamp:', new Date().toISOString())
    console.log('🤖 [CRON] Request URL:', request.url)
    console.log('🤖 [CRON] Request method:', request.method)
    
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    console.log('🔐 [CRON] Auth header present:', !!authHeader)
    console.log('🔐 [CRON] Cron secret present:', !!cronSecret)
    console.log('🔐 [CRON] Auth header value:', authHeader?.substring(0, 20) + '...')
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ [CRON] Unauthorized cron request')
      console.error('❌ [CRON] Expected:', `Bearer ${cronSecret}`)
      console.error('❌ [CRON] Received:', authHeader)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('✅ [CRON] Authorization successful, proceeding with data fetch...')

    // Fetch fresh sentiment data
    const sentimentData = await fetchSentimentData()
    
    // Save to database
    console.log('💾 [CRON] About to save sentiment data to database...')
    await saveSentimentDataToDatabase(sentimentData)
    console.log('💾 [CRON] Database save operation completed')
    
    // NOTE: Aggregations now happen automatically in real-time during LLM processing
    console.log('✅ [CRON] Real-time aggregations will be handled by LLM processing functions')
    
    console.log('✅ [CRON] Daily sentiment data fetch completed successfully')
    console.log('🤖 [CRON] ========== SENTIMENT DATA FETCH COMPLETED ==========')
    
    const response = {
      success: true,
      message: 'Sentiment data fetched and saved successfully',
      dataPoints: sentimentData.data.length,
      topPosts: sentimentData.topPosts?.length || 0,
      timestamp: new Date().toISOString()
    }
    
    console.log('📤 [CRON] Returning response:', JSON.stringify(response, null, 2))
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ [CRON] Error in daily sentiment fetch:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch sentiment data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * Fetch fresh sentiment data from all sources
 */
async function fetchSentimentData(): Promise<SentimentResponse> {
  try {
    const timeframe = '24h'
    const hours = 24
    
    console.log('📊 [CRON] Fetching sentiment data for last 24 hours')

    // Default subreddits and Twitter accounts to monitor
    const subreddits = ['wallstreetbets', 'investing', 'stocks', 'StockMarket', 'ValueInvesting']
    
    // Top 50 Most Followed Stock Trading Influencers on X (Twitter)
    const twitterAccounts = [
      // Top tier influencers (1M+ followers)
      'paulkrugman',      // Paul Krugman - Nobel laureate economist
      'stoolpresidente',  // Dave Portnoy - Barstool Sports founder
      'jimcramer',        // Jim Cramer - CNBC Mad Money host
      'CathieDWood',      // Cathie Wood - ARK Invest CEO
      
      // High-influence analysts and strategists (500K+ followers)
      'elerianm',         // Mohamed A. El-Erian - Economist
      'charliebilello',   // Charlie Bilello - Chief Market Strategist
      'sjosephburns',     // Steve Burns - Veteran trader
      'markminervini',    // Mark Minervini - Champion trader
      'PeterLBrandt',     // Peter L. Brandt - Legendary trader
      'I_Am_The_ICT',     // ICT - Trading mentor
      'profgalloway',     // Scott Galloway - NYU professor
      'BrianFeroldi',     // Brian Feroldi - Stock educator
      'morganhousel',     // Morgan Housel - Author
      'LizAnnSonders',    // Liz Ann Sonders - Charles Schwab strategist
      
      // Mid-tier influencers (100K-500K followers)
      'iancassel',        // Ian Cassel - Microcap investor
      'benthompson',      // Ben Thompson - Stratechery founder
      'deepakshenoy',     // Deepak Shenoy - Capitalmind CEO
      'ajay_bagga',       // Ajay Bagga - Market expert
      'InvestorsLive',    // Nathan Michaud - Day trader
      'Ritholtz',         // Barry Ritholtz - CIO at Ritholtz Wealth
      'RedDogT3',         // Scott Redler - T3Live strategist
      'grahamstephan',    // Graham Stephan - Investor and YouTuber
      'michaelbatnick',   // Michael Batnick - Irrelevant Investor
      'JC_ParetsX',       // J.C. Parets - All Star Charts founder
      'timothysykes',     // Timothy Sykes - Penny stock guru
      
      // Emerging and specialized influencers (50K-130K followers)
      'arunstockguru',    // Arun Stock Guru - Startup mentor
      'iDesignStrategy',  // iDesignStrategy - Web3 and AI investor
      'investmenttalkk',  // Investment Talk - Finance writer
      'olvelez007',       // Oliver Velez - Pro trader
      'kenangrace',       // Kenan Grace - Stock market YouTuber
      'ScarfaceTrades_',  // Scarface Trades - Day trader
      'harmongreg',       // Greg Harmon - Dragonfly Capital president
      'EdwardXLreal',     // EdwardXL - Funded trader mentor
      'lti_finance',      // LTI Finance - Finance poster
      'gunavanthvaid',    // Gunavanth Vaid - CA and microcap investor
      'waltervannelli',   // Walter Vannelli - Forex and stock trader
      'petermallouk',     // Peter Mallouk - CEO of Creative Planning
      'value_invest12',   // Value Invest - Long-term investor
      'emz_nolimits_',    // Emz Nolimits - Currency trader
      '98_Rahat',         // Rahat - Experienced trader
      'emmetlsavage',     // Emmet Savage - MyWallSt co-founder
      'the_real_fly',     // The Real Fly - Market commentator
      'markflowchatter',  // Mark Lehman - Flow trader
      'optioneer18',      // Joe Kunkle - Options analyst
      'thejasonmoser',    // Jason Moser - Motley Fool analyst
      'EarningsWhisper',  // Earnings Whisper - Earnings calendar
      'Newsquawk',        // Newsquawk - Real-time market news
      'vicniederhoffer',  // Vic Niederhoffer - Trend trader
      'bespokeinvest',    // Bespoke Investment - Research firm
      'StockTwits'        // StockTwits - Social platform for traders
    ]

    let redditTickers: any[] = []
    let twitterTickers: any[] = []
    let topRedditPosts: RedditPostData[] = []
    let rawRedditPosts: RawRedditPost[] = []
    let rawRedditComments: RawRedditComment[] = []

    // Fetch Reddit data
    console.log('📱 [CRON] Fetching Reddit sentiment data via RSS...')
    
    try {
      // Try RSS first (no rate limits)
      redditTickers = await redditRSSAPI.getTrendingTickers(subreddits, hours)
      
      // Also fetch top posts for the carousel using RSS
      console.log('📱 [CRON] Fetching top Reddit posts for carousel via RSS...')
      const rssTopPosts = await redditRSSAPI.getTopPosts(subreddits, 15)
      
      // Convert RSS posts to our format
      topRedditPosts = rssTopPosts.map(post => ({
        id: post.id,
        title: post.title,
        selftext: post.content,
        author: post.author,
        score: 0, // RSS doesn't provide scores
        num_comments: 0, // RSS doesn't provide comment counts
        created_utc: post.created_utc,
        url: post.url,
        permalink: post.permalink,
        subreddit: post.subreddit
      }))
      
      console.log(`📱 [CRON] Collected ${topRedditPosts.length} top Reddit posts via RSS`)
      
    } catch (error) {
      console.error('❌ [CRON] Reddit RSS failed, trying JSON API fallback:', error)
      
      // Fallback to original API
      const redditAPI = new RedditAPI()
      redditTickers = await redditAPI.getTrendingTickers(subreddits, hours)
      
      try {
        const redditResults = await redditAPI.fetchMultipleSubreddits(subreddits, {
          sort: 'hot',
          limit: 10,
          timeframe: 'day'
        })
        
        // Collect and sort all posts by score
        const allPosts: RedditPostData[] = []
        redditResults.forEach(result => {
          result.posts.forEach(post => {
            allPosts.push({
              id: post.id,
              title: post.title,
              selftext: post.selftext,
              author: post.author,
              score: post.score,
              num_comments: post.num_comments,
              created_utc: post.created_utc,
              url: post.url,
              permalink: `https://reddit.com${post.permalink}`,
              subreddit: post.subreddit
            })
          })
        })
        
        topRedditPosts = allPosts
          .sort((a, b) => b.score - a.score)
          .slice(0, 15)
          
      } catch (fallbackError) {
        console.error('❌ [CRON] Both Reddit RSS and JSON API failed:', fallbackError)
      }
    }

    // Fetch additional raw Reddit posts for comprehensive AI analysis
    console.log('📱 [CRON] Fetching raw Reddit posts for AI analysis...')
    try {
      const rawPosts = await fetchRawRedditPosts(subreddits, 100) // Get more posts for analysis
      rawRedditPosts = rawPosts
      console.log(`📱 [CRON] Collected ${rawRedditPosts.length} raw Reddit posts for AI analysis`)
    } catch (error) {
      console.error('❌ [CRON] Failed to fetch raw Reddit posts:', error)
    }

    // Fetch comments for high-engagement posts
    console.log('💬 [CRON] Fetching Reddit comments for detailed analysis...')
    try {
      // Select top posts with high engagement for comment analysis
      const highEngagementPosts = rawRedditPosts
        .filter(post => post.num_comments > 5) // Only posts with meaningful discussion
        .sort((a, b) => b.num_comments - a.num_comments) // Sort by comment count
        .slice(0, 20) // Analyze comments for top 20 posts
      
      const comments = await fetchRedditComments(highEngagementPosts)
      rawRedditComments = comments
      console.log(`💬 [CRON] Collected ${rawRedditComments.length} comments from ${highEngagementPosts.length} posts`)
    } catch (error) {
      console.error('❌ [CRON] Failed to fetch Reddit comments:', error)
    }

    // Fetch Twitter data using twitterapi.io
    console.log('🐦 [CRON] Fetching Twitter sentiment data via twitterapi.io...')
    let rawTwitterPosts: any[] = []
    try {
      // Use environment variable for twitterapi.io API key
      const twitterAPI = new TwitterAPI()
      
      // Fetch individual Twitter posts for the posts table (this will also be used for ticker analysis)
      console.log('🐦 [CRON] Fetching individual Twitter posts for database...')
      const twitterResults = await twitterAPI.getMultipleUserTweets(twitterAccounts, { maxResults: 50 })
      
      // Extract ticker data from the same results (avoid duplicate API calls)
      twitterTickers = twitterAPI.extractTickersFromResults(twitterResults, hours)
      
      // Convert Twitter results to our format
      twitterResults.forEach(result => {
        result.tweets.forEach(tweet => {
          rawTwitterPosts.push({
            tweet_id: tweet.id,
            text: tweet.text,
            author_username: result.username,
            author_id: tweet.author_id,
            author_name: result.user?.name || result.username,
            created_at: tweet.created_at,
            retweet_count: tweet.public_metrics.retweet_count,
            like_count: tweet.public_metrics.like_count,
            reply_count: tweet.public_metrics.reply_count,
            quote_count: tweet.public_metrics.quote_count,
            url: `https://twitter.com/${result.username}/status/${tweet.id}`,
            hashtags: tweet.entities?.hashtags?.map(h => h.tag) || [],
            cashtags: tweet.entities?.cashtags?.map(c => c.tag) || [],
            raw_json: tweet
          })
        })
      })
      
      console.log(`🐦 [CRON] Successfully fetched Twitter data: ${twitterAccounts.length} accounts, ${rawTwitterPosts.length} posts`)
      console.log(`🔍 [CRON] DEBUG: First 2 rawTwitterPosts:`, JSON.stringify(rawTwitterPosts.slice(0, 2), null, 2))
    } catch (error) {
      console.error('❌ [CRON] TwitterAPI.io failed:', error)
      // Continue without Twitter data - will use mock data instead
    }

    // Combine and process data
    const combinedTickers = combineTickerData(redditTickers, twitterTickers)
    
    // Apply LLM-based sentiment analysis
    console.log('🤖 [CRON] Running LLM-based sentiment analysis...')
    const { sentimentData, topPosts } = await analyzeSentimentWithLLM(combinedTickers, topRedditPosts)

    console.log(`📊 [CRON] Processed sentiment for ${sentimentData.length} tickers`)

    return {
      data: sentimentData,
      topPosts: topPosts,
      rawRedditPosts: rawRedditPosts,
      rawRedditComments: rawRedditComments,
      rawTwitterPosts: rawTwitterPosts,
      sources: ['Reddit RSS', 'Twitter API'],
      lastUpdated: new Date().toISOString().split('T')[0],
      fromCache: false
    }

  } catch (error) {
    console.error('❌ [CRON] Error fetching sentiment data:', error)
    throw error
  }
}

/**
 * Combine ticker data from multiple sources
 */
function combineTickerData(redditTickers: any[], twitterTickers: any[]): any[] {
  const tickerMap = new Map()
  
  // Process Reddit data
  redditTickers.forEach(ticker => {
    const key = ticker.ticker
    if (!tickerMap.has(key)) {
      tickerMap.set(key, {
        ticker: key,
        reddit: { mentions: 0, contexts: [], sentiment: 0 },
        twitter: { mentions: 0, contexts: [], sentiment: 0 }
      })
    }
    
    const existing = tickerMap.get(key)
    existing.reddit.mentions += ticker.mentions
    existing.reddit.contexts.push(...(ticker.contexts || []))
    existing.reddit.sentiment = ticker.sentiment || 0
  })
  
  // Process Twitter data
  twitterTickers.forEach(ticker => {
    const key = ticker.ticker
    if (!tickerMap.has(key)) {
      tickerMap.set(key, {
        ticker: key,
        reddit: { mentions: 0, contexts: [], sentiment: 0 },
        twitter: { mentions: 0, contexts: [], sentiment: 0 }
      })
    }
    
    const existing = tickerMap.get(key)
    existing.twitter.mentions += ticker.mentions
    existing.twitter.contexts.push(...(ticker.contexts || []))
    existing.twitter.sentiment = ticker.sentiment || 0
  })
  
  return Array.from(tickerMap.values())
}

/**
 * Save sentiment data to database
 */
async function saveSentimentDataToDatabase(data: SentimentResponse): Promise<void> {
  try {
    console.log(`💾 [CRON] Saving ${data.data.length} sentiment data points to database...`)

    const supabase = getSupabaseClient()

    // Clear existing sentiment data (keep only last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    await supabase
      .from('sentiment_data')
      .delete()
      .lt('created_at', sevenDaysAgo.toISOString())

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
    }))

    console.log(`📊 [CRON] About to insert ${sentimentRows.length} sentiment records...`)
    console.log(`📊 [CRON] Sample record structure:`, JSON.stringify(sentimentRows[0], null, 2))
    console.log(`📊 [CRON] Database URL:`, process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...')
    console.log(`📊 [CRON] Service key present:`, !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Insert new sentiment data
    const { data: insertResult, error: insertError } = await supabase
      .from('sentiment_data')
      .insert(sentimentRows)
      .select()

    if (insertError) {
      console.error('❌ [CRON] Error inserting sentiment data:', insertError)
      console.error('❌ [CRON] Error details:', JSON.stringify(insertError, null, 2))
      throw insertError
    }
    
    console.log(`✅ [CRON] Successfully saved ${sentimentRows.length} sentiment records to database`)
    console.log(`✅ [CRON] Insert result:`, insertResult ? `${insertResult.length} records returned` : 'No records returned')
    
    // Verify data was actually saved by querying back
    console.log(`🔍 [CRON] Verifying data was saved...`)
    const { data: verifyData, error: verifyError } = await supabase
      .from('sentiment_data')
      .select('ticker, sentiment_score, created_at')
      .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Last minute
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (verifyError) {
      console.error('❌ [CRON] Error verifying saved data:', verifyError)
    } else {
      console.log(`✅ [CRON] Verification: Found ${verifyData?.length || 0} recent records`)
      if (verifyData && verifyData.length > 0) {
        console.log(`✅ [CRON] Sample verified records:`, verifyData.map(r => `${r.ticker}: ${r.sentiment_score}`))
      }
    }

    // Save raw Reddit posts to database for AI analysis with LLM processing
    if (data.rawRedditPosts && data.rawRedditPosts.length > 0) {
      console.log(`💾 [CRON] Processing ${data.rawRedditPosts.length} raw Reddit posts with LLM + real-time aggregation...`)
      
      await saveRawRedditPostsWithLLM(data.rawRedditPosts)
    }

    // Save raw Reddit comments to database for AI analysis
    if (data.rawRedditComments && data.rawRedditComments.length > 0) {
      console.log(`💾 [CRON] Saving ${data.rawRedditComments.length} raw Reddit comments for AI analysis...`)
      
      await saveRawRedditComments(data.rawRedditComments)
    }

    // Save raw Twitter posts to database for AI analysis with LLM processing
    console.log(`🔍 [CRON] DEBUG: rawTwitterPosts check - exists: ${!!data.rawTwitterPosts}, length: ${data.rawTwitterPosts?.length || 0}`)
    if (data.rawTwitterPosts && data.rawTwitterPosts.length > 0) {
      console.log(`💾 [CRON] Processing ${data.rawTwitterPosts.length} raw Twitter posts with LLM + real-time aggregation...`)
      console.log(`🔍 [CRON] DEBUG: Sample post structure:`, JSON.stringify(data.rawTwitterPosts[0], null, 2))
      
      try {
        await saveRawTwitterPostsWithLLM(data.rawTwitterPosts)
        console.log(`✅ [CRON] Successfully completed LLM Twitter processing with real-time aggregation`)
      } catch (error) {
        console.error(`❌ [CRON] Error in LLM Twitter processing:`, error)
      }
    } else {
      console.log(`⚠️ [CRON] No Twitter posts to process - rawTwitterPosts is ${data.rawTwitterPosts ? 'empty' : 'undefined'}`)
    }

    // Also save top posts to the simple table for UI carousel (backward compatibility)
    if (data.topPosts && data.topPosts.length > 0) {
      console.log(`💾 [CRON] Saving ${data.topPosts.length} Reddit posts to simple table...`)
      
      // Clear old posts (keep only last 3 days)
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      
      const { error: deleteError } = await supabase
        .from('reddit_posts')
        .delete()
        .lt('created_at', threeDaysAgo.toISOString())
      
      if (deleteError) {
        console.warn('⚠️ [CRON] Error deleting old posts:', deleteError)
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
      }))

      console.log(`📊 [CRON] Inserting ${postRows.length} posts into reddit_posts table...`)
      
      const { error: postsError } = await supabase
        .from('reddit_posts')
        .insert(postRows)

      if (postsError) {
        console.warn('⚠️ [CRON] Error inserting Reddit posts (non-critical):', postsError)
        // Don't throw - this is non-critical
      } else {
        console.log(`✅ [CRON] Saved ${data.topPosts.length} Reddit posts to simple table`)
      }
    }

    console.log(`✅ [CRON] Successfully completed database save operation`)

  } catch (error) {
    console.error('❌ [CRON] Error saving sentiment data to database:', error)
    throw error
  }
}

/**
 * Save raw Reddit posts to the comprehensive table for AI analysis
 */
async function saveRawRedditPosts(rawPosts: RawRedditPost[]): Promise<void> {
  try {
    console.log(`💾 [CRON] Processing ${rawPosts.length} raw Reddit posts...`)

    const supabase = getSupabaseClient()

    // Clear old posts (keep only last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { error: deleteError } = await supabase
      .from('reddit_posts_raw')
      .delete()
      .lt('retrieved_at', thirtyDaysAgo.toISOString())
    
    if (deleteError) {
      console.warn('⚠️ [CRON] Error deleting old raw posts:', deleteError)
    }

    // Prepare raw posts for insertion
    // 🎯 MINIMAL DATA: Only insert what's essential for sentiment analysis
    const rawPostRows = rawPosts.map(post => ({
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
      // raw_json: post.raw_json || post, // Temporarily removed due to PostgREST cache issues
      retrieved_at: new Date().toISOString()
    }))

    console.log(`📊 [CRON] Inserting ${rawPostRows.length} raw posts into reddit_posts_raw table...`)
    
    // Insert in batches to avoid timeout
    const batchSize = 50
    for (let i = 0; i < rawPostRows.length; i += batchSize) {
      const batch = rawPostRows.slice(i, i + batchSize)
      
      const { error: insertError } = await supabase
        .from('reddit_posts_raw')
        .insert(batch)

      if (insertError) {
        console.error(`❌ [CRON] Error inserting raw posts batch ${i}-${i + batch.length}:`, insertError)
        // Continue with other batches
      } else {
        console.log(`✅ [CRON] Inserted batch ${i}-${i + batch.length} raw posts`)
      }
    }

    console.log(`✅ [CRON] Successfully saved ${rawPosts.length} raw Reddit posts for AI analysis`)

  } catch (error) {
    console.error('❌ [CRON] Error saving raw Reddit posts:', error)
    // Don't throw - this is non-critical for sentiment analysis
  }
}

/**
 * Fetch raw Reddit posts with complete metadata for AI analysis
 */
async function fetchRawRedditPosts(subreddits: string[], limit: number = 100): Promise<RawRedditPost[]> {
  const rawPosts: RawRedditPost[] = []
  
  try {
    // Use Reddit RSS API to get comprehensive post data
    for (const subreddit of subreddits) {
      console.log(`📱 [CRON] Fetching raw posts from r/${subreddit}...`)
      
      try {
        // Fetch posts from this subreddit
        const posts = await redditRSSAPI.getTopPosts([subreddit], Math.ceil(limit / subreddits.length))
        
        // Convert to raw format with as much data as available
        const convertedPosts: RawRedditPost[] = posts.map(post => ({
          id: post.id,
          name: `t3_${post.id}`,
          title: post.title,
          selftext: post.content || '',
          author: post.author,
          subreddit: post.subreddit,
          subreddit_name_prefixed: `r/${post.subreddit}`,
          score: 0, // RSS doesn't provide score
          num_comments: 0, // RSS doesn't provide comments
          created_utc: post.created_utc,
          url: post.url,
          permalink: post.permalink,
          is_self: !post.url.includes('http') || post.url.includes('reddit.com'),
          domain: post.url.includes('http') ? new URL(post.url).hostname : 'self.reddit',
          raw_json: {
            id: post.id,
            title: post.title,
            selftext: post.content,
            author: post.author,
            subreddit: post.subreddit,
            created_utc: post.created_utc,
            url: post.url,
            permalink: post.permalink,
            source: 'reddit_rss'
          }
        }))
        
        rawPosts.push(...convertedPosts)
        console.log(`📱 [CRON] Collected ${convertedPosts.length} raw posts from r/${subreddit}`)
        
      } catch (subredditError) {
        console.error(`❌ [CRON] Error fetching from r/${subreddit}:`, subredditError)
      }
    }
    
    console.log(`📱 [CRON] Total raw posts collected: ${rawPosts.length}`)
    return rawPosts.slice(0, limit) // Ensure we don't exceed limit
    
  } catch (error) {
    console.error('❌ [CRON] Error fetching raw Reddit posts:', error)
    return []
  }
}

/**
 * Fetch Reddit comments for high-engagement posts using Reddit JSON API
 */
async function fetchRedditComments(posts: RawRedditPost[]): Promise<RawRedditComment[]> {
  const allComments: RawRedditComment[] = []
  
  try {
    for (const post of posts) {
      console.log(`💬 [CRON] Fetching comments for post ${post.id} (${post.num_comments} comments)...`)
      
      try {
        // Use Reddit JSON API to get comments
        const commentsUrl = `https://www.reddit.com${post.permalink}.json?limit=50&sort=top`
        
        const response = await fetch(commentsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })
        
        if (!response.ok) {
          console.warn(`⚠️ [CRON] Failed to fetch comments for ${post.id}: ${response.status}`)
          continue
        }
        
        const data = await response.json()
        
        // Reddit returns an array: [post_data, comments_data]
        if (!Array.isArray(data) || data.length < 2) {
          console.warn(`⚠️ [CRON] Unexpected response format for ${post.id}`)
          continue
        }
        
        const commentsData = data[1]?.data?.children || []
        const postComments = extractCommentsRecursively(commentsData, post.id, 0)
        
        allComments.push(...postComments)
        console.log(`💬 [CRON] Collected ${postComments.length} comments from post ${post.id}`)
        
        // Rate limiting - be respectful
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
        
      } catch (commentError) {
        console.error(`❌ [CRON] Error fetching comments for post ${post.id}:`, commentError)
      }
    }
    
    console.log(`💬 [CRON] Total comments collected: ${allComments.length}`)
    return allComments
    
  } catch (error) {
    console.error('❌ [CRON] Error fetching Reddit comments:', error)
    return []
  }
}

/**
 * Recursively extract comments from Reddit's nested structure
 */
function extractCommentsRecursively(
  children: any[], 
  postId: string, 
  depth: number = 0,
  parentId?: string
): RawRedditComment[] {
  const comments: RawRedditComment[] = []
  
  for (const child of children) {
    if (!child?.data || child.kind !== 't1') continue // Only process comments (t1)
    
    const commentData = child.data
    
    // Skip deleted/removed comments
    if (commentData.author === '[deleted]' || commentData.body === '[removed]') continue
    
    const comment: RawRedditComment = {
      id: commentData.id,
      name: commentData.name,
      post_id: postId,
      parent_id: parentId || postId,
      body: commentData.body || '',
      body_html: commentData.body_html || '',
      author: commentData.author || 'unknown',
      author_fullname: commentData.author_fullname || '',
      author_flair_text: commentData.author_flair_text || '',
      score: commentData.score || 0,
      ups: commentData.ups || 0,
      downs: commentData.downs || 0,
      controversiality: commentData.controversiality || 0,
      created_utc: commentData.created_utc || Math.floor(Date.now() / 1000),
      edited: !!commentData.edited,
      distinguished: commentData.distinguished || '',
      stickied: !!commentData.stickied,
      depth: depth,
      is_submitter: !!commentData.is_submitter,
      score_hidden: !!commentData.score_hidden,
      archived: !!commentData.archived,
      locked: !!commentData.locked,
      total_awards_received: commentData.total_awards_received || 0,
      gilded: commentData.gilded || 0,
      // all_awardings: commentData.all_awardings || [], // Temporarily removed due to schema cache issue
      raw_json: commentData
    }
    
    comments.push(comment)
    
    // Process replies recursively (max depth 3 to avoid too deep nesting)
    if (commentData.replies?.data?.children && depth < 3) {
      const replies = extractCommentsRecursively(
        commentData.replies.data.children,
        postId,
        depth + 1,
        commentData.id
      )
      comments.push(...replies)
    }
  }
  
  return comments
}

/**
 * Save raw Reddit comments to the comprehensive table for AI analysis
 */
async function saveRawRedditComments(rawComments: RawRedditComment[]): Promise<void> {
  try {
    console.log(`💾 [CRON] Processing ${rawComments.length} raw Reddit comments...`)

    const supabase = getSupabaseClient()

    // Clear old comments (keep only last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { error: deleteError } = await supabase
      .from('reddit_comments')
      .delete()
      .lt('retrieved_at', thirtyDaysAgo.toISOString())
    
    if (deleteError) {
      console.warn('⚠️ [CRON] Error deleting old comments:', deleteError)
    }

    // 🎯 MINIMAL COMMENTS DATA: Only what's essential for sentiment analysis
    const commentRows = rawComments.map(comment => ({
      comment_id: comment.id,
      post_id: comment.post_id,
      body: comment.body || '',
      author: comment.author,
      score: comment.score || 0,
      created_utc: comment.created_utc,
      // raw_json: comment.raw_json || comment, // Temporarily removed due to PostgREST cache issues
      retrieved_at: new Date().toISOString()
    }))

    console.log(`📊 [CRON] Inserting ${commentRows.length} comments into reddit_comments table...`)
    
    // Insert in batches to avoid timeout
    const batchSize = 50
    for (let i = 0; i < commentRows.length; i += batchSize) {
      const batch = commentRows.slice(i, i + batchSize)
      
      const { error: insertError } = await supabase
        .from('reddit_comments')
        .insert(batch)

      if (insertError) {
        console.error(`❌ [CRON] Error inserting comments batch ${i}-${i + batch.length}:`, insertError)
        // Continue with other batches
      } else {
        console.log(`✅ [CRON] Inserted batch ${i}-${i + batch.length} comments`)
      }
    }

    console.log(`✅ [CRON] Successfully saved ${rawComments.length} raw Reddit comments for AI analysis`)

  } catch (error) {
    console.error('❌ [CRON] Error saving raw Reddit comments:', error)
    // Don't throw - this is non-critical for sentiment analysis
  }
}

/**
 * Save raw Twitter posts to the comprehensive table for AI analysis
 */
async function saveRawTwitterPosts(rawTwitterPosts: any[]): Promise<void> {
  try {
    console.log(`💾 [CRON] Processing ${rawTwitterPosts.length} raw Twitter posts...`)
    console.log(`🔍 [CRON] DEBUG: saveRawTwitterPosts called with data:`, rawTwitterPosts.slice(0, 1))

    const supabase = getSupabaseClient()

    // Step 1: Ensure actionable tweets schema exists
    await ensureActionableTweetsSchema(supabase)

    // Step 2: Upsert author data for follower count normalization
    await upsertTwitterAuthors(supabase, rawTwitterPosts)

    // Clear old posts (keep only last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { error: deleteError } = await supabase
      .from('twitter_posts_raw')
      .delete()
      .lt('retrieved_at', thirtyDaysAgo.toISOString())
    
    if (deleteError) {
      console.warn('⚠️ [CRON] Error deleting old Twitter posts:', deleteError)
    }

    // Prepare raw Twitter posts for insertion
    const twitterPostRows = rawTwitterPosts.map(post => ({
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
      hashtags: post.hashtags || [],
      cashtags: post.cashtags || [],
      raw_json: post.raw_json || post,
      retrieved_at: new Date().toISOString()
    }))

    console.log(`📊 [CRON] Inserting ${twitterPostRows.length} Twitter posts into twitter_posts_raw table...`)
    
    // Insert in batches to avoid timeout
    const batchSize = 50
    for (let i = 0; i < twitterPostRows.length; i += batchSize) {
      const batch = twitterPostRows.slice(i, i + batchSize)
      
      const { error: insertError } = await supabase
        .from('twitter_posts_raw')
        .upsert(batch, { onConflict: 'tweet_id' })

      if (insertError) {
        console.error(`❌ [CRON] Error inserting Twitter posts batch ${i}-${i + batch.length}:`, insertError)
        console.error(`❌ [CRON] Error details:`, JSON.stringify(insertError, null, 2))
        console.error(`❌ [CRON] Sample batch data:`, JSON.stringify(batch[0], null, 2))
        // Continue with other batches
      } else {
        console.log(`✅ [CRON] Inserted batch ${i}-${i + batch.length} Twitter posts`)
      }
    }

    // Also save to simple twitter_posts table for UI
    const simpleTwitterPosts = rawTwitterPosts.map(post => ({
      tweet_id: post.tweet_id,
      text: post.text,
      author: post.author_username,
      like_count: post.like_count || 0,
      retweet_count: post.retweet_count || 0,
      reply_count: post.reply_count || 0,
      url: post.url,
      created_at: post.created_at,
      retrieved_at: new Date().toISOString()
    }))

    // Clear old simple posts (keep only last 3 days)
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    
    const { error: deleteSimpleError } = await supabase
      .from('twitter_posts')
      .delete()
      .lt('retrieved_at', threeDaysAgo.toISOString())
    
    if (deleteSimpleError) {
      console.warn('⚠️ [CRON] Error deleting old simple Twitter posts:', deleteSimpleError)
    }

    // Insert simple posts (use upsert to handle duplicates)
    const { error: simpleInsertError } = await supabase
      .from('twitter_posts')
      .upsert(simpleTwitterPosts, { onConflict: 'tweet_id' })

    if (simpleInsertError) {
      console.error('❌ [CRON] Error inserting simple Twitter posts:', simpleInsertError)
      console.error(`❌ [CRON] Simple insert error details:`, JSON.stringify(simpleInsertError, null, 2))
      console.error(`❌ [CRON] Sample simple post data:`, JSON.stringify(simpleTwitterPosts[0], null, 2))
    } else {
      console.log(`✅ [CRON] Successfully saved ${rawTwitterPosts.length} Twitter posts to both tables`)
    }

  } catch (error) {
    console.error('❌ [CRON] Error saving raw Twitter posts:', error)
    // Don't throw - this is non-critical for sentiment analysis
  }
}

/**
 * Ensure actionable tweets schema exists
 */
async function ensureActionableTweetsSchema(supabase: any): Promise<void> {
  try {
    console.log('🏗️ [CRON] Ensuring actionable tweets schema exists...')
    
    // Check if twitter_authors table exists
    const { data: authorsCheck, error: authorsCheckError } = await supabase
      .from('twitter_authors')
      .select('author_id')
      .limit(1)
    
    if (authorsCheckError && authorsCheckError.code === '42P01') {
      console.log('📊 [CRON] Creating twitter_authors table...')
      
      // Create twitter_authors table using raw SQL
      const createAuthorsSQL = `
        CREATE TABLE IF NOT EXISTS public.twitter_authors (
          author_id VARCHAR(50) PRIMARY KEY,
          author_username VARCHAR(100) UNIQUE,
          author_name TEXT,
          follower_count INT NOT NULL DEFAULT 0,
          following_count INT NOT NULL DEFAULT 0,
          tweet_count INT NOT NULL DEFAULT 0,
          listed_count INT NOT NULL DEFAULT 0,
          profile_json JSONB,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_twitter_authors_username ON public.twitter_authors(author_username);
      `
      
      const { error: createError } = await supabase.rpc('exec_sql', { sql: createAuthorsSQL })
      if (createError) {
        console.warn('⚠️ [CRON] Could not create twitter_authors table via RPC, will continue without it:', createError)
      } else {
        console.log('✅ [CRON] twitter_authors table created successfully')
      }
    }

    // Create views and materialized views
    await createActionableTweetsViews(supabase)
    
  } catch (error) {
    console.warn('⚠️ [CRON] Error ensuring actionable tweets schema (non-critical):', error)
  }
}

/**
 * Create actionable tweets views and materialized views
 */
async function createActionableTweetsViews(supabase: any): Promise<void> {
  try {
    console.log('🏗️ [CRON] Creating actionable tweets views...')
    
    // Create tweet_features view
    const tweetFeaturesSQL = `
      CREATE OR REPLACE VIEW public.tweet_features AS
      WITH base AS (
        SELECT
          r.tweet_id,
          r.text,
          r.author_username,
          r.author_id,
          r.author_name,
          r.created_at,
          COALESCE((r.raw_json->>'is_retweet')::boolean, false) as is_retweet,
          r.url,
          r.raw_json,
          COALESCE(r.cashtags,
                   (SELECT array_agg(DISTINCT upper(m[1]))
                    FROM regexp_matches(r.text, '\\$([A-Za-z]{1,5})', 'g') m)
          ) AS tickers,
          (COALESCE(r.like_count,0)
           + COALESCE(r.retweet_count,0)
           + COALESCE(r.reply_count,0)
           + COALESCE(r.quote_count,0))::int AS engagement
        FROM public.twitter_posts_raw r
        WHERE r.created_at > NOW() - INTERVAL '36 hours'
      )
      SELECT
        b.*,
        COALESCE(a.follower_count, 1) AS follower_count,
        ((b.engagement::float / GREATEST(1, COALESCE(a.follower_count,1)::float))
          / GREATEST(1, EXTRACT(epoch FROM (NOW()-b.created_at))/60.0)) AS velocity,
        (b.text ~* '(^|[^A-Za-z])(\\$?\\d{1,5}(\\.\\d+)?)(\\s*(target|pt|tp|stop|risk|at|above|below))') AS has_numbers,
        (b.text ~* '(entry|bought|added|starter|trimmed|long|short|calls|puts|stop|target|pt|tp|breakout|breakdown|support|resistance|ath|sweep|unusual|iv|gamma|delta|roll)') AS has_action_words,
        ((b.url IS NOT NULL AND b.url <> '')
           OR EXISTS (SELECT 1 FROM jsonb_path_query(b.raw_json, '$.entities.urls[*]'))) AS has_link,
        EXISTS (SELECT 1 FROM jsonb_path_query(b.raw_json, '$.includes.media[*] ? (@.type == "photo" || @.type == "video")')) AS has_chart
      FROM base b
      LEFT JOIN public.twitter_authors a ON a.author_id = b.author_id;
    `
    
    const { error: viewError } = await supabase.rpc('exec_sql', { sql: tweetFeaturesSQL })
    if (viewError) {
      console.warn('⚠️ [CRON] Could not create tweet_features view:', viewError)
    } else {
      console.log('✅ [CRON] tweet_features view created')
    }

    // Create top_actionable_tweets view (simplified version without materialized views initially)
    const actionableTweetsSQL = `
      CREATE OR REPLACE VIEW public.top_actionable_tweets AS
      WITH tf AS (
        SELECT *
        FROM public.tweet_features
        WHERE created_at > NOW() - INTERVAL '24 hours'
          AND array_length(tickers,1) >= 1
          AND COALESCE(is_retweet,false) = false
      )
      SELECT
        tf.tweet_id,
        tf.author_username,
        tf.author_id,
        tf.author_name,
        tf.text,
        tf.tickers,
        tf.created_at,
        tf.follower_count,
        tf.engagement,
        tf.velocity,
        -- Simplified scoring without materialized views initially
        tf.velocity AS velocity_z,
        0 AS authors_60m,
        ((CASE WHEN tf.has_action_words THEN 1 ELSE 0 END)
         + (CASE WHEN tf.has_numbers THEN 1 ELSE 0 END)
         + (CASE WHEN (tf.has_link OR tf.has_chart) THEN 1 ELSE 0 END)) AS actionability_score,
        (CASE WHEN tf.text ~* '(earnings|guidance|upgrade|downgrade|pt |price target|fda|pdufa|contract|award|halt|8-k|10-q|s-1|press release|^pr\\b|\\bir\\b)' THEN 1 ELSE 0 END) AS catalyst_score,
        1.0 AS author_novelty,
        exp( - EXTRACT(epoch FROM (NOW()-tf.created_at))/60.0 / 240.0 ) AS time_decay,
        -- Simplified scoring
        (tf.velocity * 0.4 
         + ((CASE WHEN tf.has_action_words THEN 1 ELSE 0 END)
            + (CASE WHEN tf.has_numbers THEN 1 ELSE 0 END)
            + (CASE WHEN (tf.has_link OR tf.has_chart) THEN 1 ELSE 0 END)) * 0.3
         + (CASE WHEN tf.text ~* '(earnings|guidance|upgrade|downgrade|pt |price target|fda|pdufa|contract|award|halt|8-k|10-q|s-1|press release|^pr\\b|\\bir\\b)' THEN 1 ELSE 0 END) * 0.2
         + exp( - EXTRACT(epoch FROM (NOW()-tf.created_at))/60.0 / 240.0 ) * 0.1) AS score
      FROM tf
      WHERE (tf.has_action_words OR tf.has_numbers OR tf.has_link OR tf.has_chart)
      ORDER BY score DESC;
    `
    
    const { error: actionableError } = await supabase.rpc('exec_sql', { sql: actionableTweetsSQL })
    if (actionableError) {
      console.warn('⚠️ [CRON] Could not create top_actionable_tweets view:', actionableError)
    } else {
      console.log('✅ [CRON] top_actionable_tweets view created')
    }
    
  } catch (error) {
    console.warn('⚠️ [CRON] Error creating actionable tweets views (non-critical):', error)
  }
}

/**
 * Upsert Twitter author data for follower count normalization
 */
async function upsertTwitterAuthors(supabase: any, rawTwitterPosts: any[]): Promise<void> {
  try {
    console.log('👥 [CRON] Upserting Twitter author data...')
    
    // Extract unique authors from posts
    const uniqueAuthors = new Map()
    rawTwitterPosts.forEach(post => {
      if (post.author_id && post.author_username) {
        uniqueAuthors.set(post.author_id, {
          author_id: post.author_id,
          author_username: post.author_username,
          author_name: post.author_name || post.author_username,
          follower_count: post.follower_count || 0,
          following_count: post.following_count || 0,
          tweet_count: post.tweet_count || 0,
          listed_count: post.listed_count || 0,
          profile_json: post.raw_json || {},
          updated_at: new Date().toISOString()
        })
      }
    })
    
    const authorRows = Array.from(uniqueAuthors.values())
    
    if (authorRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('twitter_authors')
        .upsert(authorRows, { onConflict: 'author_id' })
      
      if (upsertError) {
        console.warn('⚠️ [CRON] Could not upsert author data (non-critical):', upsertError)
      } else {
        console.log(`✅ [CRON] Upserted ${authorRows.length} Twitter authors`)
      }
    }
    
  } catch (error) {
    console.warn('⚠️ [CRON] Error upserting Twitter authors (non-critical):', error)
  }
}

/**
 * GET endpoint for health check
 */
export async function GET() {
  return NextResponse.json({
    message: 'Sentiment data cron job endpoint',
    status: 'ready',
    timestamp: new Date().toISOString()
  })
}
