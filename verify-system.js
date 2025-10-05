#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  'https://yfqdtjwgvsixnhyseqbi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmcWR0andndnNpeG5oeXNlcWJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA1ODY1MSwiZXhwIjoyMDcxNjM0NjUxfQ.CBX22MSGrtA5K55vFG_SBh9jTzUSc-wPZDCypE62lbI'
);

async function verifyLLMSystem() {
  console.log('🔍 Verifying LLM-Powered Sentiment System...\n');

  try {
    // 1. Check Reddit LLM Analysis
    console.log('📱 1. REDDIT LLM ANALYSIS STATUS:');
    const { data: redditStats, error: redditError } = await supabase
      .from('reddit_posts_raw')
      .select('llm_ticker, llm_confidence, llm_sentiment_score, retrieved_at')
      .gte('retrieved_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (redditError) {
      console.error('❌ Reddit query error:', redditError);
    } else {
      const totalReddit = redditStats.length;
      const withTickers = redditStats.filter(p => p.llm_ticker).length;
      const highConfidence = redditStats.filter(p => p.llm_confidence > 0.5).length;
      const avgConfidence = redditStats.reduce((sum, p) => sum + (p.llm_confidence || 0), 0) / totalReddit;
      
      console.log(`   📊 Total posts (24h): ${totalReddit}`);
      console.log(`   🎯 Posts with tickers: ${withTickers} (${((withTickers/totalReddit)*100).toFixed(1)}%)`);
      console.log(`   ✅ High confidence (>0.5): ${highConfidence} (${((highConfidence/totalReddit)*100).toFixed(1)}%)`);
      console.log(`   📈 Average confidence: ${avgConfidence.toFixed(3)}\n`);
    }

    // 2. Check Twitter LLM Analysis
    console.log('🐦 2. TWITTER LLM ANALYSIS STATUS:');
    const { data: twitterStats, error: twitterError } = await supabase
      .from('twitter_posts_raw')
      .select('llm_ticker, llm_confidence, llm_sentiment_score, retrieved_at')
      .gte('retrieved_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (twitterError) {
      console.error('❌ Twitter query error:', twitterError);
    } else {
      const totalTwitter = twitterStats.length;
      const withTickers = twitterStats.filter(p => p.llm_ticker).length;
      const highConfidence = twitterStats.filter(p => p.llm_confidence > 0.5).length;
      const avgConfidence = twitterStats.reduce((sum, p) => sum + (p.llm_confidence || 0), 0) / totalTwitter;
      
      console.log(`   📊 Total posts (24h): ${totalTwitter}`);
      console.log(`   🎯 Posts with tickers: ${withTickers} (${((withTickers/totalTwitter)*100).toFixed(1)}%)`);
      console.log(`   ✅ High confidence (>0.5): ${highConfidence} (${((highConfidence/totalTwitter)*100).toFixed(1)}%)`);
      console.log(`   📈 Average confidence: ${avgConfidence.toFixed(3)}\n`);
    }

    // 3. Check Top Tickers
    console.log('🏆 3. TOP TICKERS EXTRACTED BY LLM:');
    const { data: topTickers, error: tickersError } = await supabase.rpc('get_top_llm_tickers');
    
    if (tickersError) {
      console.log('   ⚠️  Custom function not available, checking manually...');
      
      // Manual ticker aggregation
      const allPosts = [...(redditStats || []), ...(twitterStats || [])];
      const tickerCounts = {};
      
      allPosts.forEach(post => {
        if (post.llm_ticker) {
          tickerCounts[post.llm_ticker] = (tickerCounts[post.llm_ticker] || 0) + 1;
        }
      });
      
      const sortedTickers = Object.entries(tickerCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
      
      sortedTickers.forEach(([ticker, count]) => {
        console.log(`   ${ticker}: ${count} mentions`);
      });
    } else {
      topTickers.forEach(ticker => {
        console.log(`   ${ticker.ticker}: ${ticker.mentions} mentions (sentiment: ${ticker.avg_sentiment})`);
      });
    }

    // 4. Check Sentiment Aggregations
    console.log('\n📊 4. SENTIMENT AGGREGATIONS STATUS:');
    const { data: aggregations, error: aggError } = await supabase
      .from('sentiment_aggregations')
      .select('ticker, total_mentions, avg_sentiment, avg_confidence, calculated_at')
      .gte('calculated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('total_mentions', { ascending: false })
      .limit(10);

    if (aggError) {
      console.error('❌ Aggregations query error:', aggError);
    } else {
      console.log(`   📈 Total aggregations (24h): ${aggregations.length}`);
      console.log('   🔝 Top aggregated tickers:');
      aggregations.forEach(agg => {
        const lastUpdate = new Date(agg.calculated_at).toLocaleTimeString();
        console.log(`      ${agg.ticker}: ${agg.total_mentions} mentions, sentiment: ${agg.avg_sentiment}, updated: ${lastUpdate}`);
      });
    }

    // 5. Sample LLM Analysis
    console.log('\n🔬 5. SAMPLE LLM ANALYSIS:');
    const { data: samples, error: sampleError } = await supabase
      .from('twitter_posts_raw')
      .select('text, llm_ticker, llm_sentiment_score, llm_confidence, llm_key_themes, llm_reasoning')
      .not('llm_ticker', 'is', null)
      .gte('retrieved_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('llm_confidence', { ascending: false })
      .limit(3);

    if (sampleError) {
      console.error('❌ Sample query error:', sampleError);
    } else {
      samples.forEach((sample, i) => {
        console.log(`   Sample ${i + 1}:`);
        console.log(`      Text: "${sample.text.substring(0, 80)}..."`);
        console.log(`      Ticker: ${sample.llm_ticker}`);
        console.log(`      Sentiment: ${sample.llm_sentiment_score} (confidence: ${sample.llm_confidence})`);
        console.log(`      Themes: ${sample.llm_key_themes?.join(', ') || 'none'}`);
        console.log(`      Reasoning: "${sample.llm_reasoning?.substring(0, 100) || 'none'}..."`);
        console.log('');
      });
    }

    console.log('✅ LLM System Verification Complete!');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyLLMSystem();




































