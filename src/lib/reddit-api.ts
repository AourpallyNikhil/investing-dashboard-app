/**
 * Reddit API Integration for Sentiment Analysis
 * Fetches posts from specified subreddits for stock sentiment tracking
 */

interface RedditPost {
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

interface RedditResponse {
  data: {
    children: Array<{
      data: RedditPost;
    }>;
    after: string | null;
  };
}

export class RedditAPI {
  private readonly baseUrl = 'https://www.reddit.com';
  private readonly userAgent = 'InvestingDashboard/1.0';
  
  constructor() {}

  /**
   * Fetch posts from a specific subreddit
   */
  async fetchSubredditPosts(
    subreddit: string, 
    options: {
      sort?: 'hot' | 'new' | 'rising' | 'top';
      timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      limit?: number;
      after?: string;
    } = {}
  ): Promise<{ posts: RedditPost[]; after: string | null }> {
    const {
      sort = 'hot',
      timeframe = 'day',
      limit = 100,
      after
    } = options;

    try {
      let url = `${this.baseUrl}/r/${subreddit}/${sort}.json?limit=${limit}`;
      
      if (sort === 'top' && timeframe) {
        url += `&t=${timeframe}`;
      }
      
      if (after) {
        url += `&after=${after}`;
      }

      console.log(`📱 Fetching Reddit posts from r/${subreddit}...`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
      }

      const data: RedditResponse = await response.json();
      const posts = data.data.children.map(child => child.data);

      console.log(`✅ Fetched ${posts.length} posts from r/${subreddit}`);

      return {
        posts,
        after: data.data.after
      };

    } catch (error) {
      console.error(`❌ Error fetching from r/${subreddit}:`, error);
      throw error;
    }
  }

  /**
   * Fetch posts from multiple subreddits
   */
  async fetchMultipleSubreddits(
    subreddits: string[],
    options: Parameters<typeof this.fetchSubredditPosts>[1] = {}
  ): Promise<Array<{ subreddit: string; posts: RedditPost[]; after: string | null }>> {
    const results = [];

    for (const subreddit of subreddits) {
      try {
        const result = await this.fetchSubredditPosts(subreddit, options);
        results.push({
          subreddit,
          ...result
        });
        
        // Rate limiting: wait between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Failed to fetch r/${subreddit}:`, error);
        results.push({
          subreddit,
          posts: [],
          after: null
        });
      }
    }

    return results;
  }

  /**
   * Extract stock tickers from post content
   */
  extractStockTickers(text: string): Array<{ ticker: string; context: string; confidence: number }> {
    const tickers: Array<{ ticker: string; context: string; confidence: number }> = [];
    
    // Common stock ticker patterns
    const tickerPatterns = [
      /\$([A-Z]{1,5})\b/g,           // $AAPL format
      /\b([A-Z]{2,5})\s+stock/gi,   // "AAPL stock" format
      /\b([A-Z]{2,5})\s+calls?/gi,  // "AAPL calls" format  
      /\b([A-Z]{2,5})\s+puts?/gi,   // "AAPL puts" format
    ];

    // Extract context around ticker mentions (50 chars before/after)
    const getContext = (match: RegExpMatchArray, fullText: string): string => {
      const start = Math.max(0, match.index! - 50);
      const end = Math.min(fullText.length, match.index! + match[0].length + 50);
      return fullText.slice(start, end).trim();
    };

    // Apply each pattern
    tickerPatterns.forEach((pattern, patternIndex) => {
      let match;
      const usedText = text.toUpperCase();
      
      while ((match = pattern.exec(text)) !== null) {
        const ticker = match[1].toUpperCase();
        
        // Filter out common false positives
        if (this.isValidTicker(ticker)) {
          const context = getContext(match, text);
          
          // Confidence based on pattern type and context
          let confidence = 0.7; // Base confidence
          
          if (patternIndex === 0) confidence = 0.9; // $TICKER format is most reliable
          if (context.toLowerCase().includes('buy')) confidence += 0.1;
          if (context.toLowerCase().includes('sell')) confidence += 0.1;
          if (context.toLowerCase().includes('earnings')) confidence += 0.1;
          
          confidence = Math.min(1.0, confidence);
          
          tickers.push({ ticker, context, confidence });
        }
      }
    });

    // Remove duplicates and return highest confidence for each ticker
    const uniqueTickers = new Map<string, { ticker: string; context: string; confidence: number }>();
    
    tickers.forEach(item => {
      const existing = uniqueTickers.get(item.ticker);
      if (!existing || item.confidence > existing.confidence) {
        uniqueTickers.set(item.ticker, item);
      }
    });

    return Array.from(uniqueTickers.values());
  }

  /**
   * Validate if a string could be a valid stock ticker
   */
  private isValidTicker(ticker: string): boolean {
    // Filter out common false positives
    const blacklist = [
      'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD', 'HER', 'WAS', 'ONE',
      'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'NEW', 'NOW', 'OLD', 'SEE',
      'TWO', 'WHO', 'BOY', 'DID', 'ITS', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE', 'WE', 'WILL',
      'YOLO', 'MOON', 'HODL', 'FOMO', 'FUD', 'ATH', 'ATL', 'DD', 'TA', 'CEO', 'CFO', 'IPO',
      'SEC', 'FDA', 'NYSE', 'NASDAQ', 'SPY', 'QQQ', 'VTI', 'VOO' // ETFs are valid but common
    ];

    return ticker.length >= 1 && 
           ticker.length <= 5 && 
           !blacklist.includes(ticker) &&
           /^[A-Z]+$/.test(ticker);
  }

  /**
   * Get trending tickers from recent posts
   */
  async getTrendingTickers(
    subreddits: string[],
    hoursBack: number = 24
  ): Promise<Array<{ ticker: string; mentions: number; avgScore: number; contexts: string[] }>> {
    const tickerCounts = new Map<string, { 
      count: number; 
      totalScore: number; 
      contexts: string[] 
    }>();

    const results = await this.fetchMultipleSubreddits(subreddits, {
      sort: 'new',
      limit: 100
    });

    const cutoffTime = Date.now() / 1000 - (hoursBack * 3600);

    results.forEach(({ posts }) => {
      posts.forEach(post => {
        // Only consider recent posts
        if (post.created_utc < cutoffTime) return;

        const content = `${post.title} ${post.selftext}`;
        const tickers = this.extractStockTickers(content);

        tickers.forEach(({ ticker, context, confidence }) => {
          if (confidence > 0.7) { // Only high-confidence mentions
            const existing = tickerCounts.get(ticker) || { 
              count: 0, 
              totalScore: 0, 
              contexts: [] 
            };
            
            existing.count++;
            existing.totalScore += post.score;
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
        avgScore: data.totalScore / data.count,
        contexts: data.contexts.slice(0, 5) // Top 5 contexts
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 50); // Top 50 trending tickers
  }
}
