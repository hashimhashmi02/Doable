import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "./env";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
export const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL });

export async function simpleChat(prompt: string): Promise<string> {
  const res = await model.generateContent(prompt);
  const text = res.response.text();
  return text ?? "";
}
