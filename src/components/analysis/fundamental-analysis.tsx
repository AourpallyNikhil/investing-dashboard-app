'use client'

import { ComprehensiveFinancialDashboard } from './comprehensive-financial-dashboard'

interface FundamentalAnalysisProps {
  ticker: string
}

export function FundamentalAnalysis({ ticker }: FundamentalAnalysisProps) {
  return (
    <div className="space-y-6">
      <ComprehensiveFinancialDashboard ticker={ticker} />
    </div>
  )
}
