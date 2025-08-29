import { useQuery } from '@tanstack/react-query';

interface InflationDataPoint {
  date: string;
  us: number;
  eu: number;
  jp: number;
  uk: number;
}

interface InflationResponse {
  data: InflationDataPoint[];
  sources: string[];
  lastUpdated: string;
  fromCache?: boolean;
  cacheAge?: string;
}

// Fallback mock data in case API fails
const generateFallbackInflationData = (): InflationDataPoint[] => {
  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (11 - i));
    return {
      date: date.toISOString().slice(0, 7),
      us: 3.1 + (Math.random() - 0.5) * 2,
      eu: 2.8 + (Math.random() - 0.5) * 2,
      jp: 2.8 + (Math.random() - 0.5) * 1,
      uk: 4.0 + (Math.random() - 0.5) * 2,
    };
  });
};

export function useInflationData() {
  return useQuery({
    queryKey: ['inflation-data'],
    queryFn: async (): Promise<InflationResponse> => {
      try {
        const response = await fetch('/api/inflation-data');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Validate the response structure
        if (!data.data || !Array.isArray(data.data)) {
          throw new Error('Invalid response structure');
        }
        
        return data;
      } catch (error) {
        console.warn('Failed to fetch real inflation data, using fallback:', error);
        
        // Return fallback data with mock structure
        return {
          data: generateFallbackInflationData(),
          sources: ['Fallback mock data - API unavailable'],
          lastUpdated: new Date().toISOString().split('T')[0],
          fromCache: false
        };
      }
    },
    staleTime: 1000 * 60 * 60 * 12, // 12 hours (since we cache in DB for 24h)
    gcTime: 1000 * 60 * 60 * 24, // 24 hours (formerly cacheTime)
    retry: 1, // Only retry once before falling back
    retryDelay: 2000, // 2 second delay before retry
  });
}

// Hook for manual refresh
export function useRefreshInflationData() {
  return useQuery({
    queryKey: ['inflation-data-refresh'],
    queryFn: async (): Promise<InflationResponse> => {
      const response = await fetch('/api/inflation-data?refresh=true');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    },
    enabled: false, // Only run when manually triggered
    staleTime: 0, // Always fresh when manually triggered
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}
