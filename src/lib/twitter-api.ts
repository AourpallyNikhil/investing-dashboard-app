/**
 * Twitter/X API Integration for Sentiment Analysis
 * Fetches tweets from specified influencers for stock sentiment tracking
 */

interface Tweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
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
  private readonly baseUrl = 'https://api.twitter.com/2';
  private readonly bearerToken: string;
  
  constructor(bearerToken?: string) {
    this.bearerToken = bearerToken || process.env.TWITTER_BEARER_TOKEN || '';
    
    if (!this.bearerToken) {
      console.warn('⚠️ Twitter Bearer Token not provided. Twitter integration will use mock data.');
    }
  }

  /**
   * Get user ID by username
   */
  async getUserByUsername(username: string): Promise<TwitterUser | null> {
    if (!this.bearerToken) {
      return this.getMockUser(username);
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/users/by/username/${username}?user.fields=public_metrics`,
        {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || null;

    } catch (error) {
      console.error(`❌ Error fetching Twitter user @${username}:`, error);
      return null;
    }
  }

  /**
   * Fetch recent tweets from a user
   */
  async getUserTweets(
    userId: string,
    options: {
      maxResults?: number;
      sinceId?: string;
      untilId?: string;
      paginationToken?: string;
    } = {}
  ): Promise<{ tweets: Tweet[]; nextToken?: string }> {
    const {
      maxResults = 100,
      sinceId,
      untilId,
      paginationToken
    } = options;

    if (!this.bearerToken) {
      return { tweets: this.getMockTweets(userId) };
    }

    try {
      let url = `${this.baseUrl}/users/${userId}/tweets?` +
        `max_results=${maxResults}&` +
        `tweet.fields=created_at,public_metrics,context_annotations,entities&` +
        `expansions=author_id&` +
        `user.fields=username,name,public_metrics`;

      if (sinceId) url += `&since_id=${sinceId}`;
      if (untilId) url += `&until_id=${untilId}`;
      if (paginationToken) url += `&pagination_token=${paginationToken}`;

      console.log(`🐦 Fetching tweets for user ${userId}...`);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
      }

      const data: TwitterResponse = await response.json();
      const tweets = data.data || [];

      console.log(`✅ Fetched ${tweets.length} tweets`);

      return {
        tweets,
        nextToken: data.meta?.next_token
      };

    } catch (error) {
      console.error(`❌ Error fetching tweets for user ${userId}:`, error);
      return { tweets: [] };
    }
  }

  /**
   * Fetch tweets from multiple users
   */
  async getMultipleUserTweets(
    usernames: string[],
    options: Parameters<typeof this.getUserTweets>[1] = {}
  ): Promise<Array<{ username: string; tweets: Tweet[]; user?: TwitterUser }>> {
    const results = [];

    for (const username of usernames) {
      try {
        // Get user info first
        const user = await this.getUserByUsername(username);
        if (!user) {
          console.warn(`⚠️ User @${username} not found`);
          continue;
        }

        // Get their tweets
        const { tweets } = await this.getUserTweets(user.id, options);
        
        results.push({
          username,
          tweets,
          user
        });

        // Rate limiting: wait between requests
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Failed to fetch tweets from @${username}:`, error);
        results.push({
          username,
          tweets: [],
          user: undefined
        });
      }
    }

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
   * Mock data for development/testing when no API key
   */
  private getMockUser(username: string): TwitterUser {
    return {
      id: `mock_${username}`,
      username,
      name: `Mock ${username}`,
      public_metrics: {
        followers_count: Math.floor(Math.random() * 1000000),
        following_count: Math.floor(Math.random() * 1000),
        tweet_count: Math.floor(Math.random() * 10000)
      }
    };
  }

  private getMockTweets(userId: string): Tweet[] {
    const mockTickers = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META'];
    const mockTweets: Tweet[] = [];

    for (let i = 0; i < 10; i++) {
      const ticker = mockTickers[Math.floor(Math.random() * mockTickers.length)];
      mockTweets.push({
        id: `mock_tweet_${userId}_${i}`,
        text: `Just analyzed $${ticker} - looking very promising for Q4 earnings! 🚀 #investing #stocks`,
        author_id: userId,
        created_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        public_metrics: {
          retweet_count: Math.floor(Math.random() * 100),
          like_count: Math.floor(Math.random() * 500),
          reply_count: Math.floor(Math.random() * 50),
          quote_count: Math.floor(Math.random() * 20)
        },
        entities: {
          cashtags: [{ start: 13, end: 18, tag: ticker }]
        }
      });
    }

    return mockTweets;
  }
}
