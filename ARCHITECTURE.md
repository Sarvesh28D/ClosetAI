# ClosetAI — Architecture Deep Dive

## What Is ClosetAI?

ClosetAI is a real-time AI fashion consultant that runs entirely in the browser. You open the app, turn on your camera and microphone, and have a live conversation with an AI called **Drapo** — who can *see* your outfit through the camera, *hear* your voice through the mic, and *respond* with spoken audio and chat text in real time.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          BROWSER (Client)                            │
│                                                                      │
│  ┌──────────────┐    ┌───────────────────────────────────────────┐  │
│  │   Camera     │───▶│                                           │  │
│  │  (getUserMedia)   │          CameraPreview.tsx                │  │
│  │              │   │     (React Component — Orchestrator)       │  │
│  │   Microphone │───▶│                                           │  │
│  │  (getUserMedia)   └──────────────────┬────────────────────────┘  │
│  └──────────────┘                       │                           │
│                                         │                           │
│       ┌─────────────────────────────────┼──────────────┐           │
│       │                                 │              │           │
│       ▼                                 ▼              ▼           │
│  ┌──────────────┐       ┌───────────────────────┐  ┌──────────┐   │
│  │AudioWorklet  │──────▶│   GeminiWebSocket.ts  │  │ Chat UI  │   │
│  │(audio-       │       │  (WebSocket Manager)   │  │(ChatCont │   │
│  │ processor.js)│       └───────────┬───────────┘  │ ainer)   │   │
│  └──────────────┘                   │              └────┬─────┘   │
│                                     │                   │         │
│  ┌──────────────────┐               │  AI text via      │         │
│  │ Web Speech API   │───────────────┼─ outputAudio  ────┘         │
│  │(browser-native   │  user text    │  Transcription              │
│  │ speech recog.)   │───────────────┘  config (no extra API call) │
│  └──────────────────┘                                             │
│                                                                    │
└────────────────────────────────────┬───────────────────────────────┘
                                     │
                                     ▼
                    ┌──────────────────────────────┐
                    │   Google Gemini Live API     │
                    │  gemini-3.1-flash-live-      │
                    │  preview                     │
                    │  (bidiGenerateContent)       │
                    │  • receives video + audio    │
                    │  • streams audio response    │
                    │  • streams text transcript   │
                    │    via outputAudioTranscrip- │
                    │    tion config               │
                    └──────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 15.5 (App Router) | Full-stack React framework, serves the app |
| Language | TypeScript 5 | Type safety across the codebase |
| Styling | Tailwind CSS 3.4 + shadcn/ui | UI components and design system |
| Live AI | Google Gemini Live API (`gemini-3.1-flash-live-preview`) | Real-time multimodal conversation + AI text via `outputAudioTranscription` |
| SDK | `@google/genai` | Official SDK for Gemini Live API |
| User Transcription | Web Speech API (`webkitSpeechRecognition`) | Browser-native speech recognition — no API key or quota |
| Audio Capture | Web Audio API + AudioWorklet | Low-latency microphone processing in a dedicated thread |
| Video Capture | MediaDevices API (`getUserMedia`) | Camera stream |
| Real-time Comms | WebSocket (inside SDK) | Bidirectional streaming to Gemini |
| Fonts | Fredoka (headers), Inter (body) | UI typography |

---

## Component Architecture

```
app/
├── page.tsx                    ← Root page, owns messages state
│   ├── Header.tsx              ← Logo, title, status indicator
│   ├── CameraPreview.tsx       ← Video display + all media orchestration
│   └── ChatContainer.tsx       ← Scrollable chat panel
│       ├── WelcomeMessage      ← Initial greeting bubble
│       ├── HumanMessage        ← User speech bubble (right side)
│       └── GeminiMessage       ← AI response bubble (left side)
│
├── services/
│   └── geminiWebSocket.ts      ← WebSocket session manager, audio player, AI text via outputAudioTranscription
│
└── utils/
    └── audioUtils.ts           ← PCM → WAV converter

public/worklets/
└── audio-processor.js          ← AudioWorklet (runs in separate thread)
```

---

## Detailed Data Flow

### Phase 1 — Startup & Connection

```
User clicks camera button
        │
        ▼
CameraPreview.tsx calls getUserMedia()
  ├── Video stream  → displayed in <video> element (mirrored)
  └── Audio stream  → passed to AudioContext (16000 Hz, mono)
        │
        ▼
GeminiWebSocket.connect() is called
  └── @google/genai SDK creates WebSocket to:
      wss://generativelanguage.googleapis.com/ws/
          google.ai.generativelanguage.v1beta
          .GenerativeService.BidiGenerateContent
          ?key=API_KEY
        │
        ▼
WebSocket opens → SDK sends setup message:
  {
    setup: {
      model: "gemini-3.1-flash-live-preview",
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } } }
      },
      systemInstruction: { parts: [{ text: "You are Drapo..." }] }
    }
  }
        │
        ▼
Server responds with setupComplete message
  → onmessage callback receives { setupComplete: {} }
  → isSetupComplete = true
  → UI overlay "Connecting..." disappears
  → Media capture begins
```

---

### Phase 2 — Sending Video Frames

```
setInterval (every 1 second)
        │
        ▼
captureAndSendImage() in CameraPreview.tsx
  └── Draws current <video> frame onto hidden <canvas>
  └── canvas.toDataURL('image/jpeg', 0.8) → base64 JPEG string
  └── Strips "data:image/jpeg;base64," prefix
        │
        ▼
geminiWsRef.sendMediaChunk(b64Data, "image/jpeg")
        │
        ▼
session.sendRealtimeInput({
  video: { mimeType: "image/jpeg", data: b64Data }
})
        │
        ▼
→ Server receives the image frame
→ Gemini can now SEE the current outfit
```

---

### Phase 3 — Sending Microphone Audio

```
AudioContext (16000 Hz) created
        │
        ▼
audioWorklet.addModule('/worklets/audio-processor.js')
  └── Loads AudioWorklet in a SEPARATE THREAD (not main thread)
  └── This avoids audio glitches caused by main thread blocking
        │
        ▼
AudioWorkletNode('audio-processor') created
        │
        ▼
MediaStreamSource (mic) → AudioWorkletNode
  └── audio-processor.js runs its process() loop:
      1. Accumulates Float32 samples (2048 at a time = ~128ms at 16kHz)
      2. Converts Float32 → Int16 PCM (multiply by 32767)
      3. Calculates audio level (for the visual level bar in UI)
      4. Sends { pcmData: ArrayBuffer, level: number } via postMessage
        │
        ▼
Main thread receives postMessage from worklet:
  └── Converts ArrayBuffer → Uint8Array → base64 string
  └── Calls sendAudioData(b64Data)
        │
        ▼
session.sendRealtimeInput({
  audio: { mimeType: "audio/pcm;rate=16000", data: b64Data }
})
        │
        ▼
→ Server receives raw 16-bit PCM audio chunks
→ Gemini can now HEAR the user speaking
```

**Why AudioWorklet?** The Web Audio API's older `ScriptProcessorNode` was deprecated because it ran on the main thread and caused audio dropouts when the browser was busy. AudioWorklet runs in a dedicated audio rendering thread — always real-time, never blocked by UI updates.

---

### Phase 4 — Receiving AI Audio Response

```
Gemini processes video + audio input
        │
        ▼
Server streams WebSocket messages (multiple per response):
  {
    serverContent: {
      modelTurn: {
        parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "<base64 PCM>" } }]
      },
      outputTranscription: { text: "Hey, I see you! That's a..." }  ← text arrives in parallel
    }
  }
        │
        ├── Audio path:
        │     Decode base64 → Int16Array → Float32Array
        │     Push into audioQueue[] → playNextInQueue()
        │     AudioContext (24000 Hz) creates AudioBuffer → plays through speakers
        │     Chunks play seamlessly back-to-back via onended callback
        │
        └── Text path (outputAudioTranscription):
              serverContent.outputTranscription.text accumulated in accumulatedText string
        │
        ▼
Server sends turnComplete: true  ← AI finished its response
  ├── accumulatedText is trimmed and fired via onTranscriptionCallback
  └── accumulatedText reset to ''
```

---

### Phase 5 — Chat Text Display

**AI response text** — extracted from `outputAudioTranscription` events on the Live API session (set via `outputAudioTranscription: {}` in the session config). No separate API call is made — the text arrives in the same WebSocket session as the audio, streamed in parallel.

```
outputTranscription.text events (streamed during AI turn)
        │
        ▼
handleMessage() accumulates text in accumulatedText
        │
        ▼
turnComplete received → flush accumulatedText
        │
        ▼
onTranscriptionCallback(text)
  → page.tsx handleTranscription()
  → setMessages([...prev, { type: 'gemini', text, timestamp }])
  → GeminiMessage bubble appears in chat panel
```

**User speech text** — handled entirely in the browser via the **Web Speech API** (`webkitSpeechRecognition`). No API key, no quota, no network call.

```
CameraPreview.tsx starts SpeechRecognition when connected
  ├── continuous: true  (keeps listening between utterances)
  ├── interimResults: false  (only final results added to chat)
  └── Pauses automatically when isModelSpeaking = true
        │
        ▼
User speaks → browser recognises locally
        │
        ▼
recognition.onresult fires with transcript string
        │
        ▼
onUserTranscription(transcript)
  → page.tsx handleUserTranscription()
  → setMessages([...prev, { type: 'human', text, timestamp }])
  → HumanMessage bubble appears in chat panel
```

---

## Key Design Decisions

### 1. Why WebSocket (not HTTP)?
The Gemini Live API uses **bidirectional streaming** — the server and client send data simultaneously and continuously. HTTP request-response is one-directional and would introduce too much latency. WebSocket keeps a persistent open connection where both sides send whenever they have data.

### 2. Why One Model (not two)?
All AI work — listening, seeing, speaking, and producing chat text — is handled by a single Live API session to `gemini-3.1-flash-live-preview`. The session config includes `outputAudioTranscription: {}` which causes the server to stream text transcripts of the AI's speech in the same WebSocket session. This avoids a second `generateContent` API call entirely, which would consume quota and add latency.

User speech transcription uses the browser's **Web Speech API** — completely free, no API key, runs locally in the browser.

### 3. Why AudioWorklet in a separate thread?
Audio processing is time-sensitive. If the main JavaScript thread is busy (React re-rendering, WebSocket I/O), the audio would glitch. AudioWorklet runs in a **dedicated real-time audio thread** that the browser guarantees will never be interrupted.

### 4. Why JPEG frames (not video stream)?
Streaming raw video over WebSocket would require complex codecs and very high bandwidth. Instead, the app captures a **JPEG snapshot every 1 second** from the camera and sends that. This is sufficient for fashion analysis (outfits don't change frame-by-frame) and is far more efficient.

### 5. Why is the API key exposed in the browser?
The `NEXT_PUBLIC_` prefix in `NEXT_PUBLIC_GEMINI_API_KEY` intentionally exposes the key to the browser. This is acceptable for a demo/prototype project where the WebSocket must be initiated from the client side. In production, you would proxy through a Next.js API route that holds the key server-side.

### 6. Why the CORS header in next.config.js?
```js
// next.config.js
headers: [{ source: '/worklets/:path*', headers: [{ key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }] }]
```
AudioWorklet scripts must be loaded from the same origin or with appropriate CORS headers. Without this, the browser refuses to load `audio-processor.js` into the worklet thread.

---

## Audio Format Details

| Direction | Format | Sample Rate | Bit Depth | Channels |
|---|---|---|---|---|
| Mic → Gemini | PCM (raw) | 16,000 Hz | 16-bit signed | Mono |
| Gemini → Speaker | PCM (raw) | 24,000 Hz | 16-bit signed | Mono |

**PCM** = Pulse Code Modulation — raw audio samples with no compression. Each sample is a 16-bit integer representing air pressure at that moment in time.

---

## State Management

The app uses **React local state only** — no Redux, no Zustand.

```
page.tsx
  └── messages[]  ← array of { type, text, timestamp }
                     updated by handleTranscription()

CameraPreview.tsx
  ├── isStreaming       ← camera on/off
  ├── connectionStatus ← 'disconnected' | 'connecting' | 'connected'
  ├── isWebSocketReady ← true after setupComplete received
  ├── isModelSpeaking  ← true while AI audio is playing
  ├── audioLevel       ← mic input level (0-100)
  └── outputAudioLevel ← AI speaker level (0-100)
```

---

## File Reference

| File | Lines | Role |
|---|---|---|
| `app/page.tsx` | 61 | Root layout, owns messages state |
| `app/components/CameraPreview.tsx` | 387 | Camera/mic capture, WebSocket lifecycle orchestration |
| `app/components/ChatContainer.tsx` | 59 | Scrollable chat panel with auto-scroll |
| `app/components/MessageComponents.tsx` | 124 | HumanMessage, GeminiMessage, WelcomeMessage bubbles |
| `app/components/Header.tsx` | 39 | Top bar with logo and status |
| `app/components/StatusBar.tsx` | 63 | Connection/device status indicators |
| `app/services/geminiWebSocket.ts` | ~270 | WebSocket session, audio queue, outputAudioTranscription handling, reconnect logic |
| `app/utils/audioUtils.ts` | 110 | PCM base64 → WAV base64 converter (kept, not in active path) |
| `public/worklets/audio-processor.js` | 52 | AudioWorklet: mic samples → Int16 PCM → postMessage |
| `app/globals.css` | 368 | Custom theme, animations, message bubble styles |
| `tailwind.config.ts` | — | Custom colors, fonts, animations |
| `next.config.js` | — | CORS headers for AudioWorklet loading |

---

## Setup & Running

```bash
# 1. Clone and install
npm install

# 2. Set API key
# Create .env.local in the root:
NEXT_PUBLIC_GEMINI_API_KEY=your_google_ai_studio_key

# 3. Run development server
npm run dev
# → Open http://localhost:3000

# 4. Production build
npm run build && npm run start
```

Get your API key free from: https://aistudio.google.com/apikey

---

## How to Get an API Key

1. Go to Google AI Studio
2. Sign in with a Google account
3. Click "Get API Key" → "Create API Key"
4. Copy the key → paste into `.env.local`

The free tier supports all models used in this project.

---

## Persona & System Prompt

The AI is configured with a system prompt that defines its personality as **Drapo** — a fashion-savvy best friend who:
- Gives genuine outfit compliments
- Acknowledges casual/home outfits playfully
- Asks smart follow-up questions (occasion, vibe, indoor/outdoor)
- Suggests accessories, shoes, layering options
- Speaks casually and confidently — never robotic

The system prompt is set once during the WebSocket setup phase and applies to the entire session.

---

## Reconnection Logic

The Live API session occasionally closes (server restarts, network blips). `GeminiWebSocket` handles this automatically with **exponential backoff**:

```
Connection drops
  → isSetupComplete = false  ← critical: blocks media until new setup confirmed
  → reconnectAttempts++
  → wait reconnectDelay ms (1s → 2s → 4s → 8s → 16s)
  → call connect() again
  → on new setupComplete: reset attempts & delay to 0 / 1000ms
  → stop after 5 failed attempts
```

**Why reset `isSetupComplete` on close?** Without this, the reconnected session receives audio/video before the server has acknowledged the new setup message, causing an immediate 1008 close. Resetting it ensures `sendMediaChunk()` blocks until the new session is confirmed.

---

## Limitations & Known Issues

| Issue | Cause | Status |
|---|---|---|
| User transcription requires Chrome/Edge | Web Speech API not in Firefox | By design; target browser is Chrome |
| API key exposed in browser | `NEXT_PUBLIC_` prefix | Acceptable for demo; use server proxy in production |
| No conversation history | Live API is stateless per session | By design for real-time use |
| Audio delay on first response | AudioContext needs user gesture to start | Browser security requirement |
| Camera permission required | `getUserMedia` needs HTTPS or localhost | Works on localhost and HTTPS deployments |
| AI text only appears after full turn | `outputAudioTranscription` flushed on `turnComplete` | By design; avoids partial bubbles |
