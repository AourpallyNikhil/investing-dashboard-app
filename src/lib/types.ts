export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          ticker: string
          name: string | null
          sector: string | null
          industry: string | null
          exchange: string | null
          currency: string | null
          country: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          ticker: string
          name?: string | null
          sector?: string | null
          industry?: string | null
          exchange?: string | null
          currency?: string | null
          country?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          ticker?: string
          name?: string | null
          sector?: string | null
          industry?: string | null
          exchange?: string | null
          currency?: string | null
          country?: string | null
          created_at?: string | null
        }
      }
      securities: {
        Row: {
          id: string
          company_id: string | null
          symbol: string
          type: string | null
          is_primary: boolean | null
        }
        Insert: {
          id?: string
          company_id?: string | null
          symbol: string
          type?: string | null
          is_primary?: boolean | null
        }
        Update: {
          id?: string
          company_id?: string | null
          symbol?: string
          type?: string | null
          is_primary?: boolean | null
        }
      }
      prices_daily: {
        Row: {
          security_id: string
          d: string
          open: number | null
          high: number | null
          low: number | null
          close: number | null
          volume: number | null
        }
        Insert: {
          security_id: string
          d: string
          open?: number | null
          high?: number | null
          low?: number | null
          close?: number | null
          volume?: number | null
        }
        Update: {
          security_id?: string
          d?: string
          open?: number | null
          high?: number | null
          low?: number | null
          close?: number | null
          volume?: number | null
        }
      }
      fundamentals_quarterly: {
        Row: {
          company_id: string
          fiscal_year: number
          fiscal_period: string
          report_date: string | null
          revenue: number | null
          gross_profit: number | null
          operating_income: number | null
          net_income: number | null
          shares_diluted: number | null
          eps_basic: number | null
          eps_diluted: number | null
          cash_from_operations: number | null
          capex: number | null
          total_assets: number | null
          total_liabilities: number | null
          shareholder_equity: number | null
          sbc: number | null
        }
        Insert: {
          company_id: string
          fiscal_year: number
          fiscal_period: string
          report_date?: string | null
          revenue?: number | null
          gross_profit?: number | null
          operating_income?: number | null
          net_income?: number | null
          shares_diluted?: number | null
          eps_basic?: number | null
          eps_diluted?: number | null
          cash_from_operations?: number | null
          capex?: number | null
          total_assets?: number | null
          total_liabilities?: number | null
          shareholder_equity?: number | null
          sbc?: number | null
        }
        Update: {
          company_id?: string
          fiscal_year?: number
          fiscal_period?: string
          report_date?: string | null
          revenue?: number | null
          gross_profit?: number | null
          operating_income?: number | null
          net_income?: number | null
          shares_diluted?: number | null
          eps_basic?: number | null
          eps_diluted?: number | null
          cash_from_operations?: number | null
          capex?: number | null
          total_assets?: number | null
          total_liabilities?: number | null
          shareholder_equity?: number | null
          sbc?: number | null
        }
      }
      kpis: {
        Row: {
          id: number
          code: string
          name: string
          unit: string | null
          description: string | null
        }
        Insert: {
          id?: number
          code: string
          name: string
          unit?: string | null
          description?: string | null
        }
        Update: {
          id?: number
          code?: string
          name?: string
          unit?: string | null
          description?: string | null
        }
      }
      kpi_values: {
        Row: {
          company_id: string
          kpi_id: number
          ts: string
          value: number | null
          confidence: number | null
          source: string | null
        }
        Insert: {
          company_id: string
          kpi_id: number
          ts: string
          value?: number | null
          confidence?: number | null
          source?: string | null
        }
        Update: {
          company_id?: string
          kpi_id?: number
          ts?: string
          value?: number | null
          confidence?: number | null
          source?: string | null
        }
      }
      watchlists: {
        Row: {
          id: string
          user_id: string | null
          name: string
          is_default: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          name?: string
          is_default?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          is_default?: boolean | null
          created_at?: string | null
        }
      }
      watchlist_items: {
        Row: {
          watchlist_id: string
          company_id: string
          added_at: string | null
        }
        Insert: {
          watchlist_id: string
          company_id: string
          added_at?: string | null
        }
        Update: {
          watchlist_id?: string
          company_id?: string
          added_at?: string | null
        }
      }
    }
    Views: {
      v_eps_ttm: {
        Row: {
          company_id: string | null
          report_date: string | null
          eps_ttm: number | null
        }
      }
      v_pe_ttm_daily: {
        Row: {
          security_id: string | null
          date: string | null
          pe_ttm: number | null
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Application types
export interface Company {
  id: string
  ticker: string
  name: string | null
  sector: string | null
  industry: string | null
  exchange: string | null
  currency: string | null
  country: string | null
  created_at: string | null
}

export interface Security {
  id: string
  company_id: string | null
  symbol: string
  type: string | null
  is_primary: boolean | null
}

export interface PriceDaily {
  security_id: string
  d: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
}

export interface FundamentalsQuarterly {
  company_id: string
  fiscal_year: number
  fiscal_period: string
  report_date: string | null
  revenue: number | null
  gross_profit: number | null
  operating_income: number | null
  net_income: number | null
  shares_diluted: number | null
  eps_basic: number | null
  eps_diluted: number | null
  cash_from_operations: number | null
  capex: number | null
  total_assets: number | null
  total_liabilities: number | null
  shareholder_equity: number | null
  sbc: number | null
}

export interface KPI {
  id: number
  code: string
  name: string
  unit: string | null
  description: string | null
}

export interface KPIValue {
  company_id: string
  kpi_id: number
  ts: string
  value: number | null
  confidence: number | null
  source: string | null
}

export interface Watchlist {
  id: string
  user_id: string | null
  name: string
  is_default: boolean | null
  created_at: string | null
}

export interface WatchlistItem {
  watchlist_id: string
  company_id: string
  added_at: string | null
}

// Chart data types
export interface ChartDataPoint {
  date: string
  [key: string]: string | number | null
}

export interface ScreenerRow {
  ticker: string
  name: string | null
  close: number | null
  pe_ttm: number | null
  rev_yoy: number | null
  fcf_yield: number | null
  gross_margin: number | null
  op_margin: number | null
}

export interface TimeRange {
  label: string
  value: string
  days: number
}
