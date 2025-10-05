"use client";

import React, { useState } from 'react';
import { ExternalLink, MessageCircle, ArrowUp, Calendar, User, Hash, ChevronLeft, ChevronRight, TrendingUp, Zap, Target, Sparkles, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// Removed Select import since we're using the parent component's source filter
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  url: string;
  permalink: string;
  subreddit: string;
}

interface TwitterPost {
  tweet_id: string;
  text: string;
  author: string;
  retweet_count: number;
  like_count: number;
  reply_count: number;
  created_at: string;
  url: string;
  hashtags?: string[];
  // LLM Analysis fields
  llm_ticker?: string;
  llm_actionability_score?: number;
  llm_sentiment_score?: number;
  llm_confidence?: number;
  llm_has_catalyst?: boolean;
  llm_key_themes?: string[];
  follower_count?: number;
}

interface UnifiedPost {
  id: string;
  source: 'twitter' | 'reddit';
  content: string;
  title?: string;
  author: string;
  created_at: string;
  url: string;
  engagement_score: number;
  engagement_details: {
    likes?: number;
    retweets?: number;
    replies?: number;
    score?: number;
    comments?: number;
  };
  llm_ticker?: string;
  llm_actionability_score?: number;
  llm_sentiment_score?: number;
  llm_confidence?: number;
  llm_has_catalyst?: boolean;
  llm_key_themes?: string[];
  platform_data: {
    subreddit?: string;
    hashtags?: string[];
    follower_count?: number;
  };
}

type SocialMediaPost = RedditPost | TwitterPost | UnifiedPost;
interface SocialMediaPostsTableProps {
  redditPosts?: RedditPost[];
  twitterPosts?: TwitterPost[];
  unifiedPosts?: UnifiedPost[]; // New unified posts prop
  title?: string;
  selectedSource?: 'all' | 'reddit' | 'twitter'; // Use the parent's source filter
}

export function SocialMediaPostsTable({ 
  redditPosts = [], 
  twitterPosts = [], 
  unifiedPosts = [],
  title = "Social Media Posts",
  selectedSource = 'all'
}: SocialMediaPostsTableProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10); // Posts per page

  const formatTime = (timestamp: number | string) => {
    let date: Date;
    if (typeof timestamp === 'number') {
      date = new Date(timestamp * 1000); // Reddit timestamp
    } else {
      date = new Date(timestamp); // Twitter timestamp
    }
    
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const isRedditPost = (post: SocialMediaPost): post is RedditPost => {
    return 'subreddit' in post;
  };

  const isTwitterPost = (post: SocialMediaPost): post is TwitterPost => {
    return 'tweet_id' in post;
  };

  const isUnifiedPost = (post: SocialMediaPost): post is UnifiedPost => {
    return 'source' in post && 'engagement_score' in post;
  };

  const getAllPosts = (): SocialMediaPost[] => {
    // If unified posts are provided, use them (they already handle filtering)
    if (unifiedPosts.length > 0) {
      return unifiedPosts;
    }
    
    // Otherwise use legacy separate posts
    switch (selectedSource) {
      case 'reddit':
        return redditPosts;
      case 'twitter':
        return twitterPosts;
      case 'all':
      default:
        return [...redditPosts, ...twitterPosts];
    }
  };

  const allPosts = getAllPosts();
  const totalPosts = allPosts.length;
  const totalPages = Math.ceil(totalPosts / pageSize);
  
  // Get posts for current page
  const getFilteredPosts = (): SocialMediaPost[] => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return allPosts.slice(startIndex, endIndex);
  };

  // Reset to page 1 when source changes (use useEffect for this)
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [selectedSource, totalPages, currentPage]);

  const filteredPosts = getFilteredPosts();

  const getPlatformBadge = (post: SocialMediaPost) => {
    if (isUnifiedPost(post)) {
      if (post.source === 'reddit') {
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Reddit</Badge>;
      }
      if (post.source === 'twitter') {
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Twitter</Badge>;
      }
    }
    if (isRedditPost(post)) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Reddit</Badge>;
    }
    if (isTwitterPost(post)) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Twitter</Badge>;
    }
    return null;
  };

  const getPostSummary = (post: SocialMediaPost) => {
    if (isUnifiedPost(post)) {
      return truncateText(post.content, 200);
    }
    if (isRedditPost(post)) {
      const content = post.selftext || post.title;
      return truncateText(content, 200);
    }
    if (isTwitterPost(post)) {
      return truncateText(post.text, 200);
    }
    return '';
  };

  const getPostTitle = (post: SocialMediaPost) => {
    if (isUnifiedPost(post)) {
      return post.title || truncateText(post.content, 100);
    }
    if (isRedditPost(post)) {
      return post.title;
    }
    if (isTwitterPost(post)) {
      return truncateText(post.text, 100);
    }
    return '';
  };

  const getEngagementMetrics = (post: SocialMediaPost) => {
    if (isUnifiedPost(post)) {
      return (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3" />
            <span>{post.engagement_score.toLocaleString()}</span>
          </div>
          {post.source === 'reddit' && post.engagement_details.comments && (
            <div className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              <span>{post.engagement_details.comments.toLocaleString()}</span>
            </div>
          )}
          {post.source === 'twitter' && post.engagement_details.retweets && (
            <div className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              <span>{post.engagement_details.retweets.toLocaleString()}</span>
            </div>
          )}
        </div>
      );
    }
    if (isRedditPost(post)) {
      return (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3" />
            <span>{post.score.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            <span>{post.num_comments.toLocaleString()}</span>
          </div>
        </div>
      );
    }
    if (isTwitterPost(post)) {
      return (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3" />
            <span>{post.like_count.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            <span>{post.retweet_count.toLocaleString()}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const getPostLink = (post: SocialMediaPost) => {
    if (isUnifiedPost(post)) {
      return post.url;
    }
    if (isRedditPost(post)) {
      return `https://reddit.com${post.permalink}`;
    }
    if (isTwitterPost(post)) {
      return post.url;
    }
    return '#';
  };

  const getAuthorInfo = (post: SocialMediaPost) => {
    if (isUnifiedPost(post)) {
      if (post.source === 'reddit') {
        return (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3 w-3" />
            <span>u/{post.author}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">r/{post.platform_data.subreddit}</span>
          </div>
        );
      }
      if (post.source === 'twitter') {
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-3 w-3" />
              <span>@{post.author}</span>
              {post.platform_data.follower_count && post.platform_data.follower_count > 1000 && (
                <span className="text-xs text-muted-foreground">
                  {post.platform_data.follower_count > 1000000 
                    ? `${(post.platform_data.follower_count / 1000000).toFixed(1)}M` 
                    : `${(post.platform_data.follower_count / 1000).toFixed(0)}K`} followers
                </span>
              )}
            </div>
            {/* Show ticker if available */}
            {post.llm_ticker && (
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs px-1 py-0 h-5">
                  ${post.llm_ticker}
                </Badge>
              </div>
            )}
            {/* Show hashtags if available */}
            {post.platform_data.hashtags && post.platform_data.hashtags.length > 0 && (
              <div className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                <span className="text-muted-foreground text-xs">{post.platform_data.hashtags.slice(0, 2).join(', ')}</span>
              </div>
            )}
          </div>
        );
      }
    }
    if (isRedditPost(post)) {
      return (
        <div className="flex items-center gap-2 text-sm">
          <User className="h-3 w-3" />
          <span>u/{post.author}</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">r/{post.subreddit}</span>
        </div>
      );
    }
    if (isTwitterPost(post)) {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3 w-3" />
            <span>@{post.author}</span>
            {post.follower_count && post.follower_count > 1000 && (
              <span className="text-xs text-muted-foreground">
                {post.follower_count > 1000000 
                  ? `${(post.follower_count / 1000000).toFixed(1)}M` 
                  : `${(post.follower_count / 1000).toFixed(0)}K`} followers
              </span>
            )}
          </div>
          {/* Show ticker if available */}
          {post.llm_ticker && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs px-1 py-0 h-5">
                ${post.llm_ticker}
              </Badge>
            </div>
          )}
          {/* Show hashtags if available */}
          {post.hashtags && post.hashtags.length > 0 && (
            <div className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              <span className="text-muted-foreground text-xs">{post.hashtags.slice(0, 2).join(', ')}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const getActionableBadges = (post: SocialMediaPost) => {
    const badges = [];
    
    // Get LLM analysis data from either unified or legacy post
    let llmData: {
      actionability_score?: number;
      confidence?: number;
      sentiment_score?: number;
      has_catalyst?: boolean;
      ticker?: string;
    } = {};
    
    if (isUnifiedPost(post)) {
      llmData = {
        actionability_score: post.llm_actionability_score,
        confidence: post.llm_confidence,
        sentiment_score: post.llm_sentiment_score,
        has_catalyst: post.llm_has_catalyst,
        ticker: post.llm_ticker
      };
    } else if (isTwitterPost(post)) {
      llmData = {
        actionability_score: post.llm_actionability_score,
        confidence: post.llm_confidence,
        sentiment_score: post.llm_sentiment_score,
        has_catalyst: post.llm_has_catalyst,
        ticker: post.llm_ticker
      };
    }
    
    // LLM Actionability Score
    if (llmData.actionability_score && llmData.actionability_score > 0.3) {
      badges.push(
        <Badge key="actionable" variant="secondary" className="bg-green-100 text-green-800 text-xs">
          <Target className="h-3 w-3 mr-1" />
          {(llmData.actionability_score * 100).toFixed(0)}% Actionable
        </Badge>
      );
    }
    
    // LLM Confidence
    if (llmData.confidence && llmData.confidence > 0.7) {
      badges.push(
        <Badge key="confidence" variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
          <Sparkles className="h-3 w-3 mr-1" />
          {(llmData.confidence * 100).toFixed(0)}% Confident
        </Badge>
      );
    }
    
    // Sentiment
    if (llmData.sentiment_score !== undefined && Math.abs(llmData.sentiment_score) > 0.1) {
      const sentiment = llmData.sentiment_score > 0.1 ? 'Bullish' : 'Bearish';
      const color = llmData.sentiment_score > 0.1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
      
      badges.push(
        <Badge key="sentiment" variant="secondary" className={`${color} text-xs`}>
          <TrendingUp className="h-3 w-3 mr-1" />
          {sentiment}
        </Badge>
      );
    }
    
    // Catalyst
    if (llmData.has_catalyst) {
      badges.push(
        <Badge key="catalyst" variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
          <Zap className="h-3 w-3 mr-1" />
          Catalyst
        </Badge>
      );
    }
    
    // Ticker badge
    if (llmData.ticker) {
      badges.push(
        <Badge key="ticker" variant="outline" className="text-xs">
          ${llmData.ticker}
        </Badge>
      );
    }
    
    return badges.length > 0 ? (
      <div className="flex flex-wrap gap-1 mt-1">
        {badges}
      </div>
    ) : null;
  };

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            📱 {title}
            <span className="text-sm font-normal text-muted-foreground">
              ({totalPosts} total posts)
            </span>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {filteredPosts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No posts available for the selected platform.</p>
            <p className="text-sm mt-1">Click "Refresh Data" to fetch latest posts.</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20 min-w-20">Platform</TableHead>
                  <TableHead className="min-w-96 max-w-none">Post</TableHead>
                  <TableHead className="w-56 min-w-56">Author & Source</TableHead>
                  <TableHead className="w-36 min-w-36">Engagement</TableHead>
                  <TableHead className="w-28 min-w-28">Time</TableHead>
                  <TableHead className="w-16 min-w-16">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPosts.map((post) => (
                  <TableRow key={isUnifiedPost(post) ? post.id : (isRedditPost(post) ? post.id : post.tweet_id)}>
                    <TableCell>
                      {getPlatformBadge(post)}
                    </TableCell>
                    
                    <TableCell className="min-w-96 max-w-none">
                      <div className="space-y-2 pr-4">
                        <h4 className="font-medium leading-tight break-words">
                          {getPostTitle(post)}
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed break-words">
                          {getPostSummary(post)}
                        </p>
                        {/* Show actionable badges for all posts with LLM data */}
                        {getActionableBadges(post)}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {getAuthorInfo(post)}
                    </TableCell>
                    
                    <TableCell>
                      {getEngagementMetrics(post)}
                    </TableCell>
                    
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatTime(isUnifiedPost(post) ? post.created_at : (isRedditPost(post) ? post.created_utc : post.created_at))}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-8 w-8 p-0"
                      >
                        <a
                          href={getPostLink(post)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View original post"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalPosts)} of {totalPosts} posts
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
