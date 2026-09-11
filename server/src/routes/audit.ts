import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../auth/middleware";

export const auditRouter = Router();
auditRouter.use(requireAuth, requireRole("MANAGER", "ADMIN", "AUDITOR"));

auditRouter.get("/", async (req, res) => {
  const { entityType, entityId, limit } = req.query as Record<string, string | undefined>;
  const events = await prisma.auditEvent.findMany({
    where: {
      entityType: entityType || undefined,
      entityId: entityId || undefined,
    },
    include: { user: { select: { id: true, fullName: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: limit ? Math.min(Number(limit), 500) : 200,
  });
  res.json({ events });
});
