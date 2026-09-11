import { prisma } from "../lib/prisma";
import { NotFoundError } from "../lib/errors";

/** Single shared "load everything the UI needs about a calibration record"
 * query, used by the technician, manager, and auditor views alike so they
 * never drift out of sync with each other. */
export async function loadFullRecord(recordId: string) {
  const record = await prisma.calibrationRecord.findUnique({
    where: { id: recordId },
    include: {
      asset: { include: { customer: true, site: true, defaultProcedure: true } },
      procedure: {
        include: { digitalFormTemplateRevision: true, outputWordTemplateRevision: true },
      },
      technician: { select: { id: true, fullName: true, email: true } },
      task: { include: { workOrder: true } },
      measurementSections: {
        orderBy: { sortOrder: "asc" },
        include: {
          groups: {
            orderBy: { sortOrder: "asc" },
            include: { points: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
      pmChecklistSections: {
        orderBy: { sortOrder: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
      environmentalObservations: { orderBy: { sortOrder: "asc" } },
      standardUsages: { include: { standard: true }, orderBy: { sortOrder: "asc" } },
      reviews: { orderBy: { createdAt: "asc" }, include: { reviewer: { select: { id: true, fullName: true } } } },
      corrections: {
        orderBy: { createdAt: "asc" },
        include: { correctedBy: { select: { id: true, fullName: true } } },
      },
      approval: { include: { approvedBy: { select: { id: true, fullName: true } } } },
      generatedDocuments: { orderBy: { generatedAt: "desc" } },
      syncEvents: { orderBy: { requestedAt: "desc" } },
      revisions: { orderBy: { revisionNumber: "desc" } },
    },
  });
  if (!record) throw new NotFoundError("CalibrationRecord");
  return record;
}

export type FullRecord = Awaited<ReturnType<typeof loadFullRecord>>;
