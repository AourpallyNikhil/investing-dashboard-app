'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Edit, MessageCircle, Hash } from 'lucide-react'

interface RedditSource {
  id: number
  subreddit: string
  display_name: string
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface TwitterSource {
  id: number
  username: string
  display_name: string
  description: string
  follower_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function DataSourcesPage() {
  const [newRedditSource, setNewRedditSource] = useState({ subreddit: '', display_name: '', description: '' })
  const [newTwitterSource, setNewTwitterSource] = useState({ username: '', display_name: '', description: '', follower_count: 0 })
  const [isRedditDialogOpen, setIsRedditDialogOpen] = useState(false)
  const [isTwitterDialogOpen, setIsTwitterDialogOpen] = useState(false)
  
  const queryClient = useQueryClient()

  // Fetch Reddit sources
  const { data: redditSources = [], isLoading: redditLoading } = useQuery({
    queryKey: ['reddit-sources'],
    queryFn: async () => {
      const response = await fetch('/api/admin/reddit-sources')
      if (!response.ok) throw new Error('Failed to fetch Reddit sources')
      return response.json()
    }
  })

  // Fetch Twitter sources
  const { data: twitterSources = [], isLoading: twitterLoading } = useQuery({
    queryKey: ['twitter-sources'],
    queryFn: async () => {
      const response = await fetch('/api/admin/twitter-sources')
      if (!response.ok) throw new Error('Failed to fetch Twitter sources')
      return response.json()
    }
  })

  // Add Reddit source mutation
  const addRedditMutation = useMutation({
    mutationFn: async (source: Omit<RedditSource, 'id' | 'is_active' | 'created_at' | 'updated_at'>) => {
      const response = await fetch('/api/admin/reddit-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source)
      })
      if (!response.ok) throw new Error('Failed to add Reddit source')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reddit-sources'] })
      setNewRedditSource({ subreddit: '', display_name: '', description: '' })
      setIsRedditDialogOpen(false)
    }
  })

  // Add Twitter source mutation
  const addTwitterMutation = useMutation({
    mutationFn: async (source: Omit<TwitterSource, 'id' | 'is_active' | 'created_at' | 'updated_at'>) => {
      const response = await fetch('/api/admin/twitter-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source)
      })
      if (!response.ok) throw new Error('Failed to add Twitter source')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twitter-sources'] })
      setNewTwitterSource({ username: '', display_name: '', description: '', follower_count: 0 })
      setIsTwitterDialogOpen(false)
    }
  })

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ type, id, is_active }: { type: 'reddit' | 'twitter', id: number, is_active: boolean }) => {
      const response = await fetch(`/api/admin/${type}-sources/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active })
      })
      if (!response.ok) throw new Error(`Failed to update ${type} source`)
      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`${variables.type}-sources`] })
    }
  })

  // Delete source mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'reddit' | 'twitter', id: number }) => {
      const response = await fetch(`/api/admin/${type}-sources/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error(`Failed to delete ${type} source`)
      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`${variables.type}-sources`] })
    }
  })

  const handleAddReddit = () => {
    if (newRedditSource.subreddit.trim()) {
      addRedditMutation.mutate(newRedditSource)
    }
  }

  const handleAddTwitter = () => {
    if (newTwitterSource.username.trim()) {
      addTwitterMutation.mutate(newTwitterSource)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Data Sources Configuration</h1>
          <p className="text-muted-foreground">
            Manage Reddit subreddits and Twitter accounts for sentiment analysis
          </p>
        </div>

        <Tabs defaultValue="reddit" className="space-y-6">
          <TabsList>
            <TabsTrigger value="reddit" className="flex items-center space-x-2">
              <MessageCircle className="h-4 w-4" />
              <span>Reddit Sources</span>
            </TabsTrigger>
            <TabsTrigger value="twitter" className="flex items-center space-x-2">
              <Hash className="h-4 w-4" />
              <span>Twitter Sources</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reddit">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <MessageCircle className="h-5 w-5" />
                  <span>Reddit Subreddits</span>
                </CardTitle>
                <Dialog open={isRedditDialogOpen} onOpenChange={setIsRedditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Subreddit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Reddit Subreddit</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="subreddit">Subreddit Name</Label>
                        <Input
                          id="subreddit"
                          placeholder="e.g., wallstreetbets"
                          value={newRedditSource.subreddit}
                          onChange={(e) => setNewRedditSource({ ...newRedditSource, subreddit: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="display_name">Display Name</Label>
                        <Input
                          id="display_name"
                          placeholder="e.g., WallStreetBets"
                          value={newRedditSource.display_name}
                          onChange={(e) => setNewRedditSource({ ...newRedditSource, display_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          placeholder="Brief description of this subreddit"
                          value={newRedditSource.description}
                          onChange={(e) => setNewRedditSource({ ...newRedditSource, description: e.target.value })}
                        />
                      </div>
                      <Button onClick={handleAddReddit} disabled={addRedditMutation.isPending}>
                        {addRedditMutation.isPending ? 'Adding...' : 'Add Subreddit'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {redditLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {redditSources.map((source: RedditSource) => (
                      <div key={source.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">r/{source.subreddit}</span>
                            <Badge variant={source.is_active ? "default" : "secondary"}>
                              {source.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">{source.display_name}</div>
                          {source.description && (
                            <div className="text-xs text-muted-foreground mt-1">{source.description}</div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={source.is_active}
                            onCheckedChange={(checked) => 
                              toggleActiveMutation.mutate({ type: 'reddit', id: source.id, is_active: checked })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate({ type: 'reddit', id: source.id })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="twitter">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Hash className="h-5 w-5" />
                  <span>Twitter Accounts</span>
                </CardTitle>
                <Dialog open={isTwitterDialogOpen} onOpenChange={setIsTwitterDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Account
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Twitter Account</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          placeholder="e.g., jimcramer"
                          value={newTwitterSource.username}
                          onChange={(e) => setNewTwitterSource({ ...newTwitterSource, username: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="display_name">Display Name</Label>
                        <Input
                          id="display_name"
                          placeholder="e.g., Jim Cramer"
                          value={newTwitterSource.display_name}
                          onChange={(e) => setNewTwitterSource({ ...newTwitterSource, display_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="follower_count">Follower Count</Label>
                        <Input
                          id="follower_count"
                          type="number"
                          placeholder="e.g., 2000000"
                          value={newTwitterSource.follower_count}
                          onChange={(e) => setNewTwitterSource({ ...newTwitterSource, follower_count: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          placeholder="Brief description of this account"
                          value={newTwitterSource.description}
                          onChange={(e) => setNewTwitterSource({ ...newTwitterSource, description: e.target.value })}
                        />
                      </div>
                      <Button onClick={handleAddTwitter} disabled={addTwitterMutation.isPending}>
                        {addTwitterMutation.isPending ? 'Adding...' : 'Add Account'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {twitterLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {twitterSources.map((source: TwitterSource) => (
                      <div key={source.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">@{source.username}</span>
                            <Badge variant={source.is_active ? "default" : "secondary"}>
                              {source.is_active ? "Active" : "Inactive"}
                            </Badge>
                            {source.follower_count > 0 && (
                              <Badge variant="outline">
                                {source.follower_count.toLocaleString()} followers
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{source.display_name}</div>
                          {source.description && (
                            <div className="text-xs text-muted-foreground mt-1">{source.description}</div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={source.is_active}
                            onCheckedChange={(checked) => 
                              toggleActiveMutation.mutate({ type: 'twitter', id: source.id, is_active: checked })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate({ type: 'twitter', id: source.id })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
