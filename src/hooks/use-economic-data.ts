import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface EconomicDataPoint {
  date: string;
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

// Available economic data series
export const ECONOMIC_SERIES = {
  // Employment & Unemployment
  unemployment_rate: 'Unemployment Rate',
  employment_level: 'Employment Level',
  labor_participation: 'Labor Force Participation Rate',
  
  // Wages & Earnings
  avg_hourly_earnings: 'Average Hourly Earnings',
  avg_weekly_earnings: 'Average Weekly Earnings',
  
  // Industry Employment
  manufacturing_jobs: 'Manufacturing Employment',
  tech_jobs: 'Technology Employment',
  healthcare_jobs: 'Healthcare Employment',
  financial_jobs: 'Financial Services Employment',
  
  // Price Indices
  producer_price_index: 'Producer Price Index',
  
  // Hours & Productivity
  avg_weekly_hours: 'Average Weekly Hours',
} as const;

export type EconomicSeriesKey = keyof typeof ECONOMIC_SERIES;

export function useEconomicData(series?: EconomicSeriesKey[]) {
  return useQuery<EconomicResponse>({
    queryKey: ['economic-data', series],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (series && series.length > 0) {
        params.set('series', series.join(','));
      }
      
      const response = await fetch(`/api/economic-data?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch economic data');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: false,
  });
}

export function useRefreshEconomicData(series?: EconomicSeriesKey[]) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({ refresh: 'true' });
      if (series && series.length > 0) {
        params.set('series', series.join(','));
      }
      
      const response = await fetch(`/api/economic-data?${params}`);
      if (!response.ok) {
        throw new Error('Failed to refresh economic data');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch economic data queries
      queryClient.invalidateQueries({ queryKey: ['economic-data'] });
    },
  });
}

// Specialized hooks for specific data types
export function useUnemploymentData() {
  return useEconomicData(['unemployment_rate', 'employment_level', 'labor_participation']);
}

export function useWageData() {
  return useEconomicData(['avg_hourly_earnings', 'avg_weekly_earnings']);
}

export function useIndustryEmployment() {
  return useEconomicData(['manufacturing_jobs', 'tech_jobs', 'healthcare_jobs', 'financial_jobs']);
}

export function useKeyEconomicIndicators() {
  return useEconomicData([
    'unemployment_rate',
    'avg_hourly_earnings', 
    'producer_price_index',
    'labor_participation'
  ]);
}
