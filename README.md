# 📈 Investing Dashboard

A professional-grade financial analysis platform with AI-powered Reddit sentiment analysis, real-time financial data, and automated data collection.

## 🚀 Quick Start

1. **Clone & Install**
   ```bash
   git clone <repo>
   cd investing-dashboard
   npm install
   ```

2. **Database Setup**
   ```bash
   # Start Supabase locally
   supabase start
   
   # Run migrations
   supabase db reset
   ```

3. **Environment Variables**
   ```bash
   cp .env.example .env.local
   # Add your API keys:
   # - OPENAI_API_KEY
   # - SUPABASE keys
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

## 🎯 Key Features

- **📊 Real-Time Financial Data**: 70+ metrics from Financial Datasets API
- **🤖 AI Sentiment Analysis**: Daily Reddit comment analysis with Gemini Flash
- **📈 Investment Intelligence**: Early signal detection from social media
- **🏦 Institutional Tracking**: Smart money flows and ownership changes
- **📉 Macro Analysis**: Economic indicators (inflation, employment, rates)
- **⚡ Automated Collection**: Daily cron jobs for fresh data

## 🏗️ Architecture

See **[📋 ARCHITECTURE.md](./docs/ARCHITECTURE.md)** for complete system overview including:
- Database schema (financial + sentiment tables)
- API architecture and data flow  
- AI analysis pipeline
- Cron job system
- Investment intelligence features

## 💡 AI-Powered Insights

The system automatically:
1. **Collects** ~100 Reddit posts daily from investing subreddits
2. **Analyzes** comments from high-engagement posts (5+ comments)  
3. **Extracts** stock tickers, sentiment scores, and key topics using AI
4. **Identifies** contrarian viewpoints, expert contributors, and emerging catalysts
5. **Provides** early signal detection before mainstream coverage

## 🔄 Daily Data Flow

**6:00 AM UTC**: Automated cron job runs
- Fetches Reddit posts and comments
- Processes with Gemini Flash AI
- Saves comprehensive data for analysis
- Cleans up old data (30+ days)

**Frontend**: Serves cached data with 30-minute refresh cycles

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase PostgreSQL  
- **AI**: Google Gemini Flash for sentiment analysis
- **Data**: Financial Datasets API, Reddit RSS/JSON, BLS API
- **Deployment**: Vercel + Supabase + pg_cron

## 💰 Cost-Efficient

- **~$5-10/month** for comprehensive data covering 50+ stocks
- **Free tier available** with mock data and basic features
- **Pay-per-use APIs** scale with your needs

---

**Perfect for**: Serious investors who want to leverage AI and social media sentiment for investment decisions.
# Fixed Railway deployment issues with proper imports


