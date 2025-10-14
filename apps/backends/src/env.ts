import "dotenv/config";
import { z } from "zod";


const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(10, "Set GEMINI_API_KEY in your env"),
  GEMINI_MODEL: z.string().default("gemini-2.5-pro"),
  PORT: z.string().optional(), 
});

export const env = EnvSchema.parse({
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  PORT: process.env.PORT,
});
