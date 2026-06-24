import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.1-flash-live-preview";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY!;

export class GeminiWebSocket {
  private session: any = null;
  private isConnected: boolean = false;
  private isSetupComplete: boolean = false;
  private onMessageCallback: ((text: string) => void) | null = null;
  private onSetupCompleteCallback: (() => void) | null = null;
  private audioContext: AudioContext | null = null;

  // AI audio playback queue
  private audioQueue: Float32Array[] = [];
  private isPlaying: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlayingResponse: boolean = false;
  private onPlayingStateChange: ((isPlaying: boolean) => void) | null = null;
  private onAudioLevelChange: ((level: number) => void) | null = null;

  // AI response text (accumulated across parts per turn)
  private onTranscriptionCallback: ((text: string) => void) | null = null;
  private accumulatedText: string = '';

  private disconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectDelay: number = 1000;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private systemPrompt: string;
  private voiceName: string;
  private ai: GoogleGenAI;

  constructor(
    onMessage: (text: string) => void,
    onSetupComplete: () => void,
    onPlayingStateChange: (isPlaying: boolean) => void,
    onAudioLevelChange: (level: number) => void,
    onTranscription: (text: string) => void,
    systemPrompt: string = `You are Drapo — a stylish, friendly, and supportive AI outfit buddy. You chat with the user through video and help them choose the best outfits for different occasions. You act like their fashion-savvy best friend: warm, casual, honest, fun, and always focused on boosting their confidence.

# Key Behaviors:
- Speak directly to the user like a close buddy. Use casual, lively, and relatable language.
- Do not assume the user's name — address them naturally without using any name.
- If the outfit looks cool, stylish, or interesting, give genuine, specific compliments:
    - "Okay, I see you! That's a sharp combo."
    - "Nice! That color really pops on you."
    - "Damn, you're pulling this off like a pro today!"
- If the user is wearing pajamas, home clothes, or very casual outfits, playfully acknowledge it:
    - "Looks like you're chilling at home today, huh?"
    - "Comfy mode activated! Respect! What's the plan — stepping out or just vibing at home?"
    - "You in your 'don't bother me' outfit, huh? Love that energy."
- Immediately follow with natural, smart questions to drive the conversation:
    - "What's the occasion you're dressing for?"
    - "Daytime or nighttime event?"
    - "Indoor or outdoor vibe?"
    - "You going for something chill or want to make a statement today?"
    - "Comfort first, or you feeling bold today?"
- If the outfit doesn't match the occasion, kindly and directly say it:
    - "Honestly, this feels a little too casual for that formal dinner. Wanna explore something sharper?"
    - "Hmm, this fit might not hit for a party vibe. Let's level it up, what do you say?"
- Keep the chat flowing like real conversation — no robotic or repetitive summaries.
- Never over-sugarcoat. Be real, but keep it light, playful, and positive.
- Occasionally throw in style tips:
    - "You know, adding a denim jacket here would really take this up a notch."
    - "Those sneakers would totally complete this fit."

# Extra Behaviors for Great UX:
- Suggest matching accessories, shoes, or jackets when relevant.
- Offer options: "Wanna stick to this vibe, or try something totally different?"
- If the user is unsure, encourage them: "You got this. Let's try a couple more looks till it clicks."
- If the outfit is solid: "No cap, this fit is ready to go. Wanna lock it in or check one more?"
- Occasionally drop fun closing lines:
    - "You're stepping out in style today! Catch you next time!"
    - "Legendary fit. Go own the day!"

# Overall Vibe:
- Best friend energy: supportive, playful, stylish.
- Fast, fun, focused — no robotic pauses, no awkward phrasing.
- Real talk, real confidence boosts. Never judge, always guide.
`,
    voiceName: string = "Charon"
  ) {
    this.onMessageCallback = onMessage;
    this.onSetupCompleteCallback = onSetupComplete;
    this.onPlayingStateChange = onPlayingStateChange;
    this.onAudioLevelChange = onAudioLevelChange;
    this.onTranscriptionCallback = onTranscription;
    this.systemPrompt = systemPrompt;
    this.voiceName = voiceName;
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
    this.audioContext = new AudioContext({ sampleRate: 24000 });
  }

  connect() {
    if (this.session) return;
    this.disconnecting = false;

    this.ai.live.connect({
      model: MODEL,
      config: {
        responseModalities: ["AUDIO"] as any,
        outputAudioTranscription: {},
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: this.voiceName }
          }
        },
        systemInstruction: {
          parts: [{ text: this.systemPrompt }]
        }
      },
      callbacks: {
        onopen: () => {
          console.log("[Gemini Live] WebSocket open, awaiting setup ack...");
          this.isConnected = true;
        },
        onmessage: async (message: any) => {
          if (message.setupComplete !== undefined && message.setupComplete !== null) {
            console.log("[Gemini Live] Setup complete — ready");
            this.isSetupComplete = true;
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
            this.onSetupCompleteCallback?.();
            return;
          }
          await this.handleMessage(message);
        },
        onerror: (error: any) => {
          console.error("[Gemini Live] WebSocket error — type:", error?.type, "| message:", error?.message);
        },
        onclose: (event: any) => {
          this.isConnected = false;
          // Must reset isSetupComplete so media is blocked until the NEW session's
          // setup is confirmed. Without this, the reconnected session receives media
          // before the server acks setup → 1008.
          this.isSetupComplete = false;
          this.session = null;
          console.warn(`[Gemini Live] Closed — code: ${event.code}, reason: "${event.reason}", wasClean: ${event.wasClean}`);
          if (!this.disconnecting && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            console.log(`[Gemini Live] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(() => this.connect(), this.reconnectDelay);
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, 16000);
          } else if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            console.error("[Gemini Live] Max reconnect attempts reached — giving up");
          }
        }
      }
    }).then((session: any) => {
      this.session = session;
    }).catch((error: any) => {
      console.error("[Gemini Live] Connection failed:", error);
      this.isConnected = false;
    });
  }

  sendMediaChunk(b64Data: string, mimeType: string) {
    if (!this.session || !this.isSetupComplete) return;

    try {
      if (mimeType === "audio/pcm" || mimeType.startsWith("audio/")) {
        this.session.sendRealtimeInput({
          audio: { mimeType: "audio/pcm;rate=16000", data: b64Data }
        });
      } else {
        this.session.sendRealtimeInput({
          video: { mimeType, data: b64Data }
        });
      }
    } catch (error) {
      console.error("[Gemini Live] Error sending media chunk:", error);
    }
  }

  private async playAudioResponse(base64Data: string) {
    if (!this.audioContext) return;

    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcmData = new Int16Array(bytes.buffer);
      const float32Data = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        float32Data[i] = pcmData[i] / 32768.0;
      }

      this.audioQueue.push(float32Data);
      this.playNextInQueue();
    } catch (error) {
      console.error("[Gemini Live] Error processing audio:", error);
    }
  }

  private async playNextInQueue() {
    if (!this.audioContext || this.isPlaying || this.audioQueue.length === 0) return;

    try {
      this.isPlaying = true;
      this.isPlayingResponse = true;
      this.onPlayingStateChange?.(true);
      const float32Data = this.audioQueue.shift()!;

      let sum = 0;
      for (let i = 0; i < float32Data.length; i++) sum += Math.abs(float32Data[i]);
      const level = Math.min((sum / float32Data.length) * 100 * 5, 100);
      this.onAudioLevelChange?.(level);

      const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      this.currentSource = this.audioContext.createBufferSource();
      this.currentSource.buffer = audioBuffer;
      this.currentSource.connect(this.audioContext.destination);

      this.currentSource.onended = () => {
        this.isPlaying = false;
        this.currentSource = null;
        if (this.audioQueue.length === 0) {
          this.isPlayingResponse = false;
          this.onPlayingStateChange?.(false);
        }
        this.playNextInQueue();
      };

      this.currentSource.start();
    } catch (error) {
      console.error("[Gemini Live] Error playing audio:", error);
      this.isPlaying = false;
      this.isPlayingResponse = false;
      this.onPlayingStateChange?.(false);
      this.currentSource = null;
      this.playNextInQueue();
    }
  }

  private stopCurrentAudio() {
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch (e) { /* already stopped */ }
      this.currentSource = null;
    }
    this.isPlaying = false;
    this.isPlayingResponse = false;
    this.onPlayingStateChange?.(false);
    this.audioQueue = [];
  }

  private async handleMessage(message: any) {
    try {
      // Play audio chunks as they arrive
      if (message.serverContent?.modelTurn?.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
          if (part.inlineData?.mimeType === "audio/pcm;rate=24000") {
            this.playAudioResponse(part.inlineData.data);
          }
        }
      }

      // Native outputAudioTranscription — partial text events streamed alongside audio
      if (message.serverContent?.outputTranscription?.text) {
        this.accumulatedText += message.serverContent.outputTranscription.text;
      }

      // On turn end, emit the full transcript as one chat bubble
      if (message.serverContent?.turnComplete === true) {
        const text = this.accumulatedText.trim();
        this.accumulatedText = '';
        if (text) this.onTranscriptionCallback?.(text);
      }
    } catch (error) {
      console.error("[Gemini Live] Error handling message:", error);
    }
  }

  disconnect() {
    this.disconnecting = true;
    this.isSetupComplete = false;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.accumulatedText = '';
    this.stopCurrentAudio();
    if (this.session) {
      try { this.session.close(); } catch (e) { /* ignore */ }
      this.session = null;
    }
  }
}
