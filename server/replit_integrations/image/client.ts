import { GoogleGenAI, Modality } from "@google/genai";

export const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

/**
 * Generate an image and return as Buffer.
 * Uses gemini-2.5-flash-image model via Replit AI Integrations.
 */
export async function generateImageBuffer(prompt: string): Promise<Buffer> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
  });

  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData
  );
  if (!imagePart?.inlineData?.data) throw new Error("No image data in response");
  return Buffer.from(imagePart.inlineData.data, "base64");
}
