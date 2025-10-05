'use client'

import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Settings, Database, BarChart3, Clock } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Social Sentiment Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Configure data sources and monitor scraping jobs
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/admin/sources')}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-sm">
                <Settings className="h-5 w-5 text-blue-600" />
                <span>Data Sources</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Configure Reddit subreddits and Twitter accounts to monitor
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/admin/jobs')}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-sm">
                <Database className="h-5 w-5 text-green-600" />
                <span>Cron Jobs</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Monitor and manage data collection jobs
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>System Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Last Data Collection</span>
                  <Badge variant="outline">2 hours ago</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Active Reddit Sources</span>
                  <Badge variant="default">5</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Active Twitter Sources</span>
                  <Badge variant="default">10</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Posts Collected Today</span>
                  <Badge variant="secondary">1,247</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Recent Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm">
                  <div className="font-medium">Cron job completed successfully</div>
                  <div className="text-muted-foreground text-xs">2 hours ago</div>
                </div>
                <div className="text-sm">
                  <div className="font-medium">Added new Twitter source: @newtrader</div>
                  <div className="text-muted-foreground text-xs">1 day ago</div>
                </div>
                <div className="text-sm">
                  <div className="font-medium">Reddit source r/investing updated</div>
                  <div className="text-muted-foreground text-xs">2 days ago</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}