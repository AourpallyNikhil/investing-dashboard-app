import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (lazy initialization to avoid build errors)
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );
}

// BLS API Configuration
const BLS_API_URL = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';
const BLS_API_KEY = process.env.BLS_API_KEY; // Optional - higher rate limits with key

// BLS Series IDs for Consumer Price Index (CPI-U)
const BLS_SERIES_ID = 'CUUR0000SA0'; // Consumer Price Index for All Urban Consumers: All Items

// Define the expected structure for inflation data (US only)
interface InflationDataPoint {
  date: string; // YYYY-MM format
  us: number;
}

interface InflationResponse {
  data: InflationDataPoint[];
  sources: string[];
  lastUpdated: string;
  fromCache: boolean;
  cacheAge?: string;
}

// Country mapping for database storage (US only)
const COUNTRY_MAPPING = {
  us: { code: 'US', name: 'United States' }
};

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // ONLY call Gemini API if explicitly requested via refresh=true
    if (forceRefresh) {
      console.log('📊 Manual refresh requested - fetching fresh inflation data from BLS API...');

      const freshData = await fetchFromBLSAPI();
      
          // Save to database (graceful degradation if DB not available)
    try {
      await saveInflationDataToDatabase(freshData);
    } catch (dbError) {
      console.warn('⚠️ Database save failed, but API call succeeded:', dbError);
      // Continue without database caching
    }
      
      console.log('✅ Fresh inflation data fetched and cached');
      return NextResponse.json({ ...freshData, fromCache: false });
    }

    // Default behavior: ALWAYS try to get data from database first
    const cachedData = await getCachedInflationData();
    if (cachedData) {
      console.log('✅ Returning cached inflation data from database');
      return NextResponse.json(cachedData);
    }

    // If no cached data exists at all, return fallback mock data
    console.log('📊 No cached data found, returning fallback mock data');
    return NextResponse.json({
      data: generateFallbackInflationData(),
      sources: ['Mock data - Click refresh to fetch real data'],
      lastUpdated: new Date().toISOString().split('T')[0],
      fromCache: false
    });

  } catch (error) {
    console.error('❌ Error in inflation data API:', error);
    
    // Try to return cached data as fallback
    const cachedData = await getCachedInflationData();
    if (cachedData) {
      console.log('⚠️ Returning cached data due to API error');
      return NextResponse.json({ ...cachedData, fromCache: true });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch inflation data' },
      { status: 500 }
    );
  }
}

// Fallback mock data generator (US only)
function generateFallbackInflationData(): InflationDataPoint[] {
  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (11 - i));
    return {
      date: date.toISOString().slice(0, 7),
      us: 3.1 + (Math.random() - 0.5) * 2, // Mock US inflation around 3.1%
    };
  });
}

async function getCachedInflationData(): Promise<InflationResponse | null> {
  try {
    // Get metadata to check if we have any cached data
    const { data: metadata, error: metadataError } = await supabase
      .from('inflation_data_metadata')
      .select('*')
      .single();

    if (metadataError || !metadata?.last_bls_fetch) {
      console.log('📊 No cached inflation data found (DB may not be set up yet)');
      return null;
    }

    // Fetch cached inflation data (no staleness check - always return if exists)
    const { data: inflationData, error } = await supabase
      .from('inflation_data')
      .select('*')
      .order('period', { ascending: true });

    if (error || !inflationData || inflationData.length === 0) {
      console.log('📊 No valid cached inflation data found');
      return null;
    }

    // Transform database data to API format (US only)
    const transformedData: InflationDataPoint[] = inflationData
      .filter(row => row.country_code === 'US') // Only US data
      .map(row => ({
        date: row.period,
        us: parseFloat(row.inflation_rate)
      }))
      .sort((a, b) => a.date.localeCompare(b.date)); // Sort by date

    const lastFetch = new Date(metadata.last_bls_fetch);
    const now = new Date();
    const daysSinceLastFetch = Math.floor((now.getTime() - lastFetch.getTime()) / (1000 * 60 * 60 * 24));

    return {
      data: transformedData,
      sources: metadata.bls_sources || ['Cached data'],
      lastUpdated: lastFetch.toISOString().split('T')[0],
      fromCache: true,
      cacheAge: `${daysSinceLastFetch} days ago`
    };

  } catch (error) {
    console.error('❌ Error fetching cached inflation data:', error);
    return null;
  }
}

async function fetchFromBLSAPI(): Promise<InflationResponse> {
  try {
    // Calculate date range for last 12 months
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const startYear = currentYear - 1; // Get data from last year to current year

    // Prepare BLS API request
    const requestBody = {
      seriesid: [BLS_SERIES_ID],
      startyear: startYear.toString(),
      endyear: currentYear.toString(),
      ...(BLS_API_KEY && { registrationkey: BLS_API_KEY })
    };

    console.log('📊 Calling BLS API with request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(BLS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`BLS API request failed: ${response.status} ${response.statusText}`);
    }

    const blsData = await response.json();
    console.log('📊 BLS API response status:', blsData.status);

    if (blsData.status !== 'REQUEST_SUCCEEDED') {
      throw new Error(`BLS API error: ${blsData.message || 'Unknown error'}`);
    }

    // Process BLS data to calculate year-over-year inflation rates
    const series = blsData.Results.series[0];
    if (!series || !series.data) {
      throw new Error('No data returned from BLS API');
    }

    // Sort data by year and period (most recent first)
    const sortedData = series.data.sort((a: any, b: any) => {
      if (a.year !== b.year) return parseInt(b.year) - parseInt(a.year);
      return parseInt(b.period.substring(1)) - parseInt(a.period.substring(1));
    });

    console.log(`📊 Processing ${sortedData.length} data points from BLS`);

    // Calculate year-over-year inflation rates for the last 12 months
    const inflationData: InflationDataPoint[] = [];
    
    for (let i = 0; i < Math.min(12, sortedData.length); i++) {
      const currentPoint = sortedData[i];
      const currentValue = parseFloat(currentPoint.value);
      
      // Find the same month from previous year for YoY calculation
      const currentYear = parseInt(currentPoint.year);
      const currentMonth = parseInt(currentPoint.period.substring(1));
      const previousYearPoint = sortedData.find((point: any) => 
        parseInt(point.year) === currentYear - 1 && 
        parseInt(point.period.substring(1)) === currentMonth
      );

      if (previousYearPoint) {
        const previousValue = parseFloat(previousYearPoint.value);
        const inflationRate = ((currentValue - previousValue) / previousValue) * 100;
        
        // Format date as YYYY-MM
        const dateStr = `${currentPoint.year}-${currentPoint.period.substring(1).padStart(2, '0')}`;
        
        inflationData.push({
          date: dateStr,
          us: Math.round(inflationRate * 10) / 10, // Real BLS data, rounded to 1 decimal place
        });
      }
    }

    // Sort by date (oldest first)
    inflationData.sort((a, b) => a.date.localeCompare(b.date));

    return {
      data: inflationData,
      sources: ['U.S. Bureau of Labor Statistics (BLS) - Consumer Price Index'],
      lastUpdated: new Date().toISOString().split('T')[0],
      fromCache: false
    };

  } catch (error) {
    console.error('❌ BLS API error:', error);
    
    // Return fallback data if BLS API fails
    const fallbackData = generateFallbackInflationData();
    return {
      data: fallbackData,
      sources: ['Fallback data - BLS API unavailable'],
      lastUpdated: new Date().toISOString().split('T')[0],
      fromCache: false
    };
  }
}

async function saveInflationDataToDatabase(data: InflationResponse): Promise<void> {
  try {
    // Clear existing data
    await supabase.from('inflation_data').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Prepare US data for insertion
    const insertData = data.data.map(point => ({
      country_code: 'US',
      country_name: 'United States',
      inflation_rate: point.us,
      date: `${point.date}-01`, // Convert YYYY-MM to YYYY-MM-01
      period: point.date,
      data_source: data.sources.join(', ')
    }));

    // Insert new data
    const { error: insertError } = await supabase
      .from('inflation_data')
      .insert(insertData);

    if (insertError) {
      console.error('❌ Error inserting inflation data:', insertError);
      throw insertError;
    }

    // Update metadata
    const { error: metadataError } = await supabase
      .from('inflation_data_metadata')
      .update({
        last_bls_fetch: new Date().toISOString(),
        bls_sources: data.sources,
        total_records: insertData.length
      })
      .eq('id', (await supabase.from('inflation_data_metadata').select('id').single()).data?.id);

    if (metadataError) {
      console.error('❌ Error updating metadata:', metadataError);
      throw metadataError;
    }

    console.log(`✅ Saved ${insertData.length} inflation data points to database`);

  } catch (error) {
    console.error('❌ Error saving inflation data to database:', error);
    throw error;
  }
}

// POST endpoint for manual refresh
export async function POST(request: NextRequest) {
  console.log('🔄 Manual refresh requested');
  const url = new URL(request.url);
  url.searchParams.set('refresh', 'true');
  
  const newRequest = new NextRequest(url, {
    method: 'GET',
    headers: request.headers,
  });
  
  return GET(newRequest);
}
