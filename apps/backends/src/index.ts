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

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "backend", ts: new Date().toISOString() })
);

app.use("/api", authRoutes);
app.use("/api", projectRoutes);

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

app.post("/signup", async (req, res) => {
  const Body = z.object({ username: z.string().min(3), password: z.string().min(6) });
  try {
    const { username, password } = Body.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) return res.status(400).json({ error: "username taken" });
    const user = await prisma.user.create({ data: { username, password: await hash(password) } });
    res.json({ token: signToken(user.id), user: { id: user.id, username: user.username } });
  } catch (e: any) { res.status(400).json({ error: String(e?.message ?? e) }); }
});

app.post("/signin", async (req, res) => {
  const Body = z.object({ username: z.string(), password: z.string() });
  try {
    const { username, password } = Body.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await compare(password, user.password))) return res.status(401).json({ error: "invalid creds" });
    res.json({ token: signToken(user.id), user: { id: user.id, username: user.username } });
  } catch (e: any) { res.status(400).json({ error: String(e?.message ?? e) }); }
});

app.post("/project", authMiddleware, async (req, res) => {
  const Body = z.object({ title: z.string().min(1), initialPrompt: z.string().default("") });
  try {
    const { title, initialPrompt } = Body.parse(req.body);
    const project = await prisma.project.create({
      data: { title, initialPrompt, userId: (req as any).uid }
    });
    res.json({ project });
  } catch (e: any) { res.status(400).json({ error: String(e?.message ?? e) }); }
});

app.get("/projects", authMiddleware, async (req, res) => {
  const projects = await prisma.project.findMany({ where: { userId: (req as any).uid }, orderBy: { updatedAt: "desc" } });
  res.json({ projects });
});

app.get("/project/:projectId", authMiddleware, async (req, res) => {
  const { projectId } = req.params;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: (req as any).uid } });
  if (!project) return res.status(404).json({ error: "not found" });
  const history = await prisma.conversationHistory.findMany({
    where: { projectId }, orderBy: { createdAt: "asc" }
  });
  res.json({ project, history });
});

app.post("/project/conversation/:projectId", authMiddleware, async (req, res) => {
  const Params = z.object({ projectId: z.string() });
  const Body = z.object({
    type: z.enum(["TOOL_CALL","TEXT_MESSAGE"]),
    from: z.enum(["USER","ASSISTANT"]),
    contents: z.string(),
    hidden: z.boolean().optional(),
    toolCall: z.enum(["READ_FILE","WRITE_FILE","DELETE_FILE","UPDATE_FILE"]).optional()
  });
  try {
    const { projectId } = Params.parse(req.params);
    const { type, from, contents, hidden, toolCall } = Body.parse(req.body);
    // basic ownership check
    const own = await prisma.project.findFirst({ where: { id: projectId, userId: (req as any).uid } });
    if (!own) return res.status(404).json({ error: "project not found" });
    const rec = await prisma.conversationHistory.create({
      data: { projectId, type, from, contents, hidden: hidden ?? false, toolCall }
    });
    res.json({ ok: true, item: rec });
  } catch (e: any) { res.status(400).json({ error: String(e?.message ?? e) }); }
});

app.get("/api/llm/chat/stream", async (req, res) => {
  try {
    const schema = z.object({
      prompt: z.string().min(1),
      temperature: z.coerce.number().optional(),
      maxOutputTokens: z.coerce.number().optional(),
    });
    const { prompt, temperature, maxOutputTokens } = schema.parse(req.query);

    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    const ping = setInterval(() => sseWrite(res, "ping", "💓"), 15000);

    for await (const chunk of streamWithContinuations(prompt, { temperature, maxOutputTokens })) {
      if (chunk.type === "text") sseWrite(res, "token", chunk.data);
      else sseWrite(res, "meta", chunk.data);
    }
    sseWrite(res, "done", "ok");
    clearInterval(ping);
    res.end();
  } catch (err: any) {
    res.writeHead(500, { "Content-Type": "text/event-stream" });
    sseWrite(res, "error", String(err?.message ?? err));
    res.end();
  }
});

app.post("/api/tools/shell", async (req, res) => {
  try {
    const { cmd } = ShellBody.parse(req.body);
    if (!ALLOWED.has(cmd)) return res.status(400).json({ error: "command not allowed" });
    const [bin, ...args] = cmd.split(" ");
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

    let out = "",
      err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => res.json({ code, out, err }));
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
    try {
      child.kill("SIGTERM");
    } catch {}
    clearInterval(ping);
  });
});
app.get("/api/dbcheck", async (_req, res) => {
  const users = await prisma.user.count();
  res.json({ ok: true, users });
});

app.get("/api/sandbox/list", (_req, res) => res.json({ files: sb.list() }));
app.post("/api/sandbox/read", (req, res) => {
  const Body = z.object({ file: z.string().min(1) });
  try {
    const { file } = Body.parse(req.body);
    res.json({ file, content: sb.read(file) });
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message ?? e) });
  }
});
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

const PORT = Number(env.PORT ?? 4000);
app.listen(PORT, () => console.log(`backend listening on http://localhost:${PORT}`));
