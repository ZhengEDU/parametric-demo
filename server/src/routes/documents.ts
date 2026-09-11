import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../auth/middleware";
import { generateCertificateForRecord } from "../services/documentGeneration";
import { readGeneratedDocument } from "../services/wordRenderer";
import { NotFoundError } from "../lib/errors";
import { loadFullRecord } from "../services/recordSerializer";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

documentsRouter.get("/", async (_req, res) => {
  const documents = await prisma.generatedDocument.findMany({
    include: {
      calibrationRecord: { include: { asset: { include: { customer: true } }, procedure: true } },
      wordTemplateRevision: true,
      generatedBy: { select: { id: true, fullName: true } },
    },
    orderBy: { generatedAt: "desc" },
  });
  res.json({ documents });
});

documentsRouter.post("/:recordId/generate", requireRole("MANAGER", "ADMIN"), async (req, res) => {
  const doc = await generateCertificateForRecord(req.params.recordId, req.user!.id);
  res.json({ document: doc, record: await loadFullRecord(req.params.recordId) });
});

/** Never exposes the raw storagePath — looks it up server-side by
 * GeneratedDocument.id, so a client can't path-traverse into arbitrary
 * files (Section 34). */
documentsRouter.get("/:id/download", async (req, res) => {
  const doc = await prisma.generatedDocument.findUnique({ where: { id: req.params.id } });
  if (!doc) throw new NotFoundError("GeneratedDocument");
  const buffer = readGeneratedDocument(doc.storagePath);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${doc.filename.replace(/"/g, "")}"`);
  res.send(buffer);
});
