"use client";

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, MessageCircle, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

interface RedditPostsCarouselProps {
  posts: RedditPost[];
}

export function RedditPostsCarousel({ posts }: RedditPostsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!posts || posts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📱 Top Reddit Posts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No Reddit posts available. Click refresh to fetch latest posts.</p>
        </CardContent>
      </Card>
    );
  }

  const nextPost = () => {
    setCurrentIndex((prev) => (prev + 1) % posts.length);
  };

  const prevPost = () => {
    setCurrentIndex((prev) => (prev - 1 + posts.length) % posts.length);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const currentPost = posts[currentIndex];

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            📱 Top Reddit Posts
            <span className="text-sm font-normal text-muted-foreground">
              ({currentIndex + 1} of {posts.length})
            </span>
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={prevPost}
              disabled={posts.length <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={nextPost}
              disabled={posts.length <= 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Subreddit and metadata */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium text-primary">r/{currentPost.subreddit}</span>
              <span>•</span>
              <span>u/{currentPost.author}</span>
              <span>•</span>
              <span>{formatTime(currentPost.created_utc)}</span>
            </div>
          </div>

          {/* Post title */}
          <h3 className="text-lg font-semibold leading-tight">
            {currentPost.title}
          </h3>

          {/* Post content preview */}
          {currentPost.selftext && (
            <p className="text-muted-foreground">
              {truncateText(currentPost.selftext, 200)}
            </p>
          )}

          {/* Post metrics and actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <ArrowUp className="h-4 w-4" />
                <span>{currentPost.score.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                <span>{currentPost.num_comments.toLocaleString()}</span>
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href={currentPost.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                View on Reddit
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>

          {/* Navigation dots */}
          {posts.length > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              {posts.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    index === currentIndex 
                      ? 'bg-primary' 
                      : 'bg-muted hover:bg-muted-foreground/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
