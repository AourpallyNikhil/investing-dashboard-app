'use client'

import { Navigation } from '@/components/navigation'
import { MacroAnalysis } from '@/components/analysis/macro-analysis'

export default function MacroPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Macro Economic Analysis</h1>
          <p className="text-muted-foreground">
            Interest rates, economic indicators, and market-wide trends
          </p>
        </div>

        <MacroAnalysis ticker="" />
      </div>
    </div>
  )
}
