// app/page.tsx
"use client";
import { useState, useCallback } from 'react';
import CameraPreview from './components/CameraPreview';
import Header from './components/Header';
import ChatContainer from './components/ChatContainer';
import { HumanMessage, GeminiMessage, WelcomeMessage } from './components/MessageComponents';

export default function Home() {
  const [messages, setMessages] = useState<{ type: 'human' | 'gemini', text: string, timestamp: Date }[]>([]);

  const handleTranscription = useCallback((transcription: string) => {
    setMessages(prev => [...prev, {
      type: 'gemini',
      text: transcription,
      timestamp: new Date()
    }]);
  }, []);

  const handleUserTranscription = useCallback((transcription: string) => {
    setMessages(prev => [...prev, {
      type: 'human',
      text: transcription,
      timestamp: new Date()
    }]);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Compact Header */}
      <div className="flex-none">
        <Header />
      </div>

      {/* Main Content Area - Google Meet Style */}
      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
        {/* Video Section - Left Side on desktop, top on mobile */}
        <div className="flex-1 p-2 lg:p-4 bg-slate-900/50">
          <div className="h-full">
            <CameraPreview onTranscription={handleTranscription} onUserTranscription={handleUserTranscription} />
          </div>
        </div>

        {/* Chat Section - Right Side on desktop, bottom on mobile */}
        <div className="w-full lg:w-96 h-64 lg:h-full border-t lg:border-t-0 lg:border-l border-border/30 bg-card/80 backdrop-blur-sm">
          <ChatContainer>
            <WelcomeMessage />
            {messages.map((message, index) => (
              message.type === 'human' ? (
                <HumanMessage 
                  key={`msg-${index}`} 
                  text={message.text} 
                  timestamp={message.timestamp}
                />
              ) : (
                <GeminiMessage 
                  key={`msg-${index}`} 
                  text={message.text} 
                  timestamp={message.timestamp}
                />
              )
            ))}
          </ChatContainer>
        </div>
      </div>
    </div>
  );
}
