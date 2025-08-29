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

// BLS Series IDs for key economic indicators
const BLS_SERIES = {
  // Employment & Unemployment
  unemployment_rate: 'LNS14000000',        // Unemployment Rate
  employment_level: 'LNS12000000',         // Employment Level  
  labor_participation: 'LNS11300000',      // Labor Force Participation Rate
  
  // Wages & Earnings
  avg_hourly_earnings: 'CES0500000003',    // Average Hourly Earnings, All Employees
  avg_weekly_earnings: 'CES0500000011',    // Average Weekly Earnings
  
  // Industry Employment (Key Sectors)
  manufacturing_jobs: 'CES3000000001',     // Manufacturing Employment
  tech_jobs: 'CES5415000001',              // Computer Systems Design Employment
  healthcare_jobs: 'CES6500000001',        // Healthcare Employment
  financial_jobs: 'CES5552000001',         // Financial Services Employment
  
  // Price Indices
  producer_price_index: 'WPUFD49207',      // Producer Price Index
  
  // Hours & Productivity
  avg_weekly_hours: 'CES0500000002',       // Average Weekly Hours, All Employees
};

// Define data structure for economic indicators
interface EconomicDataPoint {
  date: string; // YYYY-MM format
  value: number;
  series_id: string;
  series_name: string;
  unit: string;
}

interface EconomicResponse {
  data: {
    [key: string]: EconomicDataPoint[];
  };
  sources: string[];
  lastUpdated: string;
  fromCache: boolean;
  cacheAge?: string;
}

// Series metadata for display and units
const SERIES_METADATA = {
  unemployment_rate: { name: 'Unemployment Rate', unit: '%' },
  employment_level: { name: 'Employment Level', unit: 'thousands' },
  labor_participation: { name: 'Labor Force Participation Rate', unit: '%' },
  avg_hourly_earnings: { name: 'Average Hourly Earnings', unit: '$' },
  avg_weekly_earnings: { name: 'Average Weekly Earnings', unit: '$' },
  manufacturing_jobs: { name: 'Manufacturing Employment', unit: 'thousands' },
  tech_jobs: { name: 'Technology Employment', unit: 'thousands' },
  healthcare_jobs: { name: 'Healthcare Employment', unit: 'thousands' },
  financial_jobs: { name: 'Financial Services Employment', unit: 'thousands' },
  producer_price_index: { name: 'Producer Price Index', unit: 'index' },
  avg_weekly_hours: { name: 'Average Weekly Hours', unit: 'hours' },
};

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const seriesFilter = searchParams.get('series')?.split(',') || Object.keys(BLS_SERIES);

    // Only fetch fresh data if explicitly requested
    if (forceRefresh) {
      console.log('📊 Manual refresh requested - fetching fresh economic data from BLS API...');
      
      const freshData = await fetchFromBLSAPI(seriesFilter);
      
      // Save to database (graceful degradation if DB not available)
      try {
        await saveEconomicDataToDatabase(freshData);
      } catch (dbError) {
        console.warn('⚠️ Database save failed, but API call succeeded:', dbError);
      }
      
      console.log('✅ Fresh economic data fetched and cached');
      return NextResponse.json({ ...freshData, fromCache: false });
    }

    // Default behavior: try to get cached data first
    const cachedData = await getCachedEconomicData(seriesFilter);
    if (cachedData) {
      console.log('✅ Returning cached economic data from database');
      return NextResponse.json(cachedData);
    }

    // If no cached data exists, return fallback mock data
    console.log('📊 No cached data found, returning fallback mock data');
    return NextResponse.json({
      data: generateFallbackEconomicData(seriesFilter),
      sources: ['Mock data - Click refresh to fetch real data'],
      lastUpdated: new Date().toISOString().split('T')[0],
      fromCache: false
    });

  } catch (error) {
    console.error('❌ Error in economic data API:', error);
    
    // Try to return cached data as fallback
    const cachedData = await getCachedEconomicData();
    if (cachedData) {
      console.log('⚠️ Returning cached data due to API error');
      return NextResponse.json({ ...cachedData, fromCache: true });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch economic data' },
      { status: 500 }
    );
  }
}

async function fetchFromBLSAPI(seriesFilter: string[]): Promise<EconomicResponse> {
  try {
    // Calculate date range for last 24 months to get good YoY data
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const startYear = currentYear - 2; // Get 2 years of data

    // Filter series based on request
    const seriesToFetch = seriesFilter.reduce((acc, key) => {
      if (BLS_SERIES[key as keyof typeof BLS_SERIES]) {
        acc[key] = BLS_SERIES[key as keyof typeof BLS_SERIES];
      }
      return acc;
    }, {} as Record<string, string>);

    // Prepare BLS API request
    const requestBody = {
      seriesid: Object.values(seriesToFetch),
      startyear: startYear.toString(),
      endyear: currentYear.toString(),
      ...(BLS_API_KEY && { registrationkey: BLS_API_KEY })
    };

    console.log('📊 Calling BLS API for economic indicators:', Object.keys(seriesToFetch));

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

    // Process BLS data for each series
    const processedData: { [key: string]: EconomicDataPoint[] } = {};

    blsData.Results.series.forEach((series: any) => {
      // Find the series key by matching series ID
      const seriesKey = Object.keys(seriesToFetch).find(
        key => seriesToFetch[key] === series.seriesID
      );
      
      if (!seriesKey) return;

      // Sort data by year and period (most recent first)
      const sortedData = series.data.sort((a: any, b: any) => {
        const aDate = parseInt(a.year) * 100 + parseInt(a.period.substring(1));
        const bDate = parseInt(b.year) * 100 + parseInt(b.period.substring(1));
        return bDate - aDate; // Descending order
      });

      // Take last 12 months of data
      const recentData = sortedData.slice(0, 12).reverse(); // Reverse to get chronological order

      processedData[seriesKey] = recentData.map((point: any) => ({
        date: `${point.year}-${point.period.substring(1).padStart(2, '0')}`,
        value: parseFloat(point.value),
        series_id: series.seriesID,
        series_name: SERIES_METADATA[seriesKey as keyof typeof SERIES_METADATA]?.name || seriesKey,
        unit: SERIES_METADATA[seriesKey as keyof typeof SERIES_METADATA]?.unit || ''
      }));
    });

    console.log(`📊 Processed ${Object.keys(processedData).length} economic data series`);

    return {
      data: processedData,
      sources: ['U.S. Bureau of Labor Statistics (BLS) - Economic Indicators'],
      lastUpdated: new Date().toISOString().split('T')[0],
      fromCache: false
    };

  } catch (error) {
    console.error('❌ BLS API error:', error);
    
    // Return fallback data if BLS API fails
    const fallbackData = generateFallbackEconomicData(seriesFilter);
    return {
      data: fallbackData,
      sources: ['Fallback data - BLS API unavailable'],
      lastUpdated: new Date().toISOString().split('T')[0],
      fromCache: false
    };
  }
}

function generateFallbackEconomicData(seriesFilter: string[]): { [key: string]: EconomicDataPoint[] } {
  const fallbackData: { [key: string]: EconomicDataPoint[] } = {};

  // Generate mock data for each requested series
  seriesFilter.forEach(seriesKey => {
    if (!SERIES_METADATA[seriesKey as keyof typeof SERIES_METADATA]) return;

    const metadata = SERIES_METADATA[seriesKey as keyof typeof SERIES_METADATA];
    
    // Generate 12 months of mock data
    fallbackData[seriesKey] = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (11 - i));
      
      // Generate realistic mock values based on series type
      let baseValue = 0;
      let variance = 0;
      
      switch (seriesKey) {
        case 'unemployment_rate':
          baseValue = 4.1;
          variance = 0.5;
          break;
        case 'employment_level':
          baseValue = 160000;
          variance = 2000;
          break;
        case 'labor_participation':
          baseValue = 63.2;
          variance = 0.3;
          break;
        case 'avg_hourly_earnings':
          baseValue = 34.50;
          variance = 1.0;
          break;
        case 'avg_weekly_earnings':
          baseValue = 1200;
          variance = 50;
          break;
        default:
          baseValue = 100;
          variance = 10;
      }
      
      return {
        date: date.toISOString().slice(0, 7),
        value: Math.round((baseValue + (Math.random() - 0.5) * variance) * 100) / 100,
        series_id: BLS_SERIES[seriesKey as keyof typeof BLS_SERIES] || '',
        series_name: metadata.name,
        unit: metadata.unit
      };
    });
  });

  return fallbackData;
}

async function getCachedEconomicData(seriesFilter?: string[]): Promise<EconomicResponse | null> {
  try {
    // Get metadata to check if we have cached data
    const { data: metadata, error: metadataError } = await supabase
      .from('economic_data_metadata')
      .select('*')
      .single();

    if (metadataError || !metadata?.last_bls_fetch) {
      console.log('📊 No cached economic data found');
      return null;
    }

    // Fetch cached economic data
    let query = supabase
      .from('economic_data')
      .select('*')
      .order('period', { ascending: true });

    // Filter by series if specified
    if (seriesFilter && seriesFilter.length > 0) {
      const seriesIds = seriesFilter.map(key => BLS_SERIES[key as keyof typeof BLS_SERIES]).filter(Boolean);
      query = query.in('series_id', seriesIds);
    }

    const { data: economicData, error } = await query;

    if (error || !economicData || economicData.length === 0) {
      console.log('📊 No valid cached economic data found');
      return null;
    }

    // Group data by series
    const groupedData: { [key: string]: EconomicDataPoint[] } = {};
    
    economicData.forEach(row => {
      // Find series key by matching series ID
      const seriesKey = Object.keys(BLS_SERIES).find(
        key => BLS_SERIES[key as keyof typeof BLS_SERIES] === row.series_id
      );
      
      if (seriesKey) {
        if (!groupedData[seriesKey]) {
          groupedData[seriesKey] = [];
        }
        
        groupedData[seriesKey].push({
          date: row.period,
          value: parseFloat(row.value),
          series_id: row.series_id,
          series_name: row.series_name,
          unit: row.unit
        });
      }
    });

    // Sort each series by date
    Object.keys(groupedData).forEach(key => {
      groupedData[key].sort((a, b) => a.date.localeCompare(b.date));
    });

    const lastFetch = new Date(metadata.last_bls_fetch);
    const now = new Date();
    const daysSinceLastFetch = Math.floor((now.getTime() - lastFetch.getTime()) / (1000 * 60 * 60 * 24));

    return {
      data: groupedData,
      sources: metadata.bls_sources || ['Cached data'],
      lastUpdated: lastFetch.toISOString().split('T')[0],
      fromCache: true,
      cacheAge: `${daysSinceLastFetch} days ago`
    };

  } catch (error) {
    console.error('❌ Error fetching cached economic data:', error);
    return null;
  }
}

async function saveEconomicDataToDatabase(data: EconomicResponse): Promise<void> {
  try {
    // Clear existing data
    await supabase.from('economic_data').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Prepare data for insertion
    const insertData: any[] = [];
    
    Object.entries(data.data).forEach(([seriesKey, dataPoints]) => {
      dataPoints.forEach(point => {
        insertData.push({
          series_id: point.series_id,
          series_key: seriesKey,
          series_name: point.series_name,
          value: point.value.toString(),
          date: `${point.date}-01`, // Convert YYYY-MM to YYYY-MM-01
          period: point.date,
          unit: point.unit,
          data_source: data.sources.join(', ')
        });
      });
    });

    // Insert new data
    const { error: insertError } = await supabase
      .from('economic_data')
      .insert(insertData);

    if (insertError) {
      console.error('❌ Error inserting economic data:', insertError);
      throw insertError;
    }

    // Update metadata
    const { error: metadataError } = await supabase
      .from('economic_data_metadata')
      .update({
        last_bls_fetch: new Date().toISOString(),
        bls_sources: data.sources,
        total_records: insertData.length
      })
      .eq('id', (await supabase.from('economic_data_metadata').select('id').single()).data?.id);

    if (metadataError) {
      console.error('❌ Error updating economic metadata:', metadataError);
      throw metadataError;
    }

    console.log(`✅ Saved ${insertData.length} economic data points to database`);

  } catch (error) {
    console.error('❌ Error saving economic data to database:', error);
    throw error;
  }
}

// POST endpoint for manual refresh
export async function POST(request: NextRequest) {
  console.log('🔄 Manual economic data refresh requested');
  const url = new URL(request.url);
  url.searchParams.set('refresh', 'true');
  
  const newRequest = new NextRequest(url, {
    method: 'GET',
    headers: request.headers,
  });
  
  return GET(newRequest);
}
