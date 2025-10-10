'use client'

import { Navigation } from '@/components/navigation'
import { BreakoutStocks } from '@/components/analysis/breakout-stocks'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <BreakoutStocks />
      </div>
    </div>
  )
}