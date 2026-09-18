import { Router } from "express";
import type { Prisma } from "@prisma/client";
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

/** Backs the "All Records" screen, which has to stay usable once this
 * grows into the tens of thousands of historical calibration records — so
 * this filters and paginates server-side rather than shipping every row to
 * the browser (see CalibrationRecord's @@index([updatedAt]) and
 * EquipmentAsset's @@index([nextCalibrationDueAt])). */
reviewRouter.get("/all", requireRole("MANAGER", "ADMIN", "AUDITOR"), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
  const status = String(req.query.status ?? "ALL");
  const q = String(req.query.q ?? "").trim();
  const model = String(req.query.model ?? "").trim();
  const dueSoon = req.query.dueSoon === "true";

  const where: Prisma.CalibrationRecordWhereInput = {};
  if (status !== "ALL") where.status = status as never;
  const assetWhere: Prisma.EquipmentAssetWhereInput = {};
  if (dueSoon) {
    assetWhere.nextCalibrationDueAt = { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) };
  }
  // Separate from the general search box — narrows to one specific model
  // rather than any field, for someone who already knows what they're
  // looking for (e.g. "every Fluke 1620A we've ever calibrated").
  if (model) {
    assetWhere.model = { equals: model, mode: "insensitive" };
  }
  if (Object.keys(assetWhere).length > 0) where.asset = assetWhere;
  if (q) {
    where.OR = [
      { asset: { assetNumber: { contains: q, mode: "insensitive" } } },
      { asset: { serialNumber: { contains: q, mode: "insensitive" } } },
      { asset: { description: { contains: q, mode: "insensitive" } } },
      { asset: { manufacturer: { contains: q, mode: "insensitive" } } },
      { asset: { model: { contains: q, mode: "insensitive" } } },
      { asset: { customer: { name: { contains: q, mode: "insensitive" } } } },
      { technician: { fullName: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [records, total] = await Promise.all([
    prisma.calibrationRecord.findMany({
      where,
      include: {
        asset: { include: { customer: true } },
        procedure: true,
        technician: { select: { id: true, fullName: true } },
        approval: true,
        syncEvents: { orderBy: { requestedAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.calibrationRecord.count({ where }),
  ]);
  res.json({ records, total, page, pageSize });
});

/** Distinct model values in use across the asset fleet — populates the All
 * Records "Model" filter dropdown. Bounded by the number of distinct
 * models, not the (potentially tens-of-thousands) record count, so this
 * stays cheap regardless of how much history has piled up. */
reviewRouter.get("/models-in-use", requireRole("MANAGER", "ADMIN", "AUDITOR"), async (_req, res) => {
  const rows = await prisma.equipmentAsset.findMany({
    distinct: ["model"],
    select: { model: true, manufacturer: true },
    orderBy: { model: "asc" },
  });
  res.json({ models: rows });
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
