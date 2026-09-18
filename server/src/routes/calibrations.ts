import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../auth/middleware";
import { loadFullRecord } from "../services/recordSerializer";
import {
  saveDraft,
  submitRecord,
  addMeasurementPoint,
  removeMeasurementPoint,
  addChecklistItem,
  removeChecklistItem,
} from "../services/calibrationWorkflow";
import { ForbiddenError } from "../lib/errors";
import multer from "multer";
import path from "path";
import { recordAuditEvent } from "../lib/audit";
import { writeFile, readFile } from "../lib/fileStorage";

export const calibrationsRouter = Router();
calibrationsRouter.use(requireAuth);

function canView(role: string, record: { technicianId: string }, userId: string) {
  if (["MANAGER", "ADMIN", "AUDITOR", "DOCUMENTATION"].includes(role)) return true;
  return record.technicianId === userId;
}

calibrationsRouter.get("/reference-standards", async (_req, res) => {
  const standards = await prisma.referenceStandard.findMany({ where: { active: true }, orderBy: { idNumber: "asc" } });
  res.json({ standards });
});

calibrationsRouter.get("/:id", async (req, res) => {
  const record = await loadFullRecord(req.params.id);
  if (!canView(req.user!.role, record, req.user!.id)) {
    throw new ForbiddenError("You cannot view another technician's calibration record");
  }
  res.json({ record });
});

calibrationsRouter.put("/:id/draft", async (req, res) => {
  const record = await saveDraft(req.params.id, req.user!, req.body ?? {});
  const full = await loadFullRecord(record!.id);
  res.json({ record: full });
});

calibrationsRouter.post("/:id/submit", async (req, res) => {
  const record = await submitRecord(req.params.id, req.user!);
  const full = await loadFullRecord(record!.id);
  res.json({ record: full });
});

calibrationsRouter.post("/:id/points", async (req, res) => {
  const { groupId, rowLabel } = req.body ?? {};
  const record = await addMeasurementPoint(req.params.id, req.user!, groupId, rowLabel);
  res.json({ record: await loadFullRecord(record!.id) });
});

calibrationsRouter.delete("/:id/points/:pointId", async (req, res) => {
  const record = await removeMeasurementPoint(req.params.id, req.user!, req.params.pointId);
  res.json({ record: await loadFullRecord(record!.id) });
});

calibrationsRouter.post("/:id/checklist-items", async (req, res) => {
  const { sectionId, label } = req.body ?? {};
  const record = await addChecklistItem(req.params.id, req.user!, sectionId, label ?? "");
  res.json({ record: await loadFullRecord(record!.id) });
});

calibrationsRouter.delete("/:id/checklist-items/:itemId", async (req, res) => {
  const record = await removeChecklistItem(req.params.id, req.user!, req.params.itemId);
  res.json({ record: await loadFullRecord(record!.id) });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      cb(new Error("Only PNG, JPG, or PDF scans are accepted"));
      return;
    }
    cb(null, true);
  },
});

const SCAN_SUBDIR = "uploads";
const SCAN_CONTENT_TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".pdf": "application/pdf" };

/** Legacy remote data-entry mode (Section 18): attach a scanned worksheet
 * to a record so a documentation employee can transcribe against it. */
calibrationsRouter.post("/:id/legacy-scan", upload.single("scan"), async (req, res) => {
  if (!["DOCUMENTATION", "ADMIN"].includes(req.user!.role)) {
    throw new ForbiddenError("Only documentation staff can upload legacy scans");
  }
  if (!req.file) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "No file uploaded" });
    return;
  }
  const ext = path.extname(req.file.originalname).toLowerCase();
  const safeName = `${req.params.id}-${Date.now()}${ext}`;
  const storagePath = await writeFile(SCAN_SUBDIR, safeName, req.file.buffer, SCAN_CONTENT_TYPES[ext]);
  await prisma.calibrationRecord.update({
    where: { id: req.params.id },
    data: {
      entryMode: "LEGACY_PAPER",
      legacyScanFilename: req.file.originalname,
      legacyScanStoragePath: storagePath,
      legacyScanUploadedAt: new Date(),
    },
  });
  await recordAuditEvent(prisma, {
    userId: req.user!.id,
    eventType: "LEGACY_SCAN_UPLOADED",
    entityType: "CalibrationRecord",
    entityId: req.params.id,
    summary: `${req.user!.fullName} uploaded a legacy scan (${req.file.originalname})`,
  });
  const full = await loadFullRecord(req.params.id);
  res.json({ record: full });
});

calibrationsRouter.get("/:id/legacy-scan", async (req, res) => {
  const record = await prisma.calibrationRecord.findUnique({ where: { id: req.params.id } });
  if (!record?.legacyScanStoragePath) {
    res.status(404).json({ error: "NOT_FOUND", message: "No scan attached" });
    return;
  }
  const buffer = await readFile(record.legacyScanStoragePath, SCAN_SUBDIR);
  const ext = path.extname(record.legacyScanFilename ?? "").toLowerCase();
  if (SCAN_CONTENT_TYPES[ext]) res.setHeader("Content-Type", SCAN_CONTENT_TYPES[ext]);
  res.send(buffer);
});
