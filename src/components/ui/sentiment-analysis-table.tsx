"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { getSentimentColor, getSentimentEmoji, formatSentimentScore } from '@/hooks/use-sentiment-data';

interface SentimentDataPoint {
  ticker: string;
  sentiment_score: number;
  sentiment_label: 'positive' | 'negative' | 'neutral';
  mention_count: number;
  confidence?: number;
  key_themes?: string[];
  summary?: string;
  source_breakdown: {
    reddit: { mentions: number; avg_sentiment: number };
    twitter: { mentions: number; avg_sentiment: number };
  };
  trending_contexts: string[];
  last_updated: string;
}

interface SentimentAnalysisTableProps {
  data: SentimentDataPoint[];
  isLoading?: boolean;
  title?: string;
  onTickerClick?: (ticker: string) => void;
}

type SortField = 'ticker' | 'sentiment_score' | 'mention_count' | 'confidence' | 'last_updated';
type SortDirection = 'asc' | 'desc';

export function SentimentAnalysisTable({ 
  data = [], 
  isLoading = false, 
  title = "Sentiment Analysis",
  onTickerClick
}: SentimentAnalysisTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);
  const [sortField, setSortField] = useState<SortField>('mention_count');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  const getSortedData = () => {
    return [...data].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];
      
      // Handle special cases
      if (sortField === 'last_updated') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const sortedData = getSortedData();
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPageData = sortedData.slice(startIndex, endIndex);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  const getSentimentIcon = (score: number) => {
    if (score > 0.1) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (score < -0.1) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return null;
    
    const percentage = Math.round(confidence * 100);
    
    // High confidence (80%+): Green
    if (confidence >= 0.8) {
      return (
        <Badge className="text-xs bg-green-100 text-green-800 border-green-200 hover:bg-green-200">
          {percentage}%
        </Badge>
      );
    }
    
    // Medium confidence (60-79%): Orange/Yellow
    if (confidence >= 0.6) {
      return (
        <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200">
          {percentage}%
        </Badge>
      );
    }
    
    // Low confidence (<60%): Red
    return (
      <Badge className="text-xs bg-red-100 text-red-800 border-red-200 hover:bg-red-200">
        {percentage}%
      </Badge>
    );
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-auto p-1 font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      <span className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </span>
    </Button>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <Badge variant="outline" className="text-sm">
            {sortedData.length} stocks
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="min-w-20">
                  <SortButton field="ticker">Ticker</SortButton>
                </TableHead>
                <TableHead className="min-w-32">
                  <SortButton field="sentiment_score">Sentiment</SortButton>
                </TableHead>
                <TableHead className="min-w-24">
                  <SortButton field="mention_count">Mentions</SortButton>
                </TableHead>
                <TableHead className="min-w-24">
                  <SortButton field="confidence">Confidence</SortButton>
                </TableHead>
                <TableHead className="min-w-32">Sources</TableHead>
                <TableHead className="min-w-40">Key Themes</TableHead>
                <TableHead className="min-w-24">
                  <SortButton field="last_updated">Updated</SortButton>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPageData.map((item, index) => (
                <TableRow key={`${item.ticker}-${item.last_updated}`} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <TableCell className="font-medium text-muted-foreground">
                    {startIndex + index + 1}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onTickerClick?.(item.ticker)}
                      className="h-auto p-1 font-bold text-lg hover:bg-blue-50 dark:hover:bg-blue-900"
                    >
                      <span className="flex items-center gap-1">
                        {item.ticker}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </span>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getSentimentIcon(item.sentiment_score)}
                      <div className="flex flex-col">
                        <span className={`font-medium ${getSentimentColor(item.sentiment_score)}`}>
                          {formatSentimentScore(item.sentiment_score)}
                        </span>
                        <Badge 
                          variant={item.sentiment_label === 'positive' ? 'default' : item.sentiment_label === 'negative' ? 'destructive' : 'secondary'}
                          className="text-xs w-fit"
                        >
                          {item.sentiment_label}
                        </Badge>
                      </div>
                      <span className="text-2xl">{getSentimentEmoji(item.sentiment_score)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-lg">{item.mention_count}</span>
                      <span className="text-xs text-muted-foreground">total</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getConfidenceBadge(item.confidence)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {item.source_breakdown.reddit.mentions > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                            Reddit
                          </Badge>
                          <span>{item.source_breakdown.reddit.mentions}</span>
                          <span className={getSentimentColor(item.source_breakdown.reddit.avg_sentiment)}>
                            {formatSentimentScore(item.source_breakdown.reddit.avg_sentiment)}
                          </span>
                        </div>
                      )}
                      {item.source_breakdown.twitter.mentions > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                            Twitter
                          </Badge>
                          <span>{item.source_breakdown.twitter.mentions}</span>
                          <span className={getSentimentColor(item.source_breakdown.twitter.avg_sentiment)}>
                            {formatSentimentScore(item.source_breakdown.twitter.avg_sentiment)}
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.key_themes?.slice(0, 3).map((theme, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {theme}
                        </Badge>
                      ))}
                      {(item.key_themes?.length || 0) > 3 && (
                        <Badge variant="outline" className="text-xs opacity-60">
                          +{(item.key_themes?.length || 0) - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatTime(item.last_updated)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, sortedData.length)} of {sortedData.length} stocks
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
