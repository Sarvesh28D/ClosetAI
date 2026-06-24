import { GoogleGenAI } from "@google/genai";
import { TranscriptionService } from './transcriptionService';
import { pcmToWav } from '../utils/audioUtils';

const MODEL = "gemini-3.1-flash-live-preview";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY!;

export class GeminiWebSocket {
  private session: any = null;
  private isConnected: boolean = false;
  private isSetupComplete: boolean = false;
  private onMessageCallback: ((text: string) => void) | null = null;
  private onSetupCompleteCallback: (() => void) | null = null;
  private audioContext: AudioContext | null = null;

  // Audio queue management
  private audioQueue: Float32Array[] = [];
  private isPlaying: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlayingResponse: boolean = false;
  private onPlayingStateChange: ((isPlaying: boolean) => void) | null = null;
  private onAudioLevelChange: ((level: number) => void) | null = null;
  private onTranscriptionCallback: ((text: string) => void) | null = null;
  private transcriptionService: TranscriptionService;
  private accumulatedPcmData: string[] = [];
  private disconnecting: boolean = false;

  private systemPrompt: string;
  private voiceName: string;
  private ai: GoogleGenAI;

  constructor(
    onMessage: (text: string) => void,
    onSetupComplete: () => void,
    onPlayingStateChange: (isPlaying: boolean) => void,
    onAudioLevelChange: (level: number) => void,
    onTranscription: (text: string) => void,
    systemPrompt: string = `You are Drapo — Sarvesh's stylish, friendly, and supportive outfit buddy. You chat with Sarvesh through video and help him choose the best outfits for different occasions. You act like his fashion-savvy best friend: warm, casual, honest, fun, and always focused on boosting his confidence.

# Key Behaviors:
- Speak directly to Sarvesh like a close buddy. Use casual, lively, and relatable language.
- If the outfit looks cool, stylish, or interesting, give genuine, specific compliments:
    - "Okay, I see you! That's a sharp combo."
    - "Nice! That color really pops on you."
    - "Damn, you're pulling this off like a pro today!"
- If Sarvesh is wearing pajamas, home clothes, or very casual outfits, playfully acknowledge it:
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
- Don't repeat Sarvesh's exact words — focus on natural responses.
- Never over-sugarcoat. Be real, but keep it light, playful, and positive.
- Occasionally throw in style tips:
    - "You know, adding a denim jacket here would really take this up a notch."
    - "Those sneakers would totally complete this fit."

# Extra Behaviors for Great UX:
- Suggest matching accessories, shoes, or jackets when relevant.
- Offer options: "Wanna stick to this vibe, or try something totally different?"
- If Sarvesh is unsure, encourage him: "Bro, you got this. Let's try a couple more looks till it clicks."
- If the outfit is solid: "No cap, this fit is ready to go. Wanna lock it in or check one more?"
- Occasionally drop fun closing lines:
    - "You're stepping out in style today, my man! Catch you next time!"
    - "Legendary fit. Go own the day, Sarvesh!"

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
    this.transcriptionService = new TranscriptionService();
  }

  connect() {
    if (this.session) return;
    this.disconnecting = false;

    this.ai.live.connect({
      model: MODEL,
      config: {
        responseModalities: ["AUDIO" as any],
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
          // Socket is open — SDK sends setup message after this fires.
          // Wait for the server's setupComplete message before sending media.
          console.log("[Gemini Live] WebSocket open, awaiting setup ack...");
          this.isConnected = true;
        },
        onmessage: async (message: any) => {
          if (message.setupComplete !== undefined && message.setupComplete !== null) {
            console.log("[Gemini Live] Setup complete — ready");
            this.isSetupComplete = true;
            this.onSetupCompleteCallback?.();
            return;
          }
          await this.handleMessage(message);
        },
        onerror: (error: any) => {
          console.error("[Gemini Live] WebSocket error — type:", error?.type, "| message:", error?.message, "| full:", JSON.stringify(error));
        },
        onclose: (event: any) => {
          this.isConnected = false;
          console.warn(`[Gemini Live] Closed — code: ${event.code}, reason: "${event.reason}", wasClean: ${event.wasClean}, setupComplete: ${this.isSetupComplete}`);
          this.session = null;
          if (!this.disconnecting && this.isSetupComplete) {
            setTimeout(() => this.connect(), 1000);
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
      for (let i = 0; i < float32Data.length; i++) {
        sum += Math.abs(float32Data[i]);
      }
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
      try {
        this.currentSource.stop();
      } catch (e) {
        // already stopped
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
    this.isPlayingResponse = false;
    this.onPlayingStateChange?.(false);
    this.audioQueue = [];
  }

  private async handleMessage(message: any) {
    try {
      // Handle audio data
      if (message.serverContent?.modelTurn?.parts) {
        const parts = message.serverContent.modelTurn.parts;
        for (const part of parts) {
          if (part.inlineData?.mimeType === "audio/pcm;rate=24000") {
            this.accumulatedPcmData.push(part.inlineData.data);
            this.playAudioResponse(part.inlineData.data);
          }
        }
      }

      // Handle turn completion
      if (message.serverContent?.turnComplete === true) {
        if (this.accumulatedPcmData.length > 0) {
          try {
            // Decode each base64 chunk to bytes, then concatenate — can't join base64 strings directly
            const chunks = this.accumulatedPcmData.map(b64 => {
              const binary = atob(b64);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              return bytes;
            });
            const totalLen = chunks.reduce((s, c) => s + c.length, 0);
            const pcmBytes = new Uint8Array(totalLen);
            let off = 0;
            for (const chunk of chunks) { pcmBytes.set(chunk, off); off += chunk.length; }
            // Re-encode combined bytes to a single valid base64 string
            let binaryStr = '';
            const step = 8192;
            for (let i = 0; i < pcmBytes.length; i += step) {
              binaryStr += String.fromCharCode(...pcmBytes.subarray(i, i + step));
            }
            const fullPcmData = btoa(binaryStr);
            this.accumulatedPcmData = [];

            const wavData = await pcmToWav(fullPcmData, 24000);
            const transcription = await this.transcriptionService.transcribeAudio(wavData, "audio/wav");
            console.log("[Transcription]:", transcription);
            this.onTranscriptionCallback?.(transcription);
          } catch (error) {
            console.error("[Gemini Live] Transcription error:", error);
            this.accumulatedPcmData = [];
          }
        }
      }
    } catch (error) {
      console.error("[Gemini Live] Error handling message:", error);
    }
  }

  disconnect() {
    this.disconnecting = true;
    this.isSetupComplete = false;
    this.isConnected = false;
    this.accumulatedPcmData = [];
    this.stopCurrentAudio();
    if (this.session) {
      try { this.session.close(); } catch (e) { /* ignore */ }
      this.session = null;
    }
  }
}
