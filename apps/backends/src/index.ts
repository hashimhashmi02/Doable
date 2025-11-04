import express from "express";
import cors from "cors";
import { z } from "zod";
import { chatWithRetries, streamWithContinuations } from "./llm";
import { env } from "./env";
import { spawn } from "node:child_process";
import * as sb from "./sandbox";
import { prisma } from "./prisma";
import { authMiddleware, hash, compare, signToken } from "./auth";
import authRoutes from "./routes.auth";
import projectRoutes from "./routes.projects";

const app = express();
app.use(express.json());
app.use(cors({ origin: ["http://localhost:3000"], credentials: true }));

function sseWrite(res: express.Response, event: string, data: string) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${data.replace(/\n/g, "\\n")}\n\n`);
}

const ShellBody = z.object({ cmd: z.string().min(1) });
const ALLOWED = new Set(["node -v", "npm -v", "pnpm -v", "echo hello"]);

/* -----------------------------------------------------------
   PUBLIC: health
----------------------------------------------------------- */
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "backend", ts: new Date().toISOString() })
);

/* -----------------------------------------------------------
   PUBLIC: SSE LLM STREAMS  (must be BEFORE any /api routers)
   EventSource cannot send Authorization, so keep these public.
----------------------------------------------------------- */
app.get("/sse/llm/stream", async (req, res) => {
  const schema = z.object({
    prompt: z.string().min(1),
    temperature: z.coerce.number().optional(),
    maxOutputTokens: z.coerce.number().optional(),
  });

  const send = (event: string, payload: unknown) => {
    const text = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
    res.write(`event: ${event}\n`);
    res.write(`data: ${text.replace(/\n/g, "\\n")}\n\n`);
  };

  try {
    const { prompt, temperature, maxOutputTokens } = schema.parse(req.query);

    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    const ping = setInterval(() => send("ping", "💓"), 15000);
    let errored = false;

    try {
      for await (const chunk of streamWithContinuations(prompt, { temperature, maxOutputTokens })) {
        if (chunk.type === "text") send("token", chunk.data);
        else send("meta", chunk.data);
      }
    } catch (e: any) {
      errored = true;
      send("server-error", { message: String(e?.message ?? e), code: e?.code ?? null });
    }

    if (!errored) send("done", "ok");
    clearInterval(ping);
    res.end();
  } catch (e: any) {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    const msg = String(e?.message ?? e);
    res.write(`event: server-error\n`);
    res.write(`data: ${msg.replace(/\n/g, "\\n")}\n\n`);
    res.write(`event: done\n`);
    res.write(`data: fail\n\n`);
    res.end();
  }
});

// Same stream on /api for convenience (still BEFORE auth routers)
app.get("/api/llm/chat/stream", async (req, res) => {
  const schema = z.object({
    prompt: z.string().min(1),
    temperature: z.coerce.number().optional(),
    maxOutputTokens: z.coerce.number().optional(),
  });

  const send = (event: string, payload: unknown) => {
    const text = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
    res.write(`event: ${event}\n`);
    res.write(`data: ${text.replace(/\n/g, "\\n")}\n\n`);
  };

  try {
    const { prompt, temperature, maxOutputTokens } = schema.parse(req.query);
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    const ping = setInterval(() => send("ping", "💓"), 15000);
    let errored = false;

    try {
      for await (const chunk of streamWithContinuations(prompt, { temperature, maxOutputTokens })) {
        if (chunk.type === "text") send("token", chunk.data);
        else send("meta", chunk.data);
      }
    } catch (e: any) {
      errored = true;
      send("server-error", { message: String(e?.message ?? e), code: e?.code ?? null });
    }

    if (!errored) send("done", "ok");
    clearInterval(ping);
    res.end();
  } catch (e: any) {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    const msg = String(e?.message ?? e);
    res.write(`event: server-error\n`);
    res.write(`data: ${msg.replace(/\n/g, "\\n")}\n\n`);
    res.write(`event: done\n`);
    res.write(`data: fail\n\n`);
    res.end();
  }
});

/* -----------------------------------------------------------
   AUTH + PROJECT ROUTERS (mounted AFTER public SSE routes)
----------------------------------------------------------- */
app.use("/api", authRoutes);
app.use("/api", projectRoutes);

/* -----------------------------------------------------------
   LLM chat (non-stream)
----------------------------------------------------------- */
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
    res
      .status(503)
      .json({ ok: false, error: "LLM temporarily unavailable", detail: String(err?.message ?? err) });
  }
});

/* -----------------------------------------------------------
   Auth endpoints (signup/signin)
----------------------------------------------------------- */
app.post("/signup", async (req, res) => {
  const Body = z.object({ username: z.string().min(3), password: z.string().min(6) });
  try {
    const { username, password } = Body.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) return res.status(400).json({ error: "username taken" });
    const user = await prisma.user.create({ data: { username, password: await hash(password) } });
    res.json({ token: signToken(user.id), user: { id: user.id, username: user.username } });
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message ?? e) });
  }
});

app.post("/signin", async (req, res) => {
  const Body = z.object({ username: z.string(), password: z.string() });
  try {
    const { username, password } = Body.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await compare(password, user.password))) return res.status(401).json({ error: "invalid creds" });
    res.json({ token: signToken(user.id), user: { id: user.id, username: user.username } });
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message ?? e) });
  }
});

/* -----------------------------------------------------------
   Project endpoints (auth-protected)
----------------------------------------------------------- */
app.post("/project", authMiddleware, async (req, res) => {
  const Body = z.object({ title: z.string().min(1), initialPrompt: z.string().default("") });
  try {
    const { title, initialPrompt } = Body.parse(req.body);
    const project = await prisma.project.create({
      data: { title, initialPrompt, userId: (req as any).uid },
    });
    res.json({ project });
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message ?? e) });
  }
});

app.get("/projects", authMiddleware, async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { userId: (req as any).uid },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ projects });
});

app.get("/project/:projectId", authMiddleware, async (req, res) => {
  const { projectId } = req.params;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: (req as any).uid } });
  if (!project) return res.status(404).json({ error: "not found" });
  const history = await prisma.conversationHistory.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  res.json({ project, history });
});

app.post("/project/conversation/:projectId", authMiddleware, async (req, res) => {
  const Params = z.object({ projectId: z.string() });
  const Body = z.object({
    type: z.enum(["TOOL_CALL", "TEXT_MESSAGE"]),
    from: z.enum(["USER", "ASSISTANT"]),
    contents: z.string(),
    hidden: z.boolean().optional(),
    toolCall: z.enum(["READ_FILE", "WRITE_FILE", "DELETE_FILE", "UPDATE_FILE"]).optional(),
  });

  try {
    const { projectId } = Params.parse(req.params);
    const { type, from, contents, hidden, toolCall } = Body.parse(req.body);
    const own = await prisma.project.findFirst({ where: { id: projectId, userId: (req as any).uid } });
    if (!own) return res.status(404).json({ error: "project not found" });
    const rec = await prisma.conversationHistory.create({
      data: { projectId, type, from, contents, hidden: hidden ?? false, toolCall },
    });
    res.json({ ok: true, item: rec });
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message ?? e) });
  }
});

/* -----------------------------------------------------------
   Sandbox + preview + shell
----------------------------------------------------------- */
app.post("/api/tools/shell", async (req, res) => {
  try {
    const { cmd } = ShellBody.parse(req.body);
    if (!ALLOWED.has(cmd)) return res.status(400).json({ error: "command not allowed" });
    const [bin, ...args] = cmd.split(" ");
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => res.json({ code, out, err }));
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message ?? e) });
  }
});

app.get("/api/tools/shell/stream", (req, res) => {
  const cmd = String(req.query.cmd || "").trim();
  if (!ALLOWED.has(cmd)) return res.status(400).json({ error: "command not allowed" });

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  const ping = setInterval(() => sseWrite(res, "ping", "💓"), 15000);
  const [bin, ...args] = cmd.split(" ");
  const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

  child.stdout.on("data", (d) => sseWrite(res, "stdout", d.toString()));
  child.stderr.on("data", (d) => sseWrite(res, "stderr", d.toString()));
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
  req.on("close", () => {
    try { child.kill("SIGTERM"); } catch {}
    clearInterval(ping);
  });
});

// preview from sandbox
function readTextSafe(fname: string) {
  try { return sb.read(fname); } catch { return null; }
}
app.get("/preview", (_req, res) => {
  const html = readTextSafe("index.html");
  if (!html) return res.status(404).send("index.html not found in sandbox");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});
app.get("/preview/:file", (req, res) => {
  const file = req.params.file;
  const content = readTextSafe(file);
  if (!content) return res.status(404).send("file not found");
  const lower = file.toLowerCase();
  if (lower.endsWith(".css")) res.type("text/css");
  else if (lower.endsWith(".js") || lower.endsWith(".mjs")) res.type("application/javascript");
  else if (lower.endsWith(".json")) res.type("application/json");
  else if (lower.endsWith(".svg")) res.type("image/svg+xml");
  else if (lower.endsWith(".png")) res.type("image/png");
  else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) res.type("image/jpeg");
  else res.type("text/plain");
  res.send(content);
});

/* -----------------------------------------------------------
   Utility + admin
----------------------------------------------------------- */
app.get("/api/dbcheck", async (_req, res) => {
  const users = await prisma.user.count();
  res.json({ ok: true, users });
});

/* -----------------------------------------------------------
   Start server
----------------------------------------------------------- */
const PORT = Number(env.PORT ?? 4000);
app.listen(PORT, () => console.log(`backend listening on http://localhost:${PORT}`));
