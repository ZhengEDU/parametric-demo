import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../auth/middleware";
import { loadFullRecord } from "../services/recordSerializer";
import { recordAuditEvent } from "../lib/audit";

export const jobsRouter = Router();
jobsRouter.use(requireAuth);

/** Technician (and documentation/admin/manager, for cross-checking)
 * dashboard: every task assigned to the current user, grouped by the
 * record's workflow status. */
jobsRouter.get("/mine", requireRole("TECHNICIAN", "DOCUMENTATION", "ADMIN", "MANAGER"), async (req, res) => {
  const technicianId = (req.query.technicianId as string) || req.user!.id;
  if (technicianId !== req.user!.id && req.user!.role !== "ADMIN" && req.user!.role !== "MANAGER") {
    res.status(403).json({ error: "FORBIDDEN", message: "Cannot view another technician's jobs" });
    return;
  }
  const tasks = await prisma.calibrationTask.findMany({
    where: { assignedTechnicianId: technicianId },
    include: {
      asset: { include: { customer: true, site: true } },
      procedure: true,
      calibrationRecord: { select: { id: true, status: true, finalStatus: true, submittedAt: true, updatedAt: true } },
    },
    orderBy: { scheduledDate: "desc" },
  });
  res.json({ tasks });
});

jobsRouter.get("/:taskId", async (req, res) => {
  const task = await prisma.calibrationTask.findUnique({
    where: { id: req.params.taskId },
    include: {
      asset: { include: { customer: true, site: true } },
      procedure: { include: { digitalFormTemplateRevision: true } },
      assignedTechnician: { select: { id: true, fullName: true } },
      calibrationRecord: { select: { id: true } },
    },
  });
  if (!task) {
    res.status(404).json({ error: "NOT_FOUND", message: "Task not found" });
    return;
  }
  if (!task.calibrationRecord) {
    res.status(409).json({ error: "NO_RECORD", message: "This task has no calibration record instantiated yet" });
    return;
  }
  const record = await loadFullRecord(task.calibrationRecord.id);

  if (req.user!.role === "TECHNICIAN" && record.status === "SUBMITTED") {
    // no-op: technicians can still view their own submitted record read-only
  }
  await recordAuditEvent(prisma, {
    userId: req.user!.id,
    eventType: "CALIBRATION_OPENED",
    entityType: "CalibrationRecord",
    entityId: record.id,
    summary: `${req.user!.fullName} opened the calibration record`,
  });
  res.json({ task, record });
});
