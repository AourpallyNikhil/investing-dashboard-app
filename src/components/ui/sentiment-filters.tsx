"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Clock, 
  Target, 
  TrendingUp, 
  MessageCircle, 
  Hash, 
  Filter,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Search
} from 'lucide-react';

export interface SentimentFilters {
  // Primary filters
  sentimentType: 'all' | 'bullish' | 'bearish' | 'neutral';
  source: 'all' | 'reddit' | 'twitter' | 'both';
  timeframe: '1h' | '6h' | '24h' | '3d' | '7d';
  tickerSearch: string;
  
  // Advanced filters
  mentionCountRange: [number, number];
  confidenceRange: [number, number];
  sentimentScoreRange: [number, number];
  keyThemes: string[];
  hasSummary: boolean | null; // null = all, true = with summary, false = without summary
  
  // Sorting
  sortBy: 'mentions' | 'sentiment' | 'confidence' | 'updated' | 'alphabetical';
  sortDirection: 'asc' | 'desc';
}

interface SentimentFiltersProps {
  filters: SentimentFilters;
  onFiltersChange: (filters: SentimentFilters) => void;
  availableThemes?: string[];
  mentionCountMax?: number;
}

const defaultFilters: SentimentFilters = {
  sentimentType: 'all',
  source: 'all',
  timeframe: '24h',
  tickerSearch: '',
  mentionCountRange: [1, 1000],
  confidenceRange: [0.0, 1.0],
  sentimentScoreRange: [-1.0, 1.0],
  keyThemes: [],
  hasSummary: null,
  sortBy: 'mentions',
  sortDirection: 'desc'
};

export function SentimentFilters({
  filters,
  onFiltersChange,
  availableThemes = [],
  mentionCountMax = 1000
}: SentimentFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = <K extends keyof SentimentFilters>(
    key: K,
    value: SentimentFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    onFiltersChange({
      ...defaultFilters,
      mentionCountRange: [1, mentionCountMax]
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.sentimentType !== 'all') count++;
    if (filters.source !== 'all') count++;
    if (filters.timeframe !== '24h') count++;
    if (filters.tickerSearch) count++;
    if (filters.mentionCountRange[0] > 1 || filters.mentionCountRange[1] < mentionCountMax) count++;
    if (filters.confidenceRange[0] > 0 || filters.confidenceRange[1] < 1) count++;
    if (filters.sentimentScoreRange[0] > -1 || filters.sentimentScoreRange[1] < 1) count++;
    if (filters.keyThemes.length > 0) count++;
    if (filters.hasSummary !== null) count++;
    return count;
  };

  const toggleTheme = (theme: string) => {
    const newThemes = filters.keyThemes.includes(theme)
      ? filters.keyThemes.filter(t => t !== theme)
      : [...filters.keyThemes, theme];
    updateFilter('keyThemes', newThemes);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </span>
          <div className="flex items-center gap-2">
            {getActiveFilterCount() > 0 && (
              <Badge variant="secondary" className="text-xs">
                {getActiveFilterCount()} active
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8 px-2"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Primary Filters */}
        <div className="space-y-4">
          
          {/* Ticker Search */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Search className="h-4 w-4" />
              Search Ticker
            </Label>
            <Input
              placeholder="e.g., AAPL, TSLA, NVDA"
              value={filters.tickerSearch}
              onChange={(e) => updateFilter('tickerSearch', e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Sentiment Type */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              Sentiment Type
            </Label>
            <Select value={filters.sentimentType} onValueChange={(value: any) => updateFilter('sentimentType', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sentiments</SelectItem>
                <SelectItem value="bullish">🚀 Bullish Only</SelectItem>
                <SelectItem value="bearish">📉 Bearish Only</SelectItem>
                <SelectItem value="neutral">➖ Neutral Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="h-4 w-4" />
              Data Source
            </Label>
            <Select value={filters.source} onValueChange={(value: any) => updateFilter('source', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="reddit">Reddit Only</SelectItem>
                <SelectItem value="twitter">Twitter Only</SelectItem>
                <SelectItem value="both">Both Sources</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Timeframe */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Timeframe
            </Label>
            <Select value={filters.timeframe} onValueChange={(value: any) => updateFilter('timeframe', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last 1 Hour</SelectItem>
                <SelectItem value="6h">Last 6 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="3d">Last 3 Days</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort Options */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Sort By</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filters.sortBy} onValueChange={(value: any) => updateFilter('sortBy', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mentions">Mention Count</SelectItem>
                  <SelectItem value="sentiment">Sentiment Score</SelectItem>
                  <SelectItem value="confidence">Confidence</SelectItem>
                  <SelectItem value="updated">Last Updated</SelectItem>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.sortDirection} onValueChange={(value: any) => updateFilter('sortDirection', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">High to Low</SelectItem>
                  <SelectItem value="asc">Low to High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-8">
              <span className="text-sm font-medium">Advanced Filters</span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            
            {/* Mention Count Range */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Mention Count: {filters.mentionCountRange[0]} - {filters.mentionCountRange[1]}
              </Label>
              <Slider
                value={filters.mentionCountRange}
                onValueChange={(value) => updateFilter('mentionCountRange', value as [number, number])}
                max={mentionCountMax}
                min={1}
                step={1}
                className="w-full"
              />
            </div>

            {/* Confidence Range */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Confidence: {Math.round(filters.confidenceRange[0] * 100)}% - {Math.round(filters.confidenceRange[1] * 100)}%
              </Label>
              <Slider
                value={filters.confidenceRange}
                onValueChange={(value) => updateFilter('confidenceRange', value as [number, number])}
                max={1}
                min={0}
                step={0.05}
                className="w-full"
              />
            </div>

            {/* Sentiment Score Range */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Sentiment Score: {filters.sentimentScoreRange[0].toFixed(2)} - {filters.sentimentScoreRange[1].toFixed(2)}
              </Label>
              <Slider
                value={filters.sentimentScoreRange}
                onValueChange={(value) => updateFilter('sentimentScoreRange', value as [number, number])}
                max={1}
                min={-1}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Key Themes */}
            {availableThemes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Key Themes</Label>
                <div className="flex flex-wrap gap-2">
                  {availableThemes.slice(0, 12).map((theme) => (
                    <Badge
                      key={theme}
                      variant={filters.keyThemes.includes(theme) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleTheme(theme)}
                    >
                      {theme}
                    </Badge>
                  ))}
                </div>
                {filters.keyThemes.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Selected: {filters.keyThemes.join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Has Summary Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Summary Filter</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="summary-all" className="text-sm">All Entries</Label>
                  <input
                    type="radio"
                    id="summary-all"
                    name="summary-filter"
                    checked={filters.hasSummary === null}
                    onChange={() => updateFilter('hasSummary', null)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="summary-with" className="text-sm">With AI Summary</Label>
                  <input
                    type="radio"
                    id="summary-with"
                    name="summary-filter"
                    checked={filters.hasSummary === true}
                    onChange={() => updateFilter('hasSummary', true)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="summary-without" className="text-sm">Without Summary</Label>
                  <input
                    type="radio"
                    id="summary-without"
                    name="summary-filter"
                    checked={filters.hasSummary === false}
                    onChange={() => updateFilter('hasSummary', false)}
                  />
                </div>
              </div>
            </div>

          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}















