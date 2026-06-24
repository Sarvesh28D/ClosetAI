// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Fredoka, Inter } from 'next/font/google';
import './globals.css';

const fredoka = Fredoka({ 
  subsets: ['latin'],
  variable: '--font-fredoka',
  display: 'swap',
});

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ClosetAI - Your Fashion AI Assistant',
  description: 'Get personalized outfit advice through AI-powered video chat',
  keywords: ['fashion', 'AI', 'outfit', 'style', 'assistant'],
  authors: [{ name: 'ClosetAI Team' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fredoka.variable} ${inter.variable}`}>
      <head>
        <meta name="theme-color" content="#8B5DFF" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body suppressHydrationWarning className={`${inter.className} antialiased h-screen overflow-hidden`}>
        <div className="h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
          {children}
        </div>
      </body>
    </html>
  );
}
