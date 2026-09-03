import { GoogleGenAI } from '@google/genai';

export async function askGemini(
  prompt: string
): Promise<string> {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY não configurada.'
    );
  }

  const ai =
    new GoogleGenAI({
      apiKey,
    });

  const response =
    await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

  return (
    response.text?.trim() ||
    'Não consegui gerar uma resposta.'
  );
}
