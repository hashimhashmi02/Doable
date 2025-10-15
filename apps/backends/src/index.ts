import express from "express";
import cors from "cors";
import { z } from "zod";
import { chatWithRetries } from "./llm";
import { env } from "./env";
import { spawn } from "node:child_process";
import * as sb from "./sandbox";

const app = express();
app.use(express.json());
app.use(cors({ origin: ["http://localhost:3000"], credentials: true }));

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "backend", ts: new Date().toISOString() })
);

// ----- LLM
const ChatBody = z.object({
  prompt: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().min(1).max(8192).optional(),
});
app.post("/api/llm/chat", async (req, res) => {
  try {
    const body = ChatBody.parse(req.body);
    const { text, modelUsed } = await chatWithRetries(body.prompt, {
      cfg: { temperature: body.temperature ?? 0.6, maxOutputTokens: body.maxOutputTokens ?? 2048 },
    });
    res.json({ ok: true, modelUsed, text });
  } catch (err: any) {
    res.status(503).json({ ok: false, error: "LLM temporarily unavailable", detail: String(err?.message ?? err) });
  }
});

// ----- Shell (whitelisted)
const ShellBody = z.object({ cmd: z.string().min(1) });
const ALLOWED = new Set(["node -v", "npm -v", "pnpm -v", "echo hello"]);

app.post("/api/tools/shell", async (req, res) => {
  try {
    const { cmd } = ShellBody.parse(req.body);
    if (!ALLOWED.has(cmd)) return res.status(400).json({ error: "command not allowed" });
    const [bin, ...args] = cmd.split(" ");
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

    let out = "", err = "";
    child.stdout.on("data", (d: { toString: () => string; }) => (out += d.toString()));
    child.stderr.on("data", (d: { toString: () => string; }) => (err += d.toString()));
    child.on("close", (code: any) => res.json({ code, out, err }));
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message ?? e) });
  }
});



// list
app.get("/api/sandbox/list", (_req, res) => {
  res.json({ files: sb.list() });
});

// read
app.post("/api/sandbox/read", (req, res) => {
  const Body = z.object({ file: z.string().min(1) });
  try {
    const { file } = Body.parse(req.body);
    res.json({ file, content: sb.read(file) });
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message ?? e) });
  }
});

// write (keep as user-op for now; later: LLM-only auth)
app.post("/api/sandbox/write", (req, res) => {
  const Body = z.object({ file: z.string().min(1), content: z.string() });
  try {
    const { file, content } = Body.parse(req.body);
    sb.write(file, content);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message ?? e) });
  }
});
app.get("/api/tools/shell/stream", (req, res) => {
  const cmd = String(req.query.cmd || "").trim();
  if (!ALLOWED.has(cmd)) {
    res.status(400).json({ error: "command not allowed" });
    return;
  }

  // SSE headers
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // nginx/etc
  });
  res.flushHeaders?.();

  // keep-alive ping
  const ping = setInterval(() => sseWrite(res, "ping", "💓"), 15000);

  const [bin, ...args] = cmd.split(" ");
  const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

  child.stdout.on("data", (d) => {
    sseWrite(res, "stdout", d.toString());
  });

  child.stderr.on("data", (d) => {
    sseWrite(res, "stderr", d.toString());
  });

  child.on("close", (code) => {
    sseWrite(res, "done", String(code ?? 0));
    clearInterval(ping);
    res.end();
  });

  child.on("error", (err) => {
    sseWrite(res, "stderr", String(err));
    sseWrite(res, "done", "-1");
    clearInterval(ping);
    res.end();
  });

  // client disconnect
  req.on("close", () => {
    try { child.kill("SIGTERM"); } catch {}
    clearInterval(ping);
  });
});

function sseWrite(res: express.Response, event: string, data: string) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${data.replace(/\n/g, "\\n")}\n\n`);
}




const PORT = Number(env.PORT ?? 4000);
app.listen(PORT, () => console.log(`backend listening on http://localhost:${PORT}`));
