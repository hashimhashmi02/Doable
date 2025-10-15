import { GoogleGenerativeAI } from "@google/generative-ai";
import { env, MODELS } from "./env";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

type GenCfg = {
  temperature?: number;
  maxOutputTokens?: number;
};

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

function backoffDelay(attempt: number) {
  const base = 400 * Math.max(1, 2 ** attempt);
  const jitter = Math.floor(Math.random() * 200);
  return base + jitter;
}

export async function chatWithRetries(
  prompt: string,
  opts: { tries?: number; cfg?: GenCfg } = {}
): Promise<{ text: string; modelUsed: string }> {
  const tries = opts.tries ?? 4;
  const cfg = opts.cfg ?? { temperature: 0.6, maxOutputTokens: 2048 };

  let lastErr: any;

  for (const modelName of MODELS) {
    const model = genAI.getGenerativeModel({ model: modelName });
    for (let i = 0; i < tries; i++) {
      try {
        const res = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: cfg,
        });
        const text = res.response.text() ?? "";
        if (!text) throw new Error("Empty response");
        return { text, modelUsed: modelName };
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message ?? err);
        const isOverload =
          msg.includes("503") ||
          msg.toLowerCase().includes("unavailable") ||
          msg.includes("429") ||
          msg.toLowerCase().includes("rate");
        if (isOverload && i < tries - 1) {
          await sleep(backoffDelay(i));
          continue;
        }
        break;
      }
    }
  }
  throw new Error(
    `LLM unavailable after retries/fallbacks. Last error: ${String(lastErr?.message ?? lastErr)}`
  );
}
