import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { redditRSSAPI } from '@/lib/reddit-rss'
import { RedditAPI } from '@/lib/reddit-api'
import { TwitterAPI } from '@/lib/twitter-api'
import { analyzeSentimentWithLLM } from '@/lib/sentiment-llm'

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
    console.log('🤖 [CRON] Starting daily sentiment data fetch...')
    
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ [CRON] Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch fresh sentiment data
    const sentimentData = await fetchSentimentData()
    
    // Save to database
    await saveSentimentDataToDatabase(sentimentData)
    
    console.log('✅ [CRON] Daily sentiment data fetch completed successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Sentiment data fetched and saved successfully',
      dataPoints: sentimentData.data.length,
      topPosts: sentimentData.topPosts?.length || 0,
      timestamp: new Date().toISOString()
    })

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
    const subreddits = ['wallstreetbets', 'investing', 'stocks', 'SecurityAnalysis']
    const twitterAccounts = ['elonmusk', 'chamath', 'cathiedwood']

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

    // Fetch Twitter data
    console.log('🐦 [CRON] Fetching Twitter sentiment data...')
    try {
      const twitterAPI = new TwitterAPI()
      twitterTickers = await twitterAPI.getTrendingTickers(twitterAccounts, hours)
    } catch (error) {
      console.error('❌ [CRON] Twitter API failed:', error)
      // Continue without Twitter data
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

    // Insert new sentiment data
    console.log(`📊 [CRON] Inserting ${sentimentRows.length} sentiment records...`)
    
    const { error: insertError } = await supabase
      .from('sentiment_data')
      .insert(sentimentRows)

    if (insertError) {
      console.error('❌ [CRON] Error inserting sentiment data:', insertError)
      throw insertError
    }
    
    console.log(`✅ [CRON] Successfully saved ${sentimentRows.length} sentiment records to database`)

    // Save raw Reddit posts to database for AI analysis
    if (data.rawRedditPosts && data.rawRedditPosts.length > 0) {
      console.log(`💾 [CRON] Saving ${data.rawRedditPosts.length} raw Reddit posts for AI analysis...`)
      
      await saveRawRedditPosts(data.rawRedditPosts)
    }

    // Save raw Reddit comments to database for AI analysis
    if (data.rawRedditComments && data.rawRedditComments.length > 0) {
      console.log(`💾 [CRON] Saving ${data.rawRedditComments.length} raw Reddit comments for AI analysis...`)
      
      await saveRawRedditComments(data.rawRedditComments)
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
    const rawPostRows = rawPosts.map(post => ({
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
      retrieved_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
      all_awardings: commentData.all_awardings || [],
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

    // Prepare comments for insertion
    const commentRows = rawComments.map(comment => ({
      comment_id: comment.id,
      fullname: comment.name || `t1_${comment.id}`,
      post_id: comment.post_id,
      parent_id: comment.parent_id || comment.post_id,
      body: comment.body || '',
      body_html: comment.body_html || '',
      author: comment.author,
      author_fullname: comment.author_fullname || '',
      author_flair_text: comment.author_flair_text || '',
      score: comment.score || 0,
      ups: comment.ups || 0,
      downs: comment.downs || 0,
      controversiality: comment.controversiality || 0,
      created_utc: comment.created_utc,
      edited: comment.edited || false,
      distinguished: comment.distinguished || null,
      stickied: comment.stickied || false,
      depth: comment.depth || 0,
      is_submitter: comment.is_submitter || false,
      score_hidden: comment.score_hidden || false,
      archived: comment.archived || false,
      locked: comment.locked || false,
      total_awards_received: comment.total_awards_received || 0,
      gilded: comment.gilded || 0,
      all_awardings: comment.all_awardings || [],
      raw_json: comment.raw_json || comment,
      retrieved_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
 * GET endpoint for health check
 */
export async function GET() {
  return NextResponse.json({
    message: 'Sentiment data cron job endpoint',
    status: 'ready',
    timestamp: new Date().toISOString()
  })
}
