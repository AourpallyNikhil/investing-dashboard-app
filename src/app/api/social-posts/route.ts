import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface UnifiedPost {
  id: string;
  source: 'twitter' | 'reddit';
  content: string;
  title?: string;
  author: string;
  created_at: string;
  url: string;
  
  // Engagement metrics
  engagement_score: number;
  engagement_details: {
    likes?: number;
    retweets?: number;
    replies?: number;
    score?: number;
    comments?: number;
  };
  
  // LLM Analysis
  llm_ticker?: string;
  llm_actionability_score?: number;
  llm_sentiment_score?: number;
  llm_confidence?: number;
  llm_has_catalyst?: boolean;
  llm_key_themes?: string[];
  
  // Platform-specific
  platform_data: {
    subreddit?: string;
    hashtags?: string[];
    follower_count?: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract filters
    const source = searchParams.get('source') || 'all'; // 'twitter', 'reddit', 'all'
    const hoursBack = parseInt(searchParams.get('hours') || '24');
    const minActionability = parseFloat(searchParams.get('actionability') || '0.0');
    const sentiment = searchParams.get('sentiment') || 'all';
    const minConfidence = parseFloat(searchParams.get('confidence') || '0.3');
    const limit = parseInt(searchParams.get('limit') || '50');
    const ticker = searchParams.get('ticker'); // Optional ticker filter
    
    console.log('🔍 [API] Social posts request:', {
      source, hoursBack, minActionability, sentiment, minConfidence, limit, ticker
    });
    
    let allPosts: UnifiedPost[] = [];
    
    // Fetch Twitter posts
    if (source === 'twitter' || source === 'all') {
      console.log('📱 [API] Fetching Twitter posts...');
      
      let twitterQuery = supabase
        .from('twitter_posts_raw')
        .select(`
          tweet_id, text, author_username, author_name, created_at, url,
          like_count, retweet_count, reply_count, quote_count,
          llm_ticker, llm_actionability_score, llm_sentiment_score, 
          llm_confidence, llm_has_catalyst, llm_key_themes,
          hashtags, cashtags
        `)
        .gte('created_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())
        .not('tweet_id', 'like', 'mock_%')
        .eq('is_retweet', false)
        .gte('llm_confidence', minConfidence);
      
      // Add actionability filter if specified
      if (minActionability > 0) {
        twitterQuery = twitterQuery.gte('llm_actionability_score', minActionability);
      }
      
      // Add ticker filter if specified
      if (ticker) {
        twitterQuery = twitterQuery.eq('llm_ticker', ticker.toUpperCase());
      }
      
      // Add sentiment filter
      if (sentiment !== 'all') {
        if (sentiment === 'positive') {
          twitterQuery = twitterQuery.gt('llm_sentiment_score', 0.1);
        } else if (sentiment === 'negative') {
          twitterQuery = twitterQuery.lt('llm_sentiment_score', -0.1);
        } else if (sentiment === 'neutral') {
          twitterQuery = twitterQuery.gte('llm_sentiment_score', -0.1).lte('llm_sentiment_score', 0.1);
        }
      }
      
      const { data: twitterData, error: twitterError } = await twitterQuery
        .order('created_at', { ascending: false })
        .limit(Math.floor(limit * 0.7)); // 70% of limit for Twitter
      
      if (twitterError) {
        console.error('❌ [API] Twitter query error:', twitterError);
      } else {
        console.log(`✅ [API] Fetched ${twitterData?.length || 0} Twitter posts`);
        
        const twitterPosts: UnifiedPost[] = (twitterData || []).map(post => ({
          id: post.tweet_id,
          source: 'twitter' as const,
          content: post.text,
          author: post.author_username,
          created_at: post.created_at,
          url: post.url,
          engagement_score: (post.like_count || 0) + (post.retweet_count || 0) + (post.reply_count || 0),
          engagement_details: {
            likes: post.like_count,
            retweets: post.retweet_count,
            replies: post.reply_count,
          },
          llm_ticker: post.llm_ticker,
          llm_actionability_score: post.llm_actionability_score,
          llm_sentiment_score: post.llm_sentiment_score,
          llm_confidence: post.llm_confidence,
          llm_has_catalyst: post.llm_has_catalyst,
          llm_key_themes: post.llm_key_themes,
          platform_data: {
            hashtags: post.hashtags,
          }
        }));
        
        allPosts.push(...twitterPosts);
      }
    }
    
    // Fetch Reddit posts
    if (source === 'reddit' || source === 'all') {
      console.log('🔴 [API] Fetching Reddit posts...');
      
      let redditQuery = supabase
        .from('reddit_posts_raw')
        .select(`
          post_id, title, selftext, author, subreddit, score, num_comments,
          created_utc, url, permalink,
          llm_ticker, llm_actionability_score, llm_sentiment_score, 
          llm_confidence, llm_has_catalyst, llm_key_themes
        `)
        .gte('retrieved_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString());
      
      // Only apply confidence filter if we have LLM data
      if (minConfidence > 0) {
        redditQuery = redditQuery.gte('llm_confidence', minConfidence);
      }
      
      // Add actionability filter if specified  
      if (minActionability > 0) {
        redditQuery = redditQuery.gte('llm_actionability_score', minActionability);
      }
      
      // Add ticker filter if specified
      if (ticker) {
        redditQuery = redditQuery.eq('llm_ticker', ticker.toUpperCase());
      }
      
      // Add sentiment filter
      if (sentiment !== 'all') {
        if (sentiment === 'positive') {
          redditQuery = redditQuery.gt('llm_sentiment_score', 0.1);
        } else if (sentiment === 'negative') {
          redditQuery = redditQuery.lt('llm_sentiment_score', -0.1);
        } else if (sentiment === 'neutral') {
          redditQuery = redditQuery.gte('llm_sentiment_score', -0.1).lte('llm_sentiment_score', 0.1);
        }
      }
      
      const { data: redditData, error: redditError } = await redditQuery
        .order('retrieved_at', { ascending: false })
        .limit(Math.floor(limit * 0.3)); // 30% of limit for Reddit
      
      if (redditError) {
        console.error('❌ [API] Reddit query error:', redditError);
      } else {
        console.log(`✅ [API] Fetched ${redditData?.length || 0} Reddit posts`);
        
        const redditPosts: UnifiedPost[] = (redditData || []).map(post => ({
          id: post.post_id,
          source: 'reddit' as const,
          content: `${post.title}\n\n${post.selftext || ''}`.trim(),
          title: post.title,
          author: post.author,
          created_at: new Date(post.created_utc * 1000).toISOString(),
          url: `https://reddit.com${post.permalink}`,
          engagement_score: (post.score || 0) + (post.num_comments || 0),
          engagement_details: {
            score: post.score,
            comments: post.num_comments,
          },
          llm_ticker: post.llm_ticker,
          llm_actionability_score: post.llm_actionability_score,
          llm_sentiment_score: post.llm_sentiment_score,
          llm_confidence: post.llm_confidence,
          llm_has_catalyst: post.llm_has_catalyst,
          llm_key_themes: post.llm_key_themes,
          platform_data: {
            subreddit: post.subreddit,
          }
        }));
        
        allPosts.push(...redditPosts);
      }
    }
    
    // Sort all posts by creation date
    allPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Apply final limit
    const finalPosts = allPosts.slice(0, limit);
    
    console.log(`📊 [API] Returning ${finalPosts.length} total posts (${finalPosts.filter(p => p.source === 'twitter').length} Twitter, ${finalPosts.filter(p => p.source === 'reddit').length} Reddit)`);
    
    return NextResponse.json({
      posts: finalPosts,
      count: finalPosts.length,
      breakdown: {
        twitter: finalPosts.filter(p => p.source === 'twitter').length,
        reddit: finalPosts.filter(p => p.source === 'reddit').length,
      },
      filters: {
        source,
        hours: hoursBack,
        actionability: minActionability,
        sentiment,
        confidence: minConfidence,
        ticker,
      }
    });

  } catch (error) {
    console.error('❌ [API] Social posts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch social posts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
