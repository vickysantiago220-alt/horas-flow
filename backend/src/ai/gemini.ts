import { GoogleGenAI } from '@google/genai';

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1500, 3000];

function isTemporaryGeminiError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : JSON.stringify(error);

  return (
    message.includes('503') ||
    message.includes('UNAVAILABLE') ||
    message.includes('high demand') ||
    message.includes('temporarily unavailable')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function askGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada.');
  }

  const ai = new GoogleGenAI({
    apiKey,
  });

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
      });

      return response.text?.trim() || 'Não consegui gerar uma resposta.';
    } catch (error) {
      lastError = error;

      const canRetry =
        attempt < MAX_ATTEMPTS - 1 &&
        isTemporaryGeminiError(error);

      if (!canRetry) {
        throw error;
      }

      await sleep(RETRY_DELAYS_MS[attempt] ?? 3000);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Não foi possível obter uma resposta do Gemini.');
}

