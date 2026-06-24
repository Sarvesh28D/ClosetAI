"use client";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface MessageProps {
  text: string;
  timestamp?: Date;
}

export const HumanMessage = ({ text, timestamp }: MessageProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className={`flex gap-2 items-end justify-end mb-3 group ${isVisible ? 'animate-slide-in-right' : 'opacity-0'}`}>
      <div className="flex flex-col items-end max-w-[85%]">
        {timestamp && (
          <span className="text-xs text-muted-foreground mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <div className="bg-blue-500 text-white px-3 py-2 rounded-2xl rounded-br-md">
          <p className="text-sm leading-relaxed">{text}</p>
        </div>
      </div>
      <Avatar className="w-6 h-6 shrink-0">
        <AvatarImage src="/avatars/human.png" alt="You" />
        <AvatarFallback className="bg-blue-500 text-white">
          <User className="w-3 h-3" />
        </AvatarFallback>
      </Avatar>
    </div>
  );
};

export const GeminiMessage = ({ text, timestamp }: MessageProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    const typingTimer = setTimeout(() => setIsTyping(false), 1000);
    return () => clearTimeout(typingTimer);
  }, []);

  return (
    <div className={`flex gap-2 items-end mb-3 group ${isVisible ? 'animate-slide-in-left' : 'opacity-0'}`}>
      <Avatar className="w-6 h-6 shrink-0">
        <AvatarImage src="/avatars/gemini.png" alt="ClosetAI" />
        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
          <Bot className="w-3 h-3" />
        </AvatarFallback>
      </Avatar>
      
      <div className="flex flex-col max-w-[85%]">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-xs font-semibold text-purple-600">ClosetAI</span>
          {timestamp && (
            <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        
        {isTyping ? (
          <div className="bg-gray-100 px-3 py-2 rounded-2xl rounded-bl-md">
            <div className="flex items-center gap-1">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="text-xs text-gray-500 ml-1">typing...</span>
            </div>
          </div>
        ) : (
          <div className="bg-gray-100 px-3 py-2 rounded-2xl rounded-bl-md">
            <p className="text-sm leading-relaxed text-gray-800">{text}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export const WelcomeMessage = () => {
  return (
    <div className="flex gap-2 items-end mb-3 animate-slide-in-up">
      <Avatar className="w-6 h-6 shrink-0">
        <AvatarImage src="/avatars/gemini.png" alt="ClosetAI" />
        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
          <Bot className="w-3 h-3" />
        </AvatarFallback>
      </Avatar>
      
      <div className="flex flex-col max-w-[85%]">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-xs font-bold text-purple-600">ClosetAI</span>
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 px-3 py-2 rounded-2xl rounded-bl-md">
          <div className="flex items-start gap-2">
            <Sparkles className="w-3 h-3 text-purple-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-purple-700 mb-1 text-sm">
                Hey there! 👋✨
              </h3>
              <p className="text-xs leading-relaxed text-gray-700">
                I'm your personal <strong>ClosetAI</strong>! I can see and hear you, so let's chat about your style. Ready to look amazing? 💫
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
