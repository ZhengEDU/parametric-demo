import { Router } from "express";
import path from "path";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../auth/middleware";
import { renderWordTemplate } from "../services/wordRenderer";
import { buildSampleData } from "../services/sampleTemplateData";
import { NotFoundError } from "../lib/errors";
import { recordAuditEvent } from "../lib/audit";

export const templatesRouter = Router();
templatesRouter.use(requireAuth);

templatesRouter.get("/", requireRole("ADMIN", "AUDITOR", "MANAGER"), async (_req, res) => {
  const revisions = await prisma.wordTemplateRevision.findMany({
    include: {
      wordTemplate: true,
      fieldMappings: { orderBy: { sortOrder: "asc" } },
      uploadedBy: { select: { id: true, fullName: true } },
      activeForProcedures: true,
    },
    orderBy: { uploadedAt: "desc" },
  });
  res.json({ revisions });
});

templatesRouter.get("/:id/mappings", requireRole("ADMIN", "AUDITOR", "MANAGER"), async (req, res) => {
  const revision = await prisma.wordTemplateRevision.findUnique({
    where: { id: req.params.id },
    include: { fieldMappings: { orderBy: { sortOrder: "asc" } } },
  });
  if (!revision) throw new NotFoundError("WordTemplateRevision");
  res.json({ revision });
});

templatesRouter.post("/:id/generate-test", requireRole("ADMIN"), async (req, res) => {
  const revision = await prisma.wordTemplateRevision.findUnique({
    where: { id: req.params.id },
    include: { activeForProcedures: true },
  });
  if (!revision) throw new NotFoundError("WordTemplateRevision");
  const rendererKey = revision.activeForProcedures[0]?.rendererKey;
  if (!rendererKey) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "No procedure references this template revision" });
    return;
  }
  const data = buildSampleData(rendererKey);
  const templateFilePath = path.resolve(__dirname, "..", "..", revision.storagePath);
  const { buffer } = renderWordTemplate(templateFilePath, data);

  await recordAuditEvent(prisma, {
    userId: req.user!.id,
    eventType: "TEST_DOCUMENT_GENERATED",
    entityType: "WordTemplateRevision",
    entityId: revision.id,
    summary: `${req.user!.fullName} generated a test document from template revision ${revision.revision}`,
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="test-${rendererKey}.docx"`);
  res.send(buffer);
});
