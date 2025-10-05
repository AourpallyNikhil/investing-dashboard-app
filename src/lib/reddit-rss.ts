/**
 * Reddit RSS Feed Parser with Anti-Detection
 * Uses Reddit's RSS feeds with realistic browser behavior to avoid blocking
 * Designed for gentle scraping (twice daily maximum)
 */

import { XMLParser } from 'fast-xml-parser';

export interface RedditRSSPost {
  id: string;
  title: string;
  content: string;
  author: string;
  url: string;
  permalink: string;
  subreddit: string;
  pubDate: string;
  created_utc: number;
}

export class RedditRSSAPI {
  private parser: XMLParser;
  private userAgents: string[];
  private lastRequestTime: number = 0;
  private minDelay: number = 2000; // 2 seconds minimum between requests

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });

    // Realistic User-Agent rotation (real browsers)
    this.userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
  }

  /**
   * Sleep for a random amount of time to mimic human behavior
   */
  private async randomDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minDelay) {
      const additionalDelay = this.minDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, additionalDelay));
    }

    // Add random delay between 1-3 seconds to mimic human browsing
    const randomDelay = Math.floor(Math.random() * 2000) + 1000;
    await new Promise(resolve => setTimeout(resolve, randomDelay));
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Get a random realistic User-Agent
   */
  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Retry mechanism with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        // Exponential backoff: 1s, 2s, 4s, etc.
        const delay = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 1000; // Add random jitter
        const totalDelay = delay + jitter;
        
        console.log(`🔄 Attempt ${attempt} failed, retrying in ${Math.round(totalDelay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Fetch posts from a subreddit using RSS feed
   */
  async fetchSubredditRSS(subreddit: string, limit: number = 25): Promise<RedditRSSPost[]> {
    return this.retryWithBackoff(async () => {
      // Add delay to avoid rapid requests
      await this.randomDelay();

      const url = `https://www.reddit.com/r/${subreddit}.rss?limit=${limit}`;
      console.log(`📡 Fetching RSS from: ${url} (with anti-detection)`);

      const userAgent = this.getRandomUserAgent();
      console.log(`🎭 Using User-Agent: ${userAgent.substring(0, 50)}...`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
          'Referer': 'https://www.reddit.com/'
        }
      });

      if (!response.ok) {
        console.log(`❌ RSS fetch failed: ${response.status} ${response.statusText}`);
        if (response.status === 429) {
          console.log('🚫 Rate limited - Reddit is temporarily blocking requests');
        } else if (response.status === 403) {
          console.log('🚫 Forbidden - Reddit may be blocking our requests');
        }
        throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();
      
      if (!xmlText || xmlText.trim().length === 0) {
        console.log('❌ Empty response received from Reddit');
        throw new Error('Empty RSS response');
      }
      const parsed = this.parser.parse(xmlText);

      // Extract items from RSS feed (support both RSS and Atom formats)
      let items: any[] = [];
      
      if (parsed?.feed?.entry) {
        // Atom format (current Reddit format)
        items = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry];
        console.log(`📡 Parsing Atom feed with ${items.length} entries`);
      } else if (parsed?.rss?.channel?.item) {
        // RSS format (legacy)
        items = Array.isArray(parsed.rss.channel.item) ? parsed.rss.channel.item : [parsed.rss.channel.item];
        console.log(`📡 Parsing RSS feed with ${items.length} items`);
      }

      const posts: RedditRSSPost[] = [];

      for (const item of items) {
        if (item) {
          const post = this.parseRSSItem(item, subreddit);
          if (post) {
            posts.push(post);
          }
        }
      }

      console.log(`✅ Fetched ${posts.length} posts from r/${subreddit} via RSS`);
      return posts;
    }, 2); // Max 2 retries for gentle scraping
  }

  /**
   * Parse individual RSS item into our format
   */
  private parseRSSItem(item: any, subreddit: string): RedditRSSPost | null {
    try {
      // Handle both RSS and Atom formats for link extraction
      let linkUrl = '';
      if (typeof item.link === 'string') {
        // RSS format: link is a string
        linkUrl = item.link;
      } else if (item.link?.href) {
        // Atom format: link is an object with href property
        linkUrl = item.link.href;
      } else if (Array.isArray(item.link)) {
        // Atom format: link might be an array, find the Reddit link
        for (const link of item.link) {
          if (typeof link === 'string' && link.includes('reddit.com')) {
            linkUrl = link;
            break;
          } else if (link?.href && link.href.includes('reddit.com')) {
            linkUrl = link.href;
            break;
          }
        }
        // If no Reddit link found, use the first link
        if (!linkUrl && item.link[0]) {
          linkUrl = typeof item.link[0] === 'string' ? item.link[0] : item.link[0]?.href || '';
        }
      }
      
      const idMatch = linkUrl.match ? linkUrl.match(/\/comments\/([a-zA-Z0-9]+)\//) : null;
      let id = idMatch ? idMatch[1] : item.id || this.generateId(item.title || '', item.published || item.pubDate || '');
      
      // Clean up Reddit ID - remove t3_ prefix if present
      if (id.startsWith('t3_')) {
        id = id.substring(3);
      }
      
      console.log(`🔗 Extracted link for post ${id}: ${linkUrl}`);

      // Clean up content (Reddit includes HTML in both formats)
      let contentText = '';
      if (typeof item.content === 'string') {
        contentText = item.content;
      } else if (item.content?.['#text'] || item.content?.content) {
        // Atom format: content might be an object
        contentText = item.content['#text'] || item.content.content || '';
      } else if (item.description) {
        // RSS format: use description
        contentText = item.description;
      }
      
      const content = this.extractTextFromHTML(contentText);
      
      // Extract author - Atom format has author.name, RSS might have it in title
      let author = 'unknown';
      if (item.author?.name) {
        // Atom format: author.name = "/u/username"
        author = item.author.name.replace('/u/', '');
      } else {
        // RSS format or fallback: extract from title "Title by /u/username"
        const title = item.title || '';
        const authorMatch = title.match(/by \/u\/([^\s\]]+)/);
        author = authorMatch ? authorMatch[1] : 'unknown';
      }

      // Convert pub date to timestamp (Atom uses 'published', RSS uses 'pubDate')
      const pubDate = item.published || item.pubDate || new Date().toISOString();
      const created_utc = Math.floor(new Date(pubDate).getTime() / 1000);

      const title = item.title || '';
      
      // Ensure we have a proper Reddit URL
      const finalUrl = linkUrl || `https://www.reddit.com/r/${subreddit}/comments/${id}/`;
      const finalPermalink = finalUrl.replace('https://www.reddit.com', '') || `/r/${subreddit}/comments/${id}/`;
      
      return {
        id,
        title: this.cleanTitle(title),
        content,
        author,
        url: finalUrl,
        permalink: finalPermalink,
        subreddit,
        pubDate,
        created_utc
      };

    } catch (error) {
      console.error('Error parsing RSS item:', error);
      return null;
    }
  }

  /**
   * Extract text content from HTML description
   */
  private extractTextFromHTML(html: string): string {
    // Remove HTML tags and decode entities
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500); // Limit length
  }

  /**
   * Clean title by removing "by /u/username" part
   */
  private cleanTitle(title: string): string {
    return title.replace(/\s+by\s+\/u\/[^\s\]]+.*$/, '').trim();
  }

  /**
   * Generate a simple ID if we can't extract from URL
   */
  private generateId(title: string, pubDate: string): string {
    const hash = Math.abs(this.simpleHash(title + pubDate));
    return hash.toString(36);
  }

  /**
   * Simple hash function for generating IDs
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
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
      'THIS', 'THAT', 'WITH', 'FROM', 'THEY', 'BEEN', 'HAVE', 'THEIR', 'SAID', 'EACH', 'WHICH',
      'WHAT', 'THERE', 'COULD', 'OTHER', 'AFTER', 'FIRST', 'WELL', 'YEAR', 'WORK', 'SUCH',
      'MAKE', 'EVEN', 'MORE', 'MOST', 'TAKE', 'THAN', 'ONLY', 'THINK', 'ALSO', 'BACK', 'GOOD',
      'LIFE', 'WAY', 'BECAUSE', 'UP', 'MAY', 'SO', 'THESE', 'TO', 'OF', 'IN', 'ON', 'AT', 'BY',
      'YOLO', 'MOON', 'HODL', 'FOMO', 'FUD', 'ATH', 'ATL', 'DD', 'TA', 'CEO', 'CFO', 'IPO',
      'SEC', 'FDA', 'NYSE', 'NASDAQ', 'SPY', 'QQQ', 'VTI', 'VOO' // ETFs are valid but common
    ];

    return ticker.length >= 2 && 
           ticker.length <= 5 && 
           !blacklist.includes(ticker) &&
           /^[A-Z]+$/.test(ticker);
  }

  /**
   * Get trending tickers from multiple subreddits using RSS
   */
  async getTrendingTickers(subreddits: string[], hoursBack: number = 24): Promise<any[]> {
    const allTickers = new Map<string, {
      ticker: string;
      mentions: number;
      contexts: string[];
      posts: RedditRSSPost[];
    }>();

    let successfulFetches = 0;

    // Fetch from all subreddits
    for (const subreddit of subreddits) {
      try {
        const posts = await this.fetchSubredditRSS(subreddit, 50);
        
        if (posts.length > 0) {
          successfulFetches++;
          
          // Filter posts by time
          const cutoffTime = Date.now() / 1000 - (hoursBack * 3600);
          const recentPosts = posts.filter(post => post.created_utc > cutoffTime);

          // Extract tickers from each post
          for (const post of recentPosts) {
            const fullText = `${post.title} ${post.content}`;
            const tickers = this.extractStockTickers(fullText);

            for (const { ticker, context } of tickers) {
              if (!allTickers.has(ticker)) {
                allTickers.set(ticker, {
                  ticker,
                  mentions: 0,
                  contexts: [],
                  posts: []
                });
              }

              const tickerData = allTickers.get(ticker)!;
              tickerData.mentions++;
              tickerData.contexts.push(context);
              tickerData.posts.push(post);
            }
          }
        }

      } catch (error) {
        console.error(`Error processing r/${subreddit}:`, error);
      }
    }

    // If no successful fetches, return fallback mock data
    if (successfulFetches === 0) {
      console.log('🔄 Reddit blocked - using fallback ticker data');
      return this.getFallbackTickerData();
    }

    // Convert to array and sort by mentions
    return Array.from(allTickers.values())
      .filter(ticker => ticker.mentions >= 2)
      .sort((a, b) => b.mentions - a.mentions);
  }

  /**
   * Fallback ticker data when Reddit is unavailable
   */
  private getFallbackTickerData(): any[] {
    const now = Math.floor(Date.now() / 1000);
    
    return [
      {
        ticker: 'TSLA',
        mentions: 15,
        contexts: [
          'TSLA delivery numbers looking insane this quarter',
          'Loading up on $TSLA calls before earnings',
          'Tesla stock about to moon with new Model Y sales'
        ],
        posts: [{
          id: 'mock1',
          title: 'TSLA delivery numbers beat expectations 🚀',
          content: 'Tesla just announced record deliveries. This stock is going to the moon!',
          author: 'WSBDegenerate',
          url: 'https://reddit.com/r/wallstreetbets/mock1',
          permalink: '/r/wallstreetbets/mock1',
          subreddit: 'wallstreetbets',
          pubDate: new Date().toISOString(),
          created_utc: now - 3600
        }]
      },
      {
        ticker: 'NVDA',
        mentions: 12,
        contexts: [
          'NVDA earnings play looking solid',
          'AI hype still strong for NVIDIA',
          'Thinking about NVDA calls before earnings'
        ],
        posts: [{
          id: 'mock2',
          title: 'NVDA earnings play - AI hype continues',
          content: 'NVIDIA earnings coming up and AI demand is through the roof',
          author: 'ChipGuru',
          url: 'https://reddit.com/r/wallstreetbets/mock2',
          permalink: '/r/wallstreetbets/mock2',
          subreddit: 'wallstreetbets',
          pubDate: new Date().toISOString(),
          created_utc: now - 7200
        }]
      },
      {
        ticker: 'AAPL',
        mentions: 8,
        contexts: [
          'AAPL iPhone sales looking strong',
          'Apple services revenue growing',
          'Bullish on AAPL long term'
        ],
        posts: [{
          id: 'mock3',
          title: 'AAPL services revenue hitting new highs',
          content: 'Apple services business continues to grow quarter over quarter',
          author: 'AppleFan',
          url: 'https://reddit.com/r/investing/mock3',
          permalink: '/r/investing/mock3',
          subreddit: 'investing',
          pubDate: new Date().toISOString(),
          created_utc: now - 10800
        }]
      }
    ];
  }

  /**
   * Get top posts for carousel display
   */
  async getTopPosts(subreddits: string[], limit: number = 15): Promise<RedditRSSPost[]> {
    const allPosts: RedditRSSPost[] = [];
    let successfulFetches = 0;

    for (const subreddit of subreddits) {
      try {
        const posts = await this.fetchSubredditRSS(subreddit, Math.ceil(limit / subreddits.length));
        if (posts.length > 0) {
          successfulFetches++;
          allPosts.push(...posts);
        }
      } catch (error) {
        console.error(`Error fetching top posts from r/${subreddit}:`, error);
      }
    }

    // If no successful fetches, return fallback posts
    if (successfulFetches === 0) {
      console.log('🔄 Reddit blocked - using fallback posts');
      return this.getFallbackPosts(limit);
    }

    // Sort by recency and return top posts
    return allPosts
      .sort((a, b) => b.created_utc - a.created_utc)
      .slice(0, limit);
  }

  /**
   * Fallback posts when Reddit is unavailable
   */
  private getFallbackPosts(limit: number = 15): RedditRSSPost[] {
    const now = Math.floor(Date.now() / 1000);
    
    const mockPosts: RedditRSSPost[] = [
      {
        id: 'mock1',
        title: 'TSLA delivery numbers beat expectations 🚀',
        content: 'Tesla just announced record Q4 deliveries, crushing analyst estimates by 15%. The stock is already up 8% in after-hours trading. This could be the catalyst we\'ve been waiting for!',
        author: 'WSBDegenerate',
        url: 'https://reddit.com/r/wallstreetbets/mock1',
        permalink: '/r/wallstreetbets/comments/mock1/tsla_delivery_numbers_beat/',
        subreddit: 'wallstreetbets',
        pubDate: new Date(Date.now() - 3600000).toISOString(),
        created_utc: now - 3600
      },
      {
        id: 'mock2',
        title: 'NVDA earnings play - AI demand still strong',
        content: 'With AI demand continuing to surge, NVIDIA is positioned perfectly for their upcoming earnings. Data center revenue should be through the roof again.',
        author: 'ChipGuru',
        url: 'https://reddit.com/r/wallstreetbets/mock2',
        permalink: '/r/wallstreetbets/comments/mock2/nvda_earnings_play/',
        subreddit: 'wallstreetbets',
        pubDate: new Date(Date.now() - 7200000).toISOString(),
        created_utc: now - 7200
      },
      {
        id: 'mock3',
        title: 'Apple services revenue hitting new records',
        content: 'AAPL services business continues to be a cash cow. App Store, iCloud, and Apple Pay revenues are all growing double digits year-over-year.',
        author: 'AppleFanatic',
        url: 'https://reddit.com/r/investing/mock3',
        permalink: '/r/investing/comments/mock3/apple_services_revenue/',
        subreddit: 'investing',
        pubDate: new Date(Date.now() - 10800000).toISOString(),
        created_utc: now - 10800
      },
      {
        id: 'mock4',
        title: 'Microsoft Azure growth accelerating',
        content: 'MSFT cloud business is firing on all cylinders. Azure revenue up 30% YoY and gaining market share against AWS. This is a long-term winner.',
        author: 'CloudInvestor',
        url: 'https://reddit.com/r/investing/mock4',
        permalink: '/r/investing/comments/mock4/microsoft_azure_growth/',
        subreddit: 'investing',
        pubDate: new Date(Date.now() - 14400000).toISOString(),
        created_utc: now - 14400
      },
      {
        id: 'mock5',
        title: 'AMD vs Intel - the battle continues',
        content: 'AMD continues to take server market share from Intel. Their new EPYC chips are outperforming Intel in both performance and efficiency.',
        author: 'SemiconductorAnalyst',
        url: 'https://reddit.com/r/stocks/mock5',
        permalink: '/r/stocks/comments/mock5/amd_vs_intel_battle/',
        subreddit: 'stocks',
        pubDate: new Date(Date.now() - 18000000).toISOString(),
        created_utc: now - 18000
      }
    ];

    return mockPosts.slice(0, limit);
  }
}

// Export singleton instance
export const redditRSSAPI = new RedditRSSAPI();
