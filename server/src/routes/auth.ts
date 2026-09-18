import { Router } from "express";
import { prisma } from "../lib/prisma";
import { verifyPassword } from "../auth/password";
import { signToken } from "../auth/jwt";
import { requireAuth } from "../auth/middleware";
import { recordAuditEvent } from "../lib/audit";

export const authRouter = Router();

const isProd = process.env.NODE_ENV === "production";

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "email and password are required" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { role: true } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Invalid email or password" });
    return;
  }
  const token = signToken({ userId: user.id, role: user.role.name });
  res.cookie("session", token, {
    httpOnly: true,
    // Deployed frontend and API live on different Vercel domains, so the
    // cookie must be SameSite=None to be sent on cross-site fetches (which
    // in turn requires Secure — browsers reject None without it). Local
    // dev stays Lax/non-secure since it's plain http://localhost.
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: 8 * 60 * 60 * 1000,
  });
  await recordAuditEvent(prisma, {
    userId: user.id,
    eventType: "LOGIN",
    entityType: "User",
    entityId: user.id,
    summary: `${user.fullName} logged in`,
  });
  res.json({ user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role.name } });
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  res.clearCookie("session", { httpOnly: true, sameSite: isProd ? "none" : "lax", secure: isProd });
  await recordAuditEvent(prisma, {
    userId: req.user!.id,
    eventType: "LOGOUT",
    entityType: "User",
    entityId: req.user!.id,
    summary: `${req.user!.fullName} logged out`,
  });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});
