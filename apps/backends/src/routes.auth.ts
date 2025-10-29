import { Router } from "express";
import { z } from "zod";
import { prisma } from "./db";
import { signToken, hash, compare } from "./auth";

const router = Router();
const Creds = z.object({
  username: z.string().min(3).max(40),
  password: z.string().min(6).max(200),
});

router.post("/signup", async (req, res) => {
  try {
    const { username, password } = Creds.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) return res.status(409).json({ ok: false, error: "username-taken" });

    const pwHash = await hash(password);
    const user = await prisma.user.create({ data: { username, password: pwHash } });

    const token = signToken(user.id);
    res.json({ ok: true, token, user: { id: user.id, username: user.username } });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: String(e?.message ?? e) });
  }
});

router.post("/signin", async (req, res) => {
  try {
    const { username, password } = Creds.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ ok: false, error: "invalid-creds" });
    const ok = await compare(password, user.password);
    if (!ok) return res.status(401).json({ ok: false, error: "invalid-creds" });

    const token = signToken(user.id);
    res.json({ ok: true, token, user: { id: user.id, username: user.username } });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: String(e?.message ?? e) });
  }
});

export default router;
