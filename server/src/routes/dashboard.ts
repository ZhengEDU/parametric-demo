import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../auth/middleware";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/", async (_req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [assignedToday, draft, awaitingReview, returnedForCorrection, approvedToday, documentsGenerated, syncFailures, manualStepsEliminated] =
    await Promise.all([
      prisma.calibrationTask.count({ where: { scheduledDate: { gte: startOfToday } } }),
      prisma.calibrationRecord.count({ where: { status: "DRAFT" } }),
      prisma.calibrationRecord.count({ where: { status: { in: ["SUBMITTED", "RESUBMITTED", "UNDER_REVIEW"] } } }),
      prisma.calibrationRecord.count({ where: { status: "RETURNED_FOR_CORRECTION" } }),
      prisma.calibrationRecord.count({ where: { approvedAt: { gte: startOfToday } } }),
      prisma.generatedDocument.count(),
      prisma.calibrationControlSync.count({ where: { status: "FAILED" } }),
      prisma.auditEvent.count({ where: { eventType: "SUBMITTED", entityType: "CalibrationRecord" } }),
    ]);

  res.json({
    assignedToday,
    draft,
    awaitingReview,
    returnedForCorrection,
    approvedToday,
    documentsGenerated,
    syncFailures,
    manualTranscriptionStepsEliminated: manualStepsEliminated,
  });
});
