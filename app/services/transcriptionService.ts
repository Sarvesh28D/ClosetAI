import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
const MAX_RETRIES = 3;

export class TranscriptionService {
  async transcribeAudio(audioBase64: string, mimeType: string = "audio/wav"): Promise<string> {
    let lastError: unknown;

    for (const modelName of MODELS) {
      const model = genAI.getGenerativeModel({ model: modelName });

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        }

        try {
          const result = await model.generateContent([
            { inlineData: { mimeType, data: audioBase64 } },
            { text: "Please transcribe the spoken language in this audio accurately. Ignore any background noise or non-speech sounds." },
          ]);
          return result.response.text();
        } catch (error: any) {
          lastError = error;
          const is503 = error?.message?.includes('503') || error?.status === 503;
          if (!is503) break; // non-503 errors don't benefit from retry
        }
      }
      // If we exhausted retries on this model, try the next one
    }

    throw lastError;
  }
}
