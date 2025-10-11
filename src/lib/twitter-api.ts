/**
 * Twitter/X API Integration for Sentiment Analysis using twitterapi.io
 * Fetches tweets from specified influencers for stock sentiment tracking
 * Uses twitterapi.io as a reliable, cost-effective alternative to official Twitter API
 */

interface Tweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  url?: string;
  public_metrics: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
  };
  context_annotations?: Array<{
    domain: {
      id: string;
      name: string;
    };
    entity: {
      id: string;
      name: string;
    };
  }>;
  entities?: {
    cashtags?: Array<{
      start: number;
      end: number;
      tag: string;
    }>;
    hashtags?: Array<{
      start: number;
      end: number;
      tag: string;
    }>;
    urls?: Array<{
      start: number;
      end: number;
      url: string;
      expanded_url: string;
      display_url: string;
    }>;
  };
}

interface TwitterUser {
  id: string;
  username: string;
  name: string;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

interface TwitterResponse {
  data?: Tweet[];
  includes?: {
    users?: TwitterUser[];
  };
  meta?: {
    oldest_id?: string;
    newest_id?: string;
    result_count?: number;
    next_token?: string;
  };
}

export class TwitterAPI {
  private readonly baseUrl = 'https://api.twitterapi.io';
  private readonly apiKey: string;
  
  constructor(apiKey?: string) {
    // Support both old and new environment variable names for backward compatibility
    this.apiKey = apiKey || process.env.TWITTERAPI_IO_KEY || process.env.TWITTER_BEARER_TOKEN || '';
    
    if (!this.apiKey) {
      console.warn('⚠️ TwitterAPI.io API Key not provided. Twitter integration will use mock data.');
    } else {
      console.log('✅ TwitterAPI.io initialized successfully');
    }
  }

  /**
   * Get user ID by username using twitterapi.io
   */
  async getUserByUsername(username: string): Promise<TwitterUser | null> {
    if (!this.apiKey) {
      console.log(`❌ No TwitterAPI.io key available for @${username}`);
      return null;
    }

    try {
      console.log(`🐦 Fetching user info for @${username} via twitterapi.io`);
      
      const response = await fetch(
        `${this.baseUrl}/twitter/user/info?userName=${username}`,
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`⚠️ User @${username} not found`);
          return null;
        }
        throw new Error(`TwitterAPI.io error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform twitterapi.io response to match our interface
      if (data.data) {
        const userData = data.data;
        return {
          id: userData.id_str || userData.id,
          username: userData.screen_name || username,
          name: userData.name || username,
          public_metrics: {
            followers_count: userData.followers_count || 0,
            following_count: userData.friends_count || 0,
            tweet_count: userData.statuses_count || 0
          }
        };
      }

      return null;

    } catch (error) {
      console.error(`❌ Error fetching Twitter user @${username}:`, error);
      console.log(`🚫 No fallback available for @${username}`);
      return null;
    }
  }

  /**
   * Fetch recent tweets from a user using twitterapi.io
   * Note: userId can be either username or user ID for twitterapi.io
   */
  async getUserTweets(
    userIdOrUsername: string,
    options: {
      maxResults?: number;
      sinceId?: string;
      untilId?: string;
      paginationToken?: string;
    } = {}
  ): Promise<{ tweets: Tweet[]; nextToken?: string }> {
    const {
      maxResults = 50, // More conservative default
      sinceId,
      untilId,
      paginationToken
    } = options;

    if (!this.apiKey) {
      console.log(`❌ No TwitterAPI.io key available for user ${userIdOrUsername}`);
      return { tweets: [] };
    }

    try {
      console.log(`🐦 Fetching ${maxResults} tweets for user ${userIdOrUsername} via twitterapi.io`);
      
      // Build URL for twitterapi.io user tweets endpoint
      // Note: twitterapi.io uses userName instead of user_id for tweets endpoint
      let url = `${this.baseUrl}/twitter/user/last_tweets?userName=${userIdOrUsername}&count=${maxResults}`;
      
      if (sinceId) url += `&since_id=${sinceId}`;
      if (untilId) url += `&max_id=${untilId}`;

      const response = await fetch(url, {
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`TwitterAPI.io error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform twitterapi.io response to match our interface
      const tweets: Tweet[] = [];
      
      // twitterapi.io returns tweets in data.tweets array
      const tweetsArray = data.data?.tweets || [];
      if (Array.isArray(tweetsArray)) {
        tweetsArray.forEach((tweetData: any) => {
          const tweetId = tweetData.id || tweetData.id_str;
          tweets.push({
            id: tweetId,
            text: tweetData.text || '',
            author_id: tweetData.author?.id || userIdOrUsername,
            created_at: tweetData.createdAt || new Date().toISOString(),
            // Construct Twitter URL for individual tweet
            url: `https://twitter.com/${userIdOrUsername}/status/${tweetId}`,
            public_metrics: {
              retweet_count: tweetData.retweetCount || 0,
              like_count: tweetData.likeCount || 0,
              reply_count: tweetData.replyCount || 0,
              quote_count: tweetData.quoteCount || 0
            },
            entities: {
              cashtags: this.extractCashtagsFromText(tweetData.text || ''),
              hashtags: tweetData.entities?.hashtags?.map((tag: any) => ({
                start: tag.indices?.[0] || 0,
                end: tag.indices?.[1] || 0,
                tag: tag.text || ''
              })) || [],
              urls: tweetData.entities?.urls?.map((url: any) => ({
                start: url.indices?.[0] || 0,
                end: url.indices?.[1] || 0,
                url: url.url || '',
                expanded_url: url.expanded_url || '',
                display_url: url.display_url || ''
              })) || []
            }
          });
        });
      }

      console.log(`✅ Fetched ${tweets.length} tweets via twitterapi.io`);

      return {
        tweets,
        nextToken: undefined // twitterapi.io uses different pagination
      };

    } catch (error) {
      console.error(`❌ Error fetching tweets for user ${userIdOrUsername}:`, error);
      console.log(`🚫 No mock data fallback - returning empty tweets for user ${userIdOrUsername}`);
      return { tweets: [] };
    }
  }

  /**
   * Extract cashtags from tweet text (helper for twitterapi.io response transformation)
   */
  private extractCashtagsFromText(text: string): Array<{ start: number; end: number; tag: string }> {
    const cashtags: Array<{ start: number; end: number; tag: string }> = [];
    const cashtagPattern = /\$([A-Z]{1,5})\b/g;
    let match;
    
    while ((match = cashtagPattern.exec(text)) !== null) {
      cashtags.push({
        start: match.index,
        end: match.index + match[0].length,
        tag: match[1]
      });
    }
    
    return cashtags;
  }

  /**
   * Fetch tweets from multiple users using twitterapi.io (supports high QPS)
   */
  async getMultipleUserTweets(
    usernames: string[],
    options: Parameters<typeof this.getUserTweets>[1] = {}
  ): Promise<Array<{ username: string; tweets: Tweet[]; user?: TwitterUser }>> {
    console.log(`🐦 Processing ${usernames.length} Twitter users via twitterapi.io (no rate limits!)`);
    
    const results = [];

    for (const username of usernames) {
      try {
        // Get user info first
        const user = await this.getUserByUsername(username);
        if (!user) {
          console.warn(`⚠️ User @${username} not found, skipping`);
          continue;
        }

        // Get their tweets (use username for twitterapi.io)
        const { tweets } = await this.getUserTweets(username, options);
        
        results.push({
          username,
          tweets,
          user
        });

        // Minimal delay to be respectful (twitterapi.io supports 200 QPS)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Failed to fetch tweets from @${username}:`, error);
        console.log(`🚫 Skipping @${username} - no mock data fallback`);
      }
    }

    console.log(`✅ Completed processing ${usernames.length} users, got ${results.length} results`);
    return results;
  }

  /**
   * Extract stock tickers from tweet content
   */
  extractStockTickers(tweet: Tweet): Array<{ ticker: string; context: string; confidence: number }> {
    const tickers: Array<{ ticker: string; context: string; confidence: number }> = [];
    
    // Check for explicit cashtags first (highest confidence)
    if (tweet.entities?.cashtags) {
      tweet.entities.cashtags.forEach(cashtag => {
        const ticker = cashtag.tag.toUpperCase();
        if (this.isValidTicker(ticker)) {
          tickers.push({
            ticker,
            context: tweet.text,
            confidence: 0.95 // Very high confidence for cashtags
          });
        }
      });
    }

    // Look for other ticker patterns in text
    const textTickers = this.extractTickersFromText(tweet.text);
    textTickers.forEach(item => {
      // Avoid duplicates from cashtags
      if (!tickers.find(t => t.ticker === item.ticker)) {
        tickers.push(item);
      }
    });

    return tickers;
  }

  /**
   * Extract tickers from plain text
   */
  private extractTickersFromText(text: string): Array<{ ticker: string; context: string; confidence: number }> {
    const tickers: Array<{ ticker: string; context: string; confidence: number }> = [];
    
    // Stock ticker patterns (similar to Reddit but adapted for Twitter)
    const tickerPatterns = [
      /\$([A-Z]{1,5})\b/g,           // $AAPL format
      /\b([A-Z]{2,5})\s+stock/gi,   // "AAPL stock" format
      /\b([A-Z]{2,5})\s+earnings/gi, // "AAPL earnings" format
    ];

    tickerPatterns.forEach((pattern, patternIndex) => {
      let match;
      
      while ((match = pattern.exec(text)) !== null) {
        const ticker = match[1].toUpperCase();
        
        if (this.isValidTicker(ticker)) {
          let confidence = 0.7; // Base confidence
          
          if (patternIndex === 0) confidence = 0.9; // $TICKER format is most reliable
          if (text.toLowerCase().includes('bullish')) confidence += 0.1;
          if (text.toLowerCase().includes('bearish')) confidence += 0.1;
          if (text.toLowerCase().includes('earnings')) confidence += 0.1;
          
          confidence = Math.min(1.0, confidence);
          
          tickers.push({ 
            ticker, 
            context: text, 
            confidence 
          });
        }
      }
    });

    return tickers;
  }

  /**
   * Validate if a string could be a valid stock ticker
   */
  private isValidTicker(ticker: string): boolean {
    // Filter out common false positives (same as Reddit)
    const blacklist = [
      'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD', 'HER', 'WAS', 'ONE',
      'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'NEW', 'NOW', 'OLD', 'SEE',
      'TWO', 'WHO', 'BOY', 'DID', 'ITS', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE', 'WE', 'WILL',
      'CEO', 'CFO', 'IPO', 'SEC', 'FDA', 'NYSE', 'NASDAQ', 'AI', 'ML', 'VR', 'AR', 'EV', 'ESG'
    ];

    return ticker.length >= 1 && 
           ticker.length <= 5 && 
           !blacklist.includes(ticker) &&
           /^[A-Z]+$/.test(ticker);
  }

  /**
   * Get trending tickers from recent tweets
   */
  async getTrendingTickers(
    usernames: string[],
    hoursBack: number = 24
  ): Promise<Array<{ ticker: string; mentions: number; avgLikes: number; contexts: string[] }>> {
    const tickerCounts = new Map<string, { 
      count: number; 
      totalLikes: number; 
      contexts: string[] 
    }>();

    const results = await this.getMultipleUserTweets(usernames, {
      maxResults: 100
    });

    const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));

    results.forEach(({ tweets }) => {
      tweets.forEach(tweet => {
        // Only consider recent tweets
        const tweetTime = new Date(tweet.created_at);
        if (tweetTime < cutoffTime) return;

        const tickers = this.extractStockTickers(tweet);

        tickers.forEach(({ ticker, context, confidence }) => {
          if (confidence > 0.7) { // Only high-confidence mentions
            const existing = tickerCounts.get(ticker) || { 
              count: 0, 
              totalLikes: 0, 
              contexts: [] 
            };
            
            existing.count++;
            existing.totalLikes += tweet.public_metrics.like_count;
            existing.contexts.push(context);
            
            tickerCounts.set(ticker, existing);
          }
        });
      });
    });

    // Convert to array and sort by mention count
    return Array.from(tickerCounts.entries())
      .map(([ticker, data]) => ({
        ticker,
        mentions: data.count,
        avgLikes: data.totalLikes / data.count,
        contexts: data.contexts.slice(0, 5) // Top 5 contexts
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 50); // Top 50 trending tickers
  }

  /**
   * Extract ticker data from already-fetched results (to avoid duplicate API calls)
   */
  extractTickersFromResults(
    results: Array<{ username: string; tweets: Tweet[]; user?: TwitterUser }>,
    hoursBack: number = 24
  ): Array<{ ticker: string; mentions: number; avgLikes: number; contexts: string[] }> {
    const tickerCounts = new Map<string, { 
      count: number; 
      totalLikes: number; 
      contexts: string[] 
    }>();

    const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));

    results.forEach(({ tweets }) => {
      tweets.forEach(tweet => {
        // Only consider recent tweets
        const tweetTime = new Date(tweet.created_at);
        if (tweetTime < cutoffTime) return;

        const tickers = this.extractStockTickers(tweet);

        tickers.forEach(({ ticker, context, confidence }) => {
          if (confidence > 0.7) { // Only high-confidence mentions
            const existing = tickerCounts.get(ticker) || { 
              count: 0, 
              totalLikes: 0, 
              contexts: [] 
            };
            
            existing.count++;
            existing.totalLikes += tweet.public_metrics.like_count;
            existing.contexts.push(context);
            
            tickerCounts.set(ticker, existing);
          }
        });
      });
    });

    // Convert to array and calculate averages
    return Array.from(tickerCounts.entries())
      .map(([ticker, data]) => ({
        ticker,
        mentions: data.count,
        avgLikes: data.totalLikes / data.count,
        contexts: data.contexts.slice(0, 5) // Top 5 contexts
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 50); // Top 50 trending tickers
  }

}
