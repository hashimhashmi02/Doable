import "dotenv/config";
import { z } from "zod";
const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(10, "Set GEMINI_API_KEY in your env"),
  GEMINI_MODEL: z.string().default("gemini-2.5-pro"),
  GEMINI_FALLBACK_MODELS: z.string().optional(),
  PORT: z.string().optional(), 
});
export const env = EnvSchema.parse({
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_FALLBACK_MODELS: process.env.GEMINI_FALLBACK_MODELS,
  PORT: process.env.PORT,
});
export const MODELS: string[] = [
  env.GEMINI_MODEL,
  ...(env.GEMINI_FALLBACK_MODELS?.split(",").map(s => s.trim()).filter(Boolean) ?? []),
];
