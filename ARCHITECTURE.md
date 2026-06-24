# ClosetAI — Architecture Deep Dive

## What Is ClosetAI?

ClosetAI is a real-time AI fashion consultant that runs entirely in the browser. You open the app, turn on your camera and microphone, and have a live conversation with an AI called **Drapo** — who can *see* your outfit through the camera, *hear* your voice through the mic, and *respond* with spoken audio and chat text in real time.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│                                                                  │
│  ┌──────────────┐    ┌─────────────────────────────────────┐   │
│  │   Camera     │───▶│                                     │   │
│  │  (getUserMedia)    │         CameraPreview.tsx           │   │
│  │              │    │    (React Component - Orchestrator)  │   │
│  │   Microphone │───▶│                                     │   │
│  │  (getUserMedia)    └──────────────┬──────────────────────┘   │
│  └──────────────┘                   │                           │
│                                     │                           │
│        ┌────────────────────────────┼──────────────────┐        │
│        │                           │                  │        │
│        ▼                           ▼                  ▼        │
│  ┌──────────────┐    ┌─────────────────────┐   ┌───────────┐  │
│  │AudioWorklet  │    │  GeminiWebSocket.ts  │   │  Chat UI  │  │
│  │(audio-       │───▶│  (WebSocket Manager) │   │(ChatContai│  │
│  │ processor.js)│    │                     │   │ner.tsx)   │  │
│  └──────────────┘    └──────────┬──────────┘   └─────┬─────┘  │
│                                 │                     │        │
│                      ┌──────────┼──────────┐          │        │
│                      │          │          │          │        │
│                      ▼          ▼          ▼          │        │
│               ┌────────┐ ┌─────────┐ ┌────────┐      │        │
│               │ Video  │ │ Audio   │ │Transcrip│      │        │
│               │Frames  │ │ Chunks  │ │tion Svc │──────┘        │
│               │(JPEG)  │ │(PCM16) │ │(text out│               │
│               └───┬────┘ └───┬─────┘ └────┬────┘               │
│                   │          │             │                    │
└───────────────────┼──────────┼─────────────┼────────────────────┘
                    │          │             │
                    ▼          ▼             ▼
         ┌──────────────────────────┐  ┌────────────────────┐
         │  Google Gemini Live API  │  │  Google Gemini API │
         │  gemini-3.1-flash-live-  │  │  gemini-2.5-flash  │
         │  preview                 │  │  (generateContent) │
         │  (bidiGenerateContent)   │  └────────────────────┘
         │  WebSocket / v1beta      │
         └──────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 15.5 (App Router) | Full-stack React framework, serves the app |
| Language | TypeScript 5 | Type safety across the codebase |
| Styling | Tailwind CSS 3.4 + shadcn/ui | UI components and design system |
| Live AI | Google Gemini Live API (`gemini-3.1-flash-live-preview`) | Real-time multimodal conversation |
| Transcription | Google Gemini (`gemini-2.5-flash`) | Converts AI audio response → display text |
| SDK (Live) | `@google/genai` | Official SDK for Gemini Live API |
| SDK (Transcription) | `@google/generative-ai` | SDK for standard generateContent calls |
| Audio Capture | Web Audio API + AudioWorklet | Low-latency microphone processing |
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
│   ├── geminiWebSocket.ts      ← WebSocket session manager + audio player
│   └── transcriptionService.ts ← Audio-to-text via Gemini API
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
Server sends back WebSocket messages:
  {
    serverContent: {
      modelTurn: {
        parts: [{
          inlineData: {
            mimeType: "audio/pcm;rate=24000",
            data: "<base64 encoded PCM>"
          }
        }]
      }
    }
  }
        │
        ▼
handleMessage() in GeminiWebSocket.ts:
  ├── Decodes base64 → Int16Array (PCM)
  ├── Converts Int16 → Float32 (divides by 32768)
  ├── Pushes Float32Array into audioQueue[]
  ├── Stores base64 chunk in accumulatedPcmData[]
  └── Calls playNextInQueue()
        │
        ▼
AudioContext (24000 Hz) plays audio:
  └── Creates AudioBuffer (1 channel, 24000 Hz)
  └── Copies Float32 samples into buffer
  └── AudioBufferSourceNode.start() → you HEAR Drapo speak
  └── When chunk ends → plays next chunk in queue (seamless)
        │
        ▼
Server sends turnComplete: true
  └── Means AI has finished its response
```

---

### Phase 5 — Generating Chat Text (Transcription)

```
turnComplete received
        │
        ▼
accumulatedPcmData[] has all audio chunks as base64 strings
        │
        ▼
Each base64 chunk decoded → Uint8Array separately
All Uint8Arrays concatenated into one big byte array
Re-encoded to a single valid base64 string

  WHY: You cannot concatenate base64 strings directly.
  Each base64 string ends with padding (=) that makes the
  combined string invalid. Must decode→merge bytes→re-encode.
        │
        ▼
pcmToWav(combinedPcmBase64, 24000):
  └── Decodes PCM bytes
  └── Builds 44-byte WAV header (RIFF format)
  └── Concatenates header + PCM bytes
  └── Encodes result as base64 WAV
        │
        ▼
transcriptionService.transcribeAudio(wavBase64, "audio/wav"):
  └── Sends WAV to gemini-2.5-flash via generateContent API:
      POST /v1beta/models/gemini-2.5-flash:generateContent
      {
        contents: [{
          parts: [
            { inlineData: { mimeType: "audio/wav", data: wavBase64 } },
            { text: "Please transcribe the spoken language accurately..." }
          ]
        }]
      }
  └── Returns transcribed text string
        │
        ▼
onTranscriptionCallback(transcriptionText)
  → CameraPreview.tsx → page.tsx handleTranscription()
  → setMessages([...prev, { type: 'gemini', text, timestamp }])
  → React re-renders ChatContainer
  → GeminiMessage bubble appears in chat panel
```

---

## Key Design Decisions

### 1. Why WebSocket (not HTTP)?
The Gemini Live API uses **bidirectional streaming** — the server and client send data simultaneously and continuously. HTTP request-response is one-directional and would introduce too much latency. WebSocket keeps a persistent open connection where both sides send whenever they have data.

### 2. Why Two Different AI Models?
| Task | Model | Reason |
|---|---|---|
| Live conversation | `gemini-3.1-flash-live-preview` | Only model that supports real-time bidiGenerateContent (video + audio in, audio out) |
| Transcription | `gemini-2.5-flash` | Standard generateContent — processes a WAV file and returns text |

The Live model does NOT return text (only audio), so a second model call is needed to convert the AI's spoken words into chat text.

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
| Transcription input | WAV (with header) | 24,000 Hz | 16-bit signed | Mono |

**PCM** = Pulse Code Modulation — raw audio samples with no compression. Each sample is a 16-bit integer representing air pressure at that moment in time.

**WAV** = PCM data with a 44-byte RIFF header that tells the decoder the sample rate, bit depth, and channel count.

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
| `app/services/geminiWebSocket.ts` | ~300 | WebSocket session, audio queue, message handling |
| `app/services/transcriptionService.ts` | 31 | WAV → text via Gemini generateContent |
| `app/utils/audioUtils.ts` | 110 | PCM base64 → WAV base64 converter |
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

## Limitations & Known Issues

| Issue | Cause | Status |
|---|---|---|
| Transcription occasionally fails with 503 | `gemini-2.5-flash` server overload | Temporary; retries work |
| API key exposed in browser | `NEXT_PUBLIC_` prefix | Acceptable for demo; use server proxy in production |
| No conversation history | Live API is stateless per session | By design for real-time use |
| Audio delay on first response | AudioContext needs user gesture to start | Browser security requirement |
| Camera permission required | `getUserMedia` needs HTTPS or localhost | Works on localhost and HTTPS deployments |
