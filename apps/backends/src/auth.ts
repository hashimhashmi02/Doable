import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";
import { env } from "./env";

export function signToken(userId: string) {
  return jwt.sign({ uid: userId }, env.JWT_SECRET ?? "dev", { expiresIn: "7d" });
}

export function verifyToken(token?: string): { uid: string } | null {
  try { return token ? (jwt.verify(token, env.JWT_SECRET ?? "dev") as any) : null; }
  catch { return null; }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const h = req.header("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : undefined;
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "unauthorized" });
  (req as any).uid = payload.uid;
  next();
}

export async function hash(pw: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pw, salt);
}
export async function compare(pw: string, hashv: string) {
  return bcrypt.compare(pw, hashv);
}
