"use client";

import { Sparkles, Heart } from "lucide-react";

export default function Header() {
  return (
    <header className="relative border-b border-border/30 bg-card/80 backdrop-blur-sm">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Logo/Title - Left */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-[hsl(var(--outfit-buddy))] rounded-xl flex items-center justify-center shadow-lg">
                <Heart className="w-4 h-4 text-white" fill="currentColor" />
              </div>
              <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-accent animate-pulse" />
            </div>
            
            <div>
              <h1 className="text-xl font-bold font-fredoka bg-gradient-to-r from-primary via-[hsl(var(--outfit-buddy))] to-secondary bg-clip-text text-transparent">
                ClosetAI
              </h1>
              <p className="text-xs text-muted-foreground">Your AI Fashion Assistant</p>
            </div>
          </div>
          
          {/* Status - Right */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
            <span className="text-xs text-muted-foreground font-medium">
              Ready to help with your style!
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
