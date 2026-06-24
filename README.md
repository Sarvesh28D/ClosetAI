# ClosetAI — Real-Time AI Fashion Consultant

ClosetAI is a browser-based AI fashion assistant that watches your outfit through your webcam, listens to you speak, and responds with voice + live chat. There is no typing — the entire interaction is conversational.

## How It Works

1. Click the camera button to start your session
2. The AI sees your outfit through the camera and hears you through the mic
3. Speak naturally — ask about occasions, get style advice, show different outfits
4. The AI responds with voice and the conversation appears in the chat panel in real time

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.5 (App Router) + React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3.4 + shadcn/ui |
| Live AI | Google Gemini Live API (`gemini-3.1-flash-live-preview`) |
| SDK | `@google/genai` |
| User Speech | Web Speech API (browser-native, no quota) |
| AI Text | `outputAudioTranscription` on Live API session |
| Audio | Web Audio API + AudioWorklet (`public/worklets/audio-processor.js`) |
| Video | `getUserMedia` → JPEG frames → base64 |

## Getting Started

### Prerequisites

- Node.js 18+
- A Google Gemini API key ([get one free at Google AI Studio](https://aistudio.google.com/apikey))
- Chrome or Edge (Web Speech API required for user transcription)

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/Sarvesh28D/ClosetAI.git
cd ClosetAI

# 2. Install dependencies
npm install

# 3. Add your API key
# Create a file called .env.local in the project root:
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in Chrome or Edge.

### Production Build

```bash
npm run build
npm run start
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed breakdown of the data flow, component design, and key technical decisions.

## AI Persona

The AI assistant is named **Drapo** — a stylish, friendly, and supportive outfit buddy. It:
- Gives genuine, specific compliments on outfits
- Acknowledges casual/home outfits playfully
- Asks smart follow-up questions (occasion, indoor/outdoor, daytime/nighttime)
- Suggests accessories, shoes, and layering options
- Speaks casually — never robotic

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_GEMINI_API_KEY` | Yes | Google Gemini API key (exposed to browser intentionally for this demo) |
