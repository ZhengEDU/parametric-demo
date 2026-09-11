import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../auth/middleware";
import { triggerCalibrationControlSync } from "../services/calibrationControlSyncService";
import { loadFullRecord } from "../services/recordSerializer";

export const syncRouter = Router();
syncRouter.use(requireAuth);

syncRouter.get("/", async (_req, res) => {
  const events = await prisma.calibrationControlSync.findMany({
    include: {
      calibrationRecord: { include: { asset: { include: { customer: true } }, procedure: true } },
      asset: true,
    },
    orderBy: { requestedAt: "desc" },
  });
  res.json({ events });
});

syncRouter.post("/:recordId", requireRole("MANAGER", "ADMIN"), async (req, res) => {
  const sync = await triggerCalibrationControlSync(req.params.recordId, req.user!);
  res.json({ sync, record: await loadFullRecord(req.params.recordId) });
});
