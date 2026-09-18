import { prisma } from "../lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Builds the initial (blank) measurement/checklist structure for a brand new
 * CalibrationRecord. Real recurring calibration work re-tests the same
 * points on the same asset every visit (e.g. the same five mass points on a
 * balance), so when a prior record exists for this asset+procedure we clone
 * its section/group/point *labels* (never the measured values — those are
 * per-visit) rather than starting from nothing. A first-time asset gets a
 * small generic starting point the technician can rename via targetValue,
 * or extend with addMeasurementPoint/addChecklistItem.
 */
export async function provisionCalibrationRecord(
  tx: Prisma.TransactionClient,
  params: { taskId: string; assetId: string; procedureId: string; technicianId: string }
) {
  const procedure = await tx.procedure.findUniqueOrThrow({ where: { id: params.procedureId } });
  const record = await tx.calibrationRecord.create({
    data: {
      taskId: params.taskId,
      assetId: params.assetId,
      procedureId: params.procedureId,
      technicianId: params.technicianId,
    },
  });

  if (procedure.documentFamily === "PREVENTATIVE_MAINTENANCE_REPORT") {
    const priorSections = await tx.pMChecklistSection.findMany({
      where: { calibrationRecord: { assetId: params.assetId, procedureId: params.procedureId } },
      orderBy: { calibrationRecord: { createdAt: "desc" } },
      include: { items: { orderBy: { sortOrder: "asc" } } },
      take: 20,
    });
    const deduped = dedupeMostRecentByRecord(priorSections);
    const sections =
      deduped.length > 0 ? deduped.map((s) => ({ name: s.name, items: s.items.map((i) => i.label) })) : DEFAULT_CHECKLIST_SECTIONS;
    for (const [si, s] of sections.entries()) {
      const section = await tx.pMChecklistSection.create({
        data: { calibrationRecordId: record.id, name: s.name, sortOrder: si },
      });
      await tx.pMChecklistItem.createMany({
        data: s.items.map((item, ii) => ({ sectionId: section.id, sortOrder: ii, label: item })),
      });
    }
    return record;
  }

  const priorSections = await tx.measurementSection.findMany({
    where: { calibrationRecord: { assetId: params.assetId, procedureId: params.procedureId } },
    orderBy: { calibrationRecord: { createdAt: "desc" } },
    include: { groups: { orderBy: { sortOrder: "asc" }, include: { points: { orderBy: { sortOrder: "asc" } } } } },
    take: 20,
  });
  const template = dedupeMostRecentSectionsByRecord(priorSections);
  const sections =
    template.length > 0
      ? template
      : [{ name: "Calibration Data", groups: [{ name: "Readings", rows: DEFAULT_ROW_LABELS }] }];

  for (const [si, s] of sections.entries()) {
    const section = await tx.measurementSection.create({
      data: { calibrationRecordId: record.id, name: s.name, sortOrder: si },
    });
    for (const [gi, g] of s.groups.entries()) {
      const group = await tx.measurementGroup.create({ data: { sectionId: section.id, name: g.name, sortOrder: gi } });
      await tx.measurementPoint.createMany({
        data: g.rows.map((rowLabel, pi) => ({ groupId: group.id, sortOrder: pi, rowLabel, values: {} })),
      });
    }
  }
  return record;
}

const DEFAULT_ROW_LABELS = ["Point 1", "Point 2", "Point 3"];
const DEFAULT_CHECKLIST_SECTIONS = [{ name: "General", items: ["Item 1", "Item 2", "Item 3"] }];

/** Prior sections come back across possibly several records (we asked for
 * up to 20 sections total, ordered newest-record-first); keep only the ones
 * belonging to the single most recent record so we clone one coherent
 * structure rather than a mix of two visits' layouts. */
export function dedupeMostRecentByRecord<T extends { calibrationRecordId: string }>(rows: T[]): T[] {
  if (rows.length === 0) return [];
  const newestRecordId = rows[0].calibrationRecordId;
  return rows.filter((r) => r.calibrationRecordId === newestRecordId);
}

export function dedupeMostRecentSectionsByRecord(
  sections: { calibrationRecordId: string; name: string; groups: { name: string; points: { rowLabel: string }[] }[] }[]
) {
  const kept = dedupeMostRecentByRecord(sections);
  return kept.map((s) => ({
    name: s.name,
    groups: s.groups.map((g) => ({ name: g.name, rows: g.points.map((p) => p.rowLabel) })),
  }));
}
