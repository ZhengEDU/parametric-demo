import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../auth/middleware";
import { NotFoundError } from "../lib/errors";

export const assetsRouter = Router();
assetsRouter.use(requireAuth);

/** Every calibration ever done on one physical unit, newest first — lets a
 * technician on site pull up what was found/done on this same asset last
 * visit (and the visit before that) instead of only seeing the blank form
 * in front of them. Readable by every role that can be in the app, since
 * "what happened to this unit before" is useful context for anyone working
 * a job on it, not just the tech who happened to do the prior visit. */
assetsRouter.get(
  "/:id/history",
  requireRole("TECHNICIAN", "DOCUMENTATION", "MANAGER", "ADMIN", "AUDITOR"),
  async (req, res) => {
    const asset = await prisma.equipmentAsset.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        assetNumber: true,
        description: true,
        manufacturer: true,
        model: true,
        serialNumber: true,
        calibrationIntervalMonths: true,
        lastCalibratedAt: true,
        nextCalibrationDueAt: true,
      },
    });
    if (!asset) throw new NotFoundError("EquipmentAsset");

    const records = await prisma.calibrationRecord.findMany({
      where: { assetId: req.params.id },
      select: {
        id: true,
        status: true,
        finalStatus: true,
        submittedAt: true,
        createdAt: true,
        approval: { select: { approvedAt: true } },
        procedure: { select: { id: true, name: true } },
        technician: { select: { id: true, fullName: true } },
        // Most recent generated document only — a resubmission/regeneration
        // supersedes earlier ones for "what's the cert for this visit".
        generatedDocuments: { select: { id: true, filename: true, generatedAt: true }, orderBy: { generatedAt: "desc" }, take: 1 },
      },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    res.json({ asset, records });
  }
);
