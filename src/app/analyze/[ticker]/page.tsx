'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { FundamentalAnalysis } from '@/components/analysis/fundamental-analysis'
import { InstitutionalAnalysis } from '@/components/analysis/institutional-analysis'
import { fetchCompany, queryKeys } from '@/lib/queries'

export default function AnalyzePage() {
  const params = useParams()
  const ticker = params.ticker as string
  const [activeTab, setActiveTab] = useState('fundamentals')

  const { data: company, isLoading, error } = useQuery({
    queryKey: queryKeys.company(ticker),
    queryFn: () => fetchCompany(ticker),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading analysis for {ticker}...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold mb-4">Ticker Not Found</h2>
            <p className="text-muted-foreground mb-6">
              We couldn't find data for "{ticker}". Please check the ticker symbol and try again.
            </p>
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Search
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold">{ticker}</h1>
                <p className="text-muted-foreground">{company.name}</p>
              </div>
              
              <div className="flex gap-2">
                <Badge variant="outline">{company.sector}</Badge>
                <Badge variant="outline">{company.exchange}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Ticker-Specific Analysis Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fundamentals" className="flex items-center gap-2">
              📊 Fundamentals
            </TabsTrigger>
            <TabsTrigger value="institutional" className="flex items-center gap-2">
              🏛️ Institutional
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fundamentals" className="mt-6">
            <FundamentalAnalysis ticker={ticker} />
          </TabsContent>

          <TabsContent value="institutional" className="mt-6">
            <InstitutionalAnalysis ticker={ticker} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
