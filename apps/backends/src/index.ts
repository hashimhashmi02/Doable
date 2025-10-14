import express from "express";
import cors from "cors";
import { z } from "zod";
import { simpleChat } from "./llm";
import { env } from "./env";

const app = express();
app.use(express.json());
app.use(cors({ origin: ["http://localhost:3000"], credentials: true }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "backend", ts: new Date().toISOString() });
});

const ChatBody = z.object({
  prompt: z.string().min(1),
});

app.post("/api/llm/chat", async (req, res) => {
  try {
    const { prompt } = ChatBody.parse(req.body);
    const text = await simpleChat(prompt);
    res.json({ ok: true, text });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: String(err?.message ?? err) });
  }
});


app.post("/api/tools/shell", (_req, res) => res.status(501).json({ error: "shell tool not yet enabled" }));
app.post("/api/sandbox/write", (_req, res) => res.status(501).json({ error: "sandbox write not yet enabled" }));

const PORT = Number(env.PORT ?? 4000);
app.listen(PORT, () => console.log(`backend listening on http://localhost:${PORT}`));
