import express from "express";
import cors from "cors";
import { z } from "zod";
import { chatWithRetries } from "./llm";
import { env } from "./env";

const app = express();
app.use(express.json());
app.use(cors({ origin: ["http://localhost:3000"], credentials: true }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "backend", ts: new Date().toISOString() });
});

const ChatBody = z.object({
  prompt: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().min(1).max(8192).optional(),
});

app.post("/api/llm/chat", async (req, res) => {
  try {
    const body = ChatBody.parse(req.body);
    const { text, modelUsed } = await chatWithRetries(body.prompt, {
      cfg: {
        temperature: body.temperature ?? 0.6,
        maxOutputTokens: body.maxOutputTokens ?? 2048,
      },
    });
    res.json({ ok: true, modelUsed, text });
  } catch (err: any) {
    res.status(503).json({
      ok: false,
      error: "LLM temporarily unavailable",
      detail: String(err?.message ?? err),
    });
  }
});

// stubs
app.post("/api/tools/shell", (_req, res) => res.status(501).json({ error: "shell tool not yet enabled" }));
app.post("/api/sandbox/write", (_req, res) => res.status(501).json({ error: "sandbox write not yet enabled" }));

const PORT = Number(env.PORT ?? 4000);
app.listen(PORT, () => console.log(`backend listening on http://localhost:${PORT}`));
