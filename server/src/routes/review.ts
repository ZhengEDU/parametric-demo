import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../auth/middleware";
import { loadFullRecord } from "../services/recordSerializer";
import { openForReview, returnForCorrection, approveRecord, releaseRecord } from "../services/calibrationWorkflow";

export const reviewRouter = Router();
reviewRouter.use(requireAuth);

reviewRouter.get("/queue", requireRole("MANAGER", "ADMIN", "AUDITOR"), async (_req, res) => {
  const records = await prisma.calibrationRecord.findMany({
    where: { status: { in: ["SUBMITTED", "RESUBMITTED", "UNDER_REVIEW"] } },
    include: {
      asset: { include: { customer: true } },
      procedure: true,
      technician: { select: { id: true, fullName: true } },
    },
    orderBy: { submittedAt: "asc" },
  });
  res.json({ records });
});

reviewRouter.get("/all", requireRole("MANAGER", "ADMIN", "AUDITOR"), async (_req, res) => {
  const records = await prisma.calibrationRecord.findMany({
    include: {
      asset: { include: { customer: true } },
      procedure: true,
      technician: { select: { id: true, fullName: true } },
      approval: true,
      syncEvents: { orderBy: { requestedAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ records });
});

reviewRouter.post("/:id/open", requireRole("MANAGER", "ADMIN"), async (req, res) => {
  await openForReview(req.params.id, req.user!);
  res.json({ record: await loadFullRecord(req.params.id) });
});

reviewRouter.post("/:id/return", requireRole("MANAGER", "ADMIN"), async (req, res) => {
  const { comments, flaggedFields } = req.body ?? {};
  await returnForCorrection(req.params.id, req.user!, comments, flaggedFields ?? []);
  res.json({ record: await loadFullRecord(req.params.id) });
});

reviewRouter.post("/:id/approve", requireRole("MANAGER", "ADMIN"), async (req, res) => {
  const { comments } = req.body ?? {};
  await approveRecord(req.params.id, req.user!, comments);
  res.json({ record: await loadFullRecord(req.params.id) });
});

reviewRouter.post("/:id/release", requireRole("MANAGER", "ADMIN"), async (req, res) => {
  await releaseRecord(req.params.id, req.user!);
  res.json({ record: await loadFullRecord(req.params.id) });
});
