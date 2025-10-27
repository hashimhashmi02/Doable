import { GoogleGenerativeAI } from "@google/generative-ai";
import { env, MODELS } from "./env";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export type StreamChunk = { type: "text" | "meta"; data: string };

export async function* streamWithContinuations(
  userPrompt: string,
  cfg: { temperature?: number; maxOutputTokens?: number } = {}
): AsyncGenerator<StreamChunk> {
  const generationConfig = {
    temperature: cfg.temperature ?? 0.6,
    maxOutputTokens: cfg.maxOutputTokens ?? 2048,
  };

  let prompt = userPrompt;
  let modelTriedErr: any;

  for (const modelName of MODELS) {
    try {

      let lastTail = "";
      
      while (true) {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContentStream({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig,
        });

        let finishReason = "";
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
        
            const out = lastTail && text.startsWith(lastTail) ? text.slice(lastTail.length) : text;
            if (out) yield { type: "text", data: out };
            lastTail = out.slice(-100);
          }
          const cand = chunk.candidates?.[0];
          if (cand?.finishReason) finishReason = cand.finishReason;
        }

        yield { type: "meta", data: JSON.stringify({ modelUsed: modelName, finishReason }) };
        if (finishReason === "MAX_TOKENS") {
          prompt = `Continue exactly where you left off. Do not repeat. Last 100 chars for context:\n${lastTail}`;
          continue;
        }
        break; 
      }
      return;
    } catch (err) {
      modelTriedErr = err;
    
      continue;
    }
  }
  throw new Error(`All models failed. Last error: ${String(modelTriedErr?.message ?? modelTriedErr)}`);
}
