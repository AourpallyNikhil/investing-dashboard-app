"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Clock, Target, TrendingUp, MessageCircle, Hash } from 'lucide-react';

interface SocialPostsFiltersProps {
  // Current filter values
  source: 'all' | 'twitter' | 'reddit';
  timeFilter: number; // hours
  actionabilityFilter: number; // 0-1
  sentimentFilter: 'all' | 'positive' | 'negative' | 'neutral';
  confidenceFilter: number; // 0-1
  tickerFilter: string;
  
  // Change handlers
  onSourceChange: (source: 'all' | 'twitter' | 'reddit') => void;
  onTimeFilterChange: (hours: number) => void;
  onActionabilityFilterChange: (score: number) => void;
  onSentimentFilterChange: (sentiment: 'all' | 'positive' | 'negative' | 'neutral') => void;
  onConfidenceFilterChange: (confidence: number) => void;
  onTickerFilterChange: (ticker: string) => void;
}

export function SocialPostsFilters({
  source,
  timeFilter,
  actionabilityFilter,
  sentimentFilter,
  confidenceFilter,
  tickerFilter,
  onSourceChange,
  onTimeFilterChange,
  onActionabilityFilterChange,
  onSentimentFilterChange,
  onConfidenceFilterChange,
  onTickerFilterChange
}: SocialPostsFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Social Posts Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Source Filter */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <MessageCircle className="h-3 w-3" />
            Data Source
          </Label>
          <Select value={source} onValueChange={onSourceChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="twitter">Twitter Only</SelectItem>
              <SelectItem value="reddit">Reddit Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Time Filter */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            Time Period
          </Label>
          <Select value={timeFilter.toString()} onValueChange={(value) => onTimeFilterChange(Number(value))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last Hour</SelectItem>
              <SelectItem value="6">Last 6 Hours</SelectItem>
              <SelectItem value="24">Last 24 Hours</SelectItem>
              <SelectItem value="72">Last 3 Days</SelectItem>
              <SelectItem value="168">Last Week</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Ticker Filter */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Hash className="h-3 w-3" />
            Specific Ticker (Optional)
          </Label>
          <Input
            placeholder="e.g., AAPL, TSLA, NVDA"
            value={tickerFilter}
            onChange={(e) => onTickerFilterChange(e.target.value.toUpperCase())}
            className="uppercase"
          />
          {tickerFilter && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">${tickerFilter}</Badge>
              <button
                onClick={() => onTickerFilterChange('')}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Actionability Score Filter */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Target className="h-3 w-3" />
            Min Actionability Score
          </Label>
          <Select 
            value={actionabilityFilter.toString()} 
            onValueChange={(value) => onActionabilityFilterChange(Number(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.0">Any (0.0)</SelectItem>
              <SelectItem value="0.1">Low (0.1)</SelectItem>
              <SelectItem value="0.3">Moderate (0.3)</SelectItem>
              <SelectItem value="0.5">Good (0.5)</SelectItem>
              <SelectItem value="0.7">High (0.7)</SelectItem>
              <SelectItem value="0.9">Very High (0.9)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sentiment Filter */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <TrendingUp className="h-3 w-3" />
            Sentiment
          </Label>
          <Select value={sentimentFilter} onValueChange={onSentimentFilterChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sentiments</SelectItem>
              <SelectItem value="positive">Bullish Only</SelectItem>
              <SelectItem value="negative">Bearish Only</SelectItem>
              <SelectItem value="neutral">Neutral Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Confidence Filter */}
        <div className="space-y-2">
          <Label>Min LLM Confidence</Label>
          <Select 
            value={confidenceFilter.toString()} 
            onValueChange={(value) => onConfidenceFilterChange(Number(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.0">Any (0.0)</SelectItem>
              <SelectItem value="0.3">Low (0.3)</SelectItem>
              <SelectItem value="0.5">Moderate (0.5)</SelectItem>
              <SelectItem value="0.7">Good (0.7)</SelectItem>
              <SelectItem value="0.8">High (0.8)</SelectItem>
              <SelectItem value="0.9">Very High (0.9)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter Summary */}
        <div className="pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            <div className="font-medium mb-2">Active Filters:</div>
            <div className="space-y-1">
              <div>Source: <Badge variant="secondary" className="text-xs">{source}</Badge></div>
              <div>Time: <Badge variant="secondary" className="text-xs">{timeFilter}h</Badge></div>
              {tickerFilter && <div>Ticker: <Badge variant="secondary" className="text-xs">${tickerFilter}</Badge></div>}
              <div>Min Actionability: <Badge variant="secondary" className="text-xs">{actionabilityFilter}</Badge></div>
              <div>Sentiment: <Badge variant="secondary" className="text-xs">{sentimentFilter}</Badge></div>
              <div>Min Confidence: <Badge variant="secondary" className="text-xs">{confidenceFilter}</Badge></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
