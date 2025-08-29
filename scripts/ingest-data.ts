#!/usr/bin/env tsx
// Data ingestion CLI script
// Usage: npx tsx scripts/ingest-data.ts [command] [options]

import { DataIngestionService } from '../src/lib/data-ingestion'
import { getEnabledTickers, getTickersByPriority } from '../src/lib/ticker-config'

const API_KEY = process.env.FINANCIAL_DATASETS_API_KEY

if (!API_KEY) {
  console.error('❌ Missing FINANCIAL_DATASETS_API_KEY environment variable')
  console.log('💡 Get your API key from: https://financialdatasets.ai')
  console.log('💡 Then set it: export FINANCIAL_DATASETS_API_KEY=your_key_here')
  process.exit(1)
}

const service = new DataIngestionService(API_KEY)

async function testConnection() {
  console.log('🔄 Testing API connection...')
  const isConnected = await service.testConnection()
  
  if (isConnected) {
    console.log('✅ API connection successful!')
  } else {
    console.log('❌ API connection failed!')
    process.exit(1)
  }
}

async function showStats() {
  console.log('📊 Getting ingestion statistics...')
  const stats = await service.getIngestionStats()
  
  console.log(`\n📈 Database Statistics:`)
  console.log(`  Companies: ${stats.companies}`)
  
  console.log(`\n💰 Price Data:`)
  stats.latestPrices.forEach(stat => {
    console.log(`  ${stat.ticker}: ${stat.recordCount} records, latest: ${stat.latestDate}`)
  })
  
  console.log(`\n📊 Fundamental Data:`)
  stats.latestFundamentals.forEach(stat => {
    console.log(`  ${stat.ticker}: ${stat.recordCount} records, latest: ${stat.latestQuarter}`)
  })
}

async function ingestTicker(ticker: string) {
  console.log(`🚀 Ingesting data for ${ticker}...`)
  const results = await service.ingestTicker(ticker)
  console.log(`✅ Completed: ${results.prices} prices, ${results.fundamentals} fundamentals`)
}

async function ingestHighPriority() {
  console.log('🚀 Ingesting all high-priority tickers...')
  const results = await service.ingestHighPriorityTickers()
  
  console.log('\n📈 Results Summary:')
  Object.entries(results).forEach(([ticker, result]) => {
    console.log(`  ${ticker}: ${result.prices} prices, ${result.fundamentals} fundamentals`)
  })
}

async function showConfig() {
  const enabled = getEnabledTickers()
  const high = getTickersByPriority('high')
  const medium = getTickersByPriority('medium')
  const low = getTickersByPriority('low')
  
  console.log(`\n⚙️ Ticker Configuration:`)
  console.log(`  Total enabled: ${enabled.length}`)
  console.log(`  High priority (${high.length}): ${high.map(t => t.ticker).join(', ')}`)
  console.log(`  Medium priority (${medium.length}): ${medium.map(t => t.ticker).join(', ')}`)
  console.log(`  Low priority (${low.length}): ${low.map(t => t.ticker).join(', ')}`)
}

async function main() {
  const command = process.argv[2]
  const ticker = process.argv[3]

  try {
    switch (command) {
      case 'test':
        await testConnection()
        break
        
      case 'stats':
        await showStats()
        break
        
      case 'config':
        await showConfig()
        break
        
      case 'ingest':
        if (!ticker) {
          console.error('❌ Usage: npm run ingest-data ingest <TICKER>')
          process.exit(1)
        }
        await ingestTicker(ticker.toUpperCase())
        break
        
      case 'ingest-high':
        await ingestHighPriority()
        break
        
      default:
        console.log(`
🏦 Financial Data Ingestion CLI

Commands:
  test              Test API connection
  config            Show ticker configuration  
  stats             Show database statistics
  ingest <TICKER>   Ingest data for specific ticker
  ingest-high       Ingest all high-priority tickers

Examples:
  npx tsx scripts/ingest-data.ts test
  npx tsx scripts/ingest-data.ts ingest AAPL
  npx tsx scripts/ingest-data.ts ingest-high
  npx tsx scripts/ingest-data.ts stats

Environment:
  FINANCIAL_DATASETS_API_KEY=your_api_key_here
        `)
    }
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
