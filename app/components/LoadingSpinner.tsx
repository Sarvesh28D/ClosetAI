"use client";

import { Sparkles, Heart } from "lucide-react";

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const LoadingSpinner = ({ size = 'md', text }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-primary/30 border-t-primary`} />
        <div className={`${sizeClasses[size]} absolute inset-0 animate-ping rounded-full border border-primary/20`} />
      </div>
      {text && (
        <span className="text-sm text-muted-foreground font-medium">{text}</span>
      )}
    </div>
  );
};

export const ClosetAILoader = () => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      <div className="relative">
        <div className="w-16 h-16 bg-gradient-to-br from-primary to-[hsl(var(--outfit-buddy))] rounded-3xl flex items-center justify-center floating-animation">
          <Heart className="w-8 h-8 text-white" fill="currentColor" />
        </div>
        <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-accent animate-pulse" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-success rounded-full animate-bounce" />
      </div>
      
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-primary font-fredoka">
          ClosetAI is getting ready...
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Setting up your personal fashion assistant
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};
