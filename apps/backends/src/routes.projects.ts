import { Router } from "express";
import { z } from "zod";
import { prisma } from "./db";
import { authMiddleware } from "./auth";

const router = Router();
router.use(authMiddleware);


const CreateProject = z.object({
  title: z.string().min(1),
  initialPrompt: z.string().min(1),
});
router.post("/project", async (req, res) => {
  try {
    const { title, initialPrompt } = CreateProject.parse(req.body);
    const uid = (req as any).uid as string;

    const project = await prisma.project.create({
      data: {
        title,
        initialPrompt,
        userId: uid,
        conversationHistory: {
          create: {
            type: "TEXT_MESSAGE",
            from: "USER",
            contents: initialPrompt,
          },
        },
      },
    });
    res.json({ ok: true, project });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: String(e?.message ?? e) });
  }
});

router.get("/projects", async (req, res) => {
  const uid = (req as any).uid as string;
  const list = await prisma.project.findMany({
    where: { userId: uid },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  res.json({ ok: true, projects: list });
});

router.get("/project/:id", async (req, res) => {
  const uid = (req as any).uid as string;
  const id = String(req.params.id);
  const project = await prisma.project.findFirst({
    where: { id, userId: uid },
    include: {
      conversationHistory: {
        orderBy: { createdAt: "asc" },
        take: 50,
      },
    },
  });
  if (!project) return res.status(404).json({ ok: false, error: "not-found" });
  res.json({ ok: true, project });
});

const Append = z.object({
  type: z.enum(["TEXT_MESSAGE", "TOOL_CALL"]),
  from: z.enum(["USER", "ASSISTANT"]),
  contents: z.string().min(1),
  toolCall: z.enum(["READ_FILE", "WRITE_FILE", "DELETE_FILE", "UPDATE_FILE"]).optional(),
  hidden: z.boolean().optional(),
});
router.post("/project/conversation/:projectId", async (req, res) => {
  try {
    const uid = (req as any).uid as string;
    const projectId = String(req.params.projectId);

    const p = await prisma.project.findFirst({ where: { id: projectId, userId: uid }, select: { id: true } });
    if (!p) return res.status(404).json({ ok: false, error: "not-found" });

    const body = Append.parse(req.body);
    const row = await prisma.conversationHistory.create({
      data: { projectId, ...body },
    });
    await prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
    res.json({ ok: true, message: row });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: String(e?.message ?? e) });
  }
});

export default router;
