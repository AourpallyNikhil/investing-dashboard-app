import { NextRequest, NextResponse } from 'next/server';

interface TickerInfo {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
}

// Comprehensive ticker database with major stocks
const TICKER_DATABASE: Record<string, TickerInfo> = {
  // Tech Giants
  'AAPL': { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', sector: 'Technology', industry: 'Consumer Electronics' },
  'MSFT': { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', sector: 'Technology', industry: 'Software' },
  'GOOGL': { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', sector: 'Technology', industry: 'Internet Services' },
  'GOOG': { symbol: 'GOOG', name: 'Alphabet Inc.', exchange: 'NASDAQ', sector: 'Technology', industry: 'Internet Services' },
  'AMZN': { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', sector: 'Consumer Discretionary', industry: 'E-commerce' },
  'META': { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ', sector: 'Technology', industry: 'Social Media' },
  'TSLA': { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', sector: 'Consumer Discretionary', industry: 'Electric Vehicles' },
  'NVDA': { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', sector: 'Technology', industry: 'Semiconductors' },
  'NFLX': { symbol: 'NFLX', name: 'Netflix Inc.', exchange: 'NASDAQ', sector: 'Communication Services', industry: 'Streaming' },
  'CRM': { symbol: 'CRM', name: 'Salesforce Inc.', exchange: 'NYSE', sector: 'Technology', industry: 'Cloud Software' },
  'ORCL': { symbol: 'ORCL', name: 'Oracle Corporation', exchange: 'NYSE', sector: 'Technology', industry: 'Enterprise Software' },
  'ADBE': { symbol: 'ADBE', name: 'Adobe Inc.', exchange: 'NASDAQ', sector: 'Technology', industry: 'Software' },
  'INTC': { symbol: 'INTC', name: 'Intel Corporation', exchange: 'NASDAQ', sector: 'Technology', industry: 'Semiconductors' },
  'AMD': { symbol: 'AMD', name: 'Advanced Micro Devices', exchange: 'NASDAQ', sector: 'Technology', industry: 'Semiconductors' },
  'PYPL': { symbol: 'PYPL', name: 'PayPal Holdings Inc.', exchange: 'NASDAQ', sector: 'Financial Services', industry: 'Fintech' },
  'UBER': { symbol: 'UBER', name: 'Uber Technologies Inc.', exchange: 'NYSE', sector: 'Technology', industry: 'Ride Sharing' },
  'SPOT': { symbol: 'SPOT', name: 'Spotify Technology S.A.', exchange: 'NYSE', sector: 'Communication Services', industry: 'Music Streaming' },

  // Financial Services
  'JPM': { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE', sector: 'Financial Services', industry: 'Banking' },
  'BAC': { symbol: 'BAC', name: 'Bank of America Corp.', exchange: 'NYSE', sector: 'Financial Services', industry: 'Banking' },
  'WFC': { symbol: 'WFC', name: 'Wells Fargo & Company', exchange: 'NYSE', sector: 'Financial Services', industry: 'Banking' },
  'GS': { symbol: 'GS', name: 'Goldman Sachs Group Inc.', exchange: 'NYSE', sector: 'Financial Services', industry: 'Investment Banking' },
  'MS': { symbol: 'MS', name: 'Morgan Stanley', exchange: 'NYSE', sector: 'Financial Services', industry: 'Investment Banking' },
  'V': { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE', sector: 'Financial Services', industry: 'Payment Processing' },
  'MA': { symbol: 'MA', name: 'Mastercard Inc.', exchange: 'NYSE', sector: 'Financial Services', industry: 'Payment Processing' },
  'AXP': { symbol: 'AXP', name: 'American Express Company', exchange: 'NYSE', sector: 'Financial Services', industry: 'Credit Cards' },
  'BRK.A': { symbol: 'BRK.A', name: 'Berkshire Hathaway Inc.', exchange: 'NYSE', sector: 'Financial Services', industry: 'Conglomerate' },
  'BRK.B': { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc.', exchange: 'NYSE', sector: 'Financial Services', industry: 'Conglomerate' },

  // Healthcare & Pharma
  'JNJ': { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  'PFE': { symbol: 'PFE', name: 'Pfizer Inc.', exchange: 'NYSE', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  'UNH': { symbol: 'UNH', name: 'UnitedHealth Group Inc.', exchange: 'NYSE', sector: 'Healthcare', industry: 'Health Insurance' },
  'ABBV': { symbol: 'ABBV', name: 'AbbVie Inc.', exchange: 'NYSE', sector: 'Healthcare', industry: 'Biotechnology' },
  'LLY': { symbol: 'LLY', name: 'Eli Lilly and Company', exchange: 'NYSE', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  'MRK': { symbol: 'MRK', name: 'Merck & Co. Inc.', exchange: 'NYSE', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  'TMO': { symbol: 'TMO', name: 'Thermo Fisher Scientific', exchange: 'NYSE', sector: 'Healthcare', industry: 'Life Sciences' },

  // Consumer & Retail
  'WMT': { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE', sector: 'Consumer Staples', industry: 'Retail' },
  'HD': { symbol: 'HD', name: 'Home Depot Inc.', exchange: 'NYSE', sector: 'Consumer Discretionary', industry: 'Home Improvement' },
  'PG': { symbol: 'PG', name: 'Procter & Gamble Co.', exchange: 'NYSE', sector: 'Consumer Staples', industry: 'Personal Care' },
  'KO': { symbol: 'KO', name: 'Coca-Cola Company', exchange: 'NYSE', sector: 'Consumer Staples', industry: 'Beverages' },
  'PEP': { symbol: 'PEP', name: 'PepsiCo Inc.', exchange: 'NASDAQ', sector: 'Consumer Staples', industry: 'Beverages' },
  'MCD': { symbol: 'MCD', name: 'McDonald\'s Corporation', exchange: 'NYSE', sector: 'Consumer Discretionary', industry: 'Restaurants' },
  'SBUX': { symbol: 'SBUX', name: 'Starbucks Corporation', exchange: 'NASDAQ', sector: 'Consumer Discretionary', industry: 'Restaurants' },
  'NKE': { symbol: 'NKE', name: 'Nike Inc.', exchange: 'NYSE', sector: 'Consumer Discretionary', industry: 'Apparel' },
  'LOW': { symbol: 'LOW', name: 'Lowe\'s Companies Inc.', exchange: 'NYSE', sector: 'Consumer Discretionary', industry: 'Home Improvement' },

  // Energy & Utilities
  'XOM': { symbol: 'XOM', name: 'Exxon Mobil Corporation', exchange: 'NYSE', sector: 'Energy', industry: 'Oil & Gas' },
  'CVX': { symbol: 'CVX', name: 'Chevron Corporation', exchange: 'NYSE', sector: 'Energy', industry: 'Oil & Gas' },
  'COP': { symbol: 'COP', name: 'ConocoPhillips', exchange: 'NYSE', sector: 'Energy', industry: 'Oil & Gas' },

  // Industrial
  'BA': { symbol: 'BA', name: 'Boeing Company', exchange: 'NYSE', sector: 'Industrials', industry: 'Aerospace' },
  'CAT': { symbol: 'CAT', name: 'Caterpillar Inc.', exchange: 'NYSE', sector: 'Industrials', industry: 'Heavy Machinery' },
  'GE': { symbol: 'GE', name: 'General Electric Company', exchange: 'NYSE', sector: 'Industrials', industry: 'Conglomerate' },
  'MMM': { symbol: 'MMM', name: '3M Company', exchange: 'NYSE', sector: 'Industrials', industry: 'Diversified Manufacturing' },

  // Communication Services
  'T': { symbol: 'T', name: 'AT&T Inc.', exchange: 'NYSE', sector: 'Communication Services', industry: 'Telecommunications' },
  'VZ': { symbol: 'VZ', name: 'Verizon Communications', exchange: 'NYSE', sector: 'Communication Services', industry: 'Telecommunications' },
  'DIS': { symbol: 'DIS', name: 'Walt Disney Company', exchange: 'NYSE', sector: 'Communication Services', industry: 'Entertainment' },

  // Crypto-Related
  'COIN': { symbol: 'COIN', name: 'Coinbase Global Inc.', exchange: 'NASDAQ', sector: 'Financial Services', industry: 'Cryptocurrency' },
  'MSTR': { symbol: 'MSTR', name: 'MicroStrategy Inc.', exchange: 'NASDAQ', sector: 'Technology', industry: 'Business Intelligence' },

  // Popular Meme Stocks
  'GME': { symbol: 'GME', name: 'GameStop Corp.', exchange: 'NYSE', sector: 'Consumer Discretionary', industry: 'Gaming Retail' },
  'AMC': { symbol: 'AMC', name: 'AMC Entertainment Holdings', exchange: 'NYSE', sector: 'Communication Services', industry: 'Entertainment' },
  'BB': { symbol: 'BB', name: 'BlackBerry Limited', exchange: 'NYSE', sector: 'Technology', industry: 'Software' },
  'NOK': { symbol: 'NOK', name: 'Nokia Corporation', exchange: 'NYSE', sector: 'Technology', industry: 'Telecommunications Equipment' },

  // ETFs (Popular ones)
  'SPY': { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE', sector: 'ETF', industry: 'Index Fund' },
  'QQQ': { symbol: 'QQQ', name: 'Invesco QQQ Trust', exchange: 'NASDAQ', sector: 'ETF', industry: 'Technology Index Fund' },
  'IWM': { symbol: 'IWM', name: 'iShares Russell 2000 ETF', exchange: 'NYSE', sector: 'ETF', industry: 'Small Cap Index Fund' },
  'VTI': { symbol: 'VTI', name: 'Vanguard Total Stock Market', exchange: 'NYSE', sector: 'ETF', industry: 'Total Market Index Fund' },
  'VOO': { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', exchange: 'NYSE', sector: 'ETF', industry: 'Index Fund' },
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase();

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Looking up ticker: ${symbol}`);

    // Check our local database first
    const tickerInfo = TICKER_DATABASE[symbol];
    
    if (tickerInfo) {
      console.log(`✅ Found ticker ${symbol} in database`);
      return NextResponse.json({
        success: true,
        data: tickerInfo
      });
    }

    // If not found in our database, try to make an educated guess
    console.log(`❌ Ticker ${symbol} not found in database`);
    return NextResponse.json({
      success: false,
      error: `Ticker ${symbol} not found in our database. Please enter details manually.`,
      suggestion: {
        symbol: symbol,
        name: `${symbol} Corporation`, // Generic fallback
        exchange: 'NASDAQ', // Most common for new stocks
        sector: 'Technology', // Most common sector
        industry: 'Software' // Generic industry
      }
    }, { status: 404 });

  } catch (error) {
    console.error('❌ Error in ticker lookup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
