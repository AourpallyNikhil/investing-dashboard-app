# 🏗️ Investing Dashboard Architecture

A comprehensive financial analysis platform with AI-powered Reddit sentiment analysis, real-time financial data, and automated data collection via cron jobs.

## 🎯 System Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │   Database      │
│   Next.js 14   │◄──►│   Next.js Routes │◄──►│   Supabase      │
│   React/TS      │    │   + Cron Jobs    │    │   PostgreSQL    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌──────────────────┐             │
         │              │  External APIs   │             │
         └──────────────┤  • Reddit RSS    │─────────────┘
                        │  • Financial     │
                        │    Datasets      │
                        │  • Gemini AI     │
                        └──────────────────┘
```

## 🗄️ Database Schema

### Financial Data Tables
```sql
-- Company master data
companies: ticker, name, sector, industry, market_cap

-- Real-time financial metrics (30+ ratios)
financial_metrics: ticker, period, pe_ratio, revenue_growth, margins, ratios...

-- Complete financial statements (50+ fields)
financial_statements: ticker, period, revenue, income, assets, cash_flows...

-- Economic indicators
economic_data: series_id, value, date, inflation, employment...
inflation_data: period, cpi_value, inflation_rate
```

### Sentiment Analysis Tables
```sql
-- Raw Reddit posts (comprehensive metadata)
reddit_posts_raw: 
  post_id, title, selftext, author, subreddit, score, num_comments
  extracted_tickers[], sentiment_score, key_topics[], ai_summary
  raw_json, retrieved_at

-- Reddit comments (threaded discussions)  
reddit_comments:
  comment_id, post_id, parent_id, body, author, score, depth
  extracted_tickers[], sentiment_score, argument_type
  raw_json, retrieved_at

-- Processed sentiment aggregations
sentiment_data:
  ticker, sentiment_score, mention_count, key_themes[]
  source_breakdown{reddit, twitter}, trending_contexts[]
```

### Key Database Views
```sql
reddit_posts_with_sentiment     -- Posts with AI analysis
reddit_comments_with_context    -- Comments + post context  
reddit_comment_threads          -- Thread aggregations
reddit_posts_by_ticker          -- Posts organized by stock
reddit_comments_by_ticker       -- Comments by stock mention
```

## 🔌 API Architecture

### Core API Routes
```typescript
/api/sentiment-data              // Serve sentiment data from database
/api/cron/sentiment-data         // Daily cron job (6 AM UTC)
/api/financial-data             // Stock metrics & fundamentals
/api/economic-data              // Macro indicators (inflation, employment)
/api/institutional-ownership    // Smart money tracking
/api/ticker-lookup              // Company search & validation
```

### Data Flow
```
Daily 6 AM UTC Cron Job:
1. Fetch ~100 Reddit posts (RSS API)
2. Select top 20 posts with 5+ comments
3. Fetch comment threads (JSON API, depth 3)
4. AI analysis (Gemini Flash): sentiment, tickers, topics
5. Save to database: posts + comments + analysis
6. Cleanup old data (30+ days)

Frontend Requests:
1. User visits sentiment page
2. Frontend calls /api/sentiment-data
3. API serves cached data from database
4. "Refresh" button invalidates React Query cache
```

## 🤖 AI Analysis Pipeline

### Reddit Data Collection
```typescript
// Smart post selection
posts.filter(p => p.num_comments > 5)
     .sort((a,b) => b.num_comments - a.num_comments)
     .slice(0, 20)

// Recursive comment extraction  
function extractCommentsRecursively(children, postId, depth=0, maxDepth=3)
// Preserves parent-child relationships, thread depth

// AI processing with Gemini Flash
const prompt = `Analyze sentiment for ticker ${ticker}: ${contexts.join('\n')}`
// Returns: sentiment_score, sentiment_label, key_themes[], summary
```

### Database Storage Strategy
```sql
-- Posts: Complete metadata + AI analysis
INSERT INTO reddit_posts_raw (
  post_id, title, selftext, author, subreddit, score,
  extracted_tickers, sentiment_score, key_topics, ai_summary, raw_json
)

-- Comments: Threaded structure + AI analysis  
INSERT INTO reddit_comments (
  comment_id, post_id, parent_id, body, depth,
  extracted_tickers, sentiment_score, argument_type, raw_json
)

-- Cleanup: Keep only recent data
DELETE FROM reddit_posts_raw WHERE retrieved_at < NOW() - INTERVAL '30 days'
```

## 🚀 Frontend Architecture

### Page Structure
```typescript
/                           // Watchlist dashboard
/analyze/[ticker]          // 4-dimension analysis (Fundamental, Institutional, Macro, Sentiment)
/sentiment                 // Global sentiment analysis
/macro                     // Economic indicators
/screener                  // Stock screening
```

### Key Components
```typescript
// Sentiment analysis
<SentimentAnalysis ticker="AAPL" />           // Individual stock sentiment
<RedditPostsCarousel posts={topPosts} />      // Top Reddit posts
<BullishTickers limit={10} />                 // Most bullish stocks
<BearishTickers limit={10} />                 // Most bearish stocks

// Financial analysis  
<FundamentalAnalysis ticker="AAPL" />         // 70+ financial metrics
<HistoricalCharts ticker="AAPL" />            // Trend analysis
<InstitutionalAnalysis ticker="AAPL" />       // Smart money flows
```

### State Management
```typescript
// React Query for data fetching & caching
useSentimentData(source, timeframe)           // Sentiment data with 30min cache
useRefreshSentimentData()                     // Invalidate cache only
useBullishTickers(limit, source, timeframe)   // Top bullish stocks
useFinancialData(ticker)                      // Financial metrics
```

## ⚙️ Cron Job System

### Supabase pg_cron Configuration
```sql
-- Daily sentiment data collection (6 AM UTC)
SELECT cron.schedule(
  'daily-sentiment-fetch',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-app.vercel.app/api/cron/sentiment-data',
    headers := '{"Authorization": "Bearer ' || vault.read_secret('cron_secret') || '"}',
    body := '{}'
  );
  $$
);
```

### Cron Job Logic
```typescript
// /api/cron/sentiment-data/route.ts
export async function POST() {
  // 1. Fetch Reddit posts via RSS
  const posts = await fetchRawRedditPosts(subreddits, 100)
  
  // 2. Fetch comments for high-engagement posts  
  const highEngagementPosts = posts.filter(p => p.num_comments > 5).slice(0, 20)
  const comments = await fetchRedditComments(highEngagementPosts)
  
  // 3. AI sentiment analysis
  const sentimentData = await analyzeSentimentWithLLM(posts, comments)
  
  // 4. Save to database
  await saveRawRedditPosts(posts)
  await saveRawRedditComments(comments)  
  await saveSentimentData(sentimentData)
  
  // 5. Cleanup old data
  await cleanupOldData()
}
```

## 🔍 Investment Intelligence Features

### Sentiment Analysis Capabilities
```sql
-- Find contrarian viewpoints
SELECT c.body, c.sentiment_score, p.title
FROM reddit_comments c
JOIN reddit_posts_raw p ON c.post_id = p.post_id  
WHERE c.sentiment_score < -0.5 AND p.sentiment_score > 0.5
  AND c.score > 10  -- Well-received contrarian views

-- Track sentiment evolution in threads
SELECT 
  p.sentiment_score as post_sentiment,
  AVG(c.sentiment_score) FILTER (WHERE c.depth = 0) as top_level_sentiment,
  AVG(c.sentiment_score) FILTER (WHERE c.depth > 0) as reply_sentiment
FROM reddit_posts_raw p
JOIN reddit_comments c ON p.post_id = c.post_id
WHERE 'AAPL' = ANY(p.extracted_tickers)
GROUP BY p.post_id, p.sentiment_score

-- Identify expert contributors
SELECT author, COUNT(*), AVG(score), AVG(LENGTH(body))
FROM reddit_comments  
WHERE LENGTH(body) > 500
GROUP BY author
HAVING COUNT(*) > 10
ORDER BY AVG(score) DESC
```

### AI Analysis Insights
- **Early Signal Detection**: Spot stocks gaining buzz before mainstream
- **Expert Identification**: Find users providing consistent detailed analysis  
- **Debate Analysis**: Track supporting vs opposing viewpoints
- **Catalyst Discovery**: Extract specific concerns/opportunities from discussions
- **Community Consensus**: Measure sentiment evolution through comment threads

## 🛠️ Technology Stack

**Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, React Query  
**Backend**: Next.js API Routes, Supabase PostgreSQL, pg_cron  
**Data Sources**: Financial Datasets API, Reddit RSS/JSON, BLS API  
**AI/ML**: Google Gemini Flash for sentiment analysis  
**Deployment**: Vercel (frontend), Supabase (database + cron)

## 🔐 Database Configuration

**Production Database**: Supabase PostgreSQL  
**Project URL**: https://yfqdtjwgvsixnhyseqbi.supabase.co  
**Project ID**: yfqdtjwgvsixnhyseqbi  
**Dashboard**: https://supabase.com/dashboard/project/yfqdtjwgvsixnhyseqbi  

**Connection Details**:
- Database URL: `postgresql://postgres:[password]@db.yfqdtjwgvsixnhyseqbi.supabase.co:5432/postgres`
- Direct URL: `postgresql://postgres:[password]@db.yfqdtjwgvsixnhyseqbi.supabase.co:6543/postgres?sslmode=require`
- REST API: `https://yfqdtjwgvsixnhyseqbi.supabase.co/rest/v1/`
- GraphQL API: `https://yfqdtjwgvsixnhyseqbi.supabase.co/graphql/v1`

**Environment Variables**:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://yfqdtjwgvsixnhyseqbi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Tables Status**:
- ✅ Financial tables: companies, securities, prices_daily, fundamentals_quarterly, financial_statements, financial_metrics
- ✅ Economic tables: interest_rates, inflation_data, economic_data
- ✅ Sentiment tables: sentiment_data, reddit_posts_raw, reddit_comments, reddit_posts
- ✅ KPI tables: kpis, kpi_values
- ✅ User tables: watchlists, watchlist_items

## 📊 Data Sources & Costs

### Financial Data
- **Financial Datasets API**: ~$0.01/ticker/month for comprehensive metrics
- **BLS API**: Free government economic data (inflation, employment)

### Social Media Data  
- **Reddit RSS**: Free, no rate limits (posts only)
- **Reddit JSON API**: Free, respectful rate limiting (posts + comments)
- **Gemini Flash AI**: ~$0.01/month for sentiment analysis

### Total Cost
~$5-10/month for comprehensive financial + sentiment data covering 50+ stocks

This architecture provides professional-grade investment intelligence through automated social media analysis, real-time financial data, and AI-powered insights.
