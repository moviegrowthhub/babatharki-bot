import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function askAI(question: string, systemPrompt?: string): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: question });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 1024,
  });
  return response.choices[0]?.message?.content?.trim() || "Koi jawab nahi mila.";
}

export async function generateImage(prompt: string): Promise<Buffer> {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
    response_format: "b64_json",
  });
  const b64 = response.data[0]?.b64_json;
  if (!b64) throw new Error("No image data received from OpenAI");
  return Buffer.from(b64, "base64");
}

export async function writeBroadcastMessage(topic: string): Promise<string> {
  return askAI(
    `Write an engaging Telegram broadcast message about: "${topic}"`,
    `You are a VIP group admin writing to your exclusive paid members. Write in Hindi/Hinglish mix. Keep it under 200 words. Use emojis. Use Telegram Markdown (*bold*, _italic_). Be exciting, motivating, and make members feel they made the right choice joining. Do not include any greetings like "Hello" or sign-offs.`
  );
}

export async function generateWelcomeMessage(firstName: string, planName: string): Promise<string> {
  return askAI(
    `Write a short warm welcome message for ${firstName} who just bought the ${planName} plan in a VIP Telegram group. Max 3 lines, Hindi/Hinglish, use emojis, make them feel special.`,
    "You are a friendly VIP group owner."
  );
}
