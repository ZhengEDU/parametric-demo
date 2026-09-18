/**
 * Load-test / scale-proof seed: generates a large batch of historical,
 * already-RELEASED calibration records so the "All Records" screen and its
 * backing query can be exercised at the volume the real business expects
 * (12,000+ records) instead of only the ~10 illustrative records from
 * prisma/seed.ts. Not idempotent — running it twice adds another batch.
 *
 * Uses precomputed UUIDs + chunked createMany() throughout (never one
 * .create() per row) so 12k records' worth of tasks/records/measurement
 * rows load in a handful of round trips instead of tens of thousands.
 *
 * Usage: npm run seed:bulk -- [count]   (default 12000)
 */
import crypto from "crypto";
import { PrismaClient, WorkflowState, FinalStatus } from "@prisma/client";
import { scaleOf } from "../src/lib/precision";
import { addMonths } from "../src/lib/dates";

const prisma = new PrismaClient();
const COUNT = Number(process.argv[2]) || 12000;
const CHUNK = 2000;

function cell(value: string, unit?: string) {
  return { numericValue: value, displayScale: scaleOf(value), displayValue: value, unit };
}
async function chunkedCreateMany<T>(rows: T[], fn: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await fn(rows.slice(i, i + CHUNK));
  }
}

const MANUFACTURERS = ["Mettler Toledo", "Ohaus", "Fluke", "Vaisala", "Fisherbrand", "Sartorius"];
const PROCEDURE_RENDERERS = ["weight-set", "temp-rh-meter", "weathering-tester"] as const;

async function main() {
  const [pacificBio, coastline] = await prisma.customer.findMany({ orderBy: { createdAt: "asc" }, take: 2 });
  if (!pacificBio || !coastline) {
    throw new Error("Run `npm run seed` first — bulk seed extends the base demo data, it doesn't create customers/procedures from scratch.");
  }
  const sites = await prisma.customerSite.findMany({ where: { customerId: { in: [pacificBio.id, coastline.id] } } });
  const procedures = await prisma.procedure.findMany({ where: { rendererKey: { in: [...PROCEDURE_RENDERERS] } } });
  const proceduresByRenderer = new Map(procedures.map((p) => [p.rendererKey, p]));
  const [techJordan, techTaylor] = await prisma.user.findMany({ where: { role: { name: "TECHNICIAN" } }, take: 2 });
  const manager = await prisma.user.findFirst({ where: { role: { name: "MANAGER" } } });
  if (!manager || !techJordan || !techTaylor) throw new Error("Run `npm run seed` first.");

  console.log(`Generating ${COUNT} synthetic assets-visits across ${sites.length} sites…`);

  // 50 synthetic assets spread across the existing sites, cycling procedure
  // families — recurring equipment, exactly like a real customer base.
  const ASSET_COUNT = 50;
  const assetRows = Array.from({ length: ASSET_COUNT }).map((_, i) => {
    const site = sites[i % sites.length];
    const rendererKey = PROCEDURE_RENDERERS[i % PROCEDURE_RENDERERS.length];
    const procedure = proceduresByRenderer.get(rendererKey)!;
    const interval = [3, 6, 12, 24][i % 4];
    return {
      id: crypto.randomUUID(),
      customerId: site.customerId,
      siteId: site.id,
      assetNumber: `BULK-${String(i + 1).padStart(4, "0")}`,
      description: `${rendererKey === "weight-set" ? "Precision Balance" : rendererKey === "temp-rh-meter" ? "Temp/RH Chamber" : "Weathering Unit"} ${i + 1}`,
      manufacturer: MANUFACTURERS[i % MANUFACTURERS.length],
      model: `MDL-${1000 + i}`,
      serialNumber: `SN-${100000 + i}`,
      accuracy: "±0.1%",
      range: "0-1000",
      calibrationIntervalMonths: interval,
      defaultProcedureId: procedure.id,
      rendererKey,
    };
  });
  await prisma.equipmentAsset.createMany({
    data: assetRows.map(({ rendererKey: _rendererKey, ...a }) => a),
    skipDuplicates: true,
  });

  const workOrderBySite = new Map<string, string>();
  for (const site of sites) {
    const id = crypto.randomUUID();
    workOrderBySite.set(site.id, id);
  }
  await prisma.workOrder.createMany({
    data: sites.map((s) => ({ id: workOrderBySite.get(s.id)!, customerId: s.customerId, siteId: s.id, scheduledDate: new Date(), createdByUserId: manager.id })),
  });

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const taskRows: { id: string; workOrderId: string; assetId: string; procedureId: string; assignedTechnicianId: string; scheduledDate: Date }[] = [];
  const recordRows: {
    id: string;
    taskId: string;
    assetId: string;
    procedureId: string;
    technicianId: string;
    status: WorkflowState;
    finalStatus: FinalStatus;
    calibrationLocation: string;
    comments: string;
    submittedAt: Date;
    approvedAt: Date;
    releasedAt: Date;
    createdAt: Date;
  }[] = [];
  const sectionRows: { id: string; calibrationRecordId: string; name: string; sortOrder: number }[] = [];
  const groupRows: { id: string; sectionId: string; name: string; sortOrder: number }[] = [];
  const pointRows: { id: string; groupId: string; sortOrder: number; rowLabel: string; values: unknown }[] = [];
  const approvalRows: { id: string; calibrationRecordId: string; approvedByUserId: string; approvedAt: Date; notes: string }[] = [];

  const assetMaxDate = new Map<string, Date>();

  for (let i = 0; i < COUNT; i++) {
    const asset = assetRows[i % ASSET_COUNT];
    const technicianId = i % 2 === 0 ? techJordan.id : techTaylor.id;
    // Spread visits over the last ~3 years, oldest first, so pagination sees
    // a realistic mix of dates and "next due" spans past/future.
    const daysAgo = Math.floor((COUNT - i) * (3 * 365) / COUNT) + (i % 7);
    const calibrationDate = new Date(now - daysAgo * DAY);
    const approvedAt = new Date(calibrationDate.getTime() + DAY);
    const releasedAt = new Date(approvedAt.getTime() + DAY);
    const finalStatus: FinalStatus = i % 20 === 0 ? "FAIL" : "PASS";

    const taskId = crypto.randomUUID();
    const recordId = crypto.randomUUID();
    taskRows.push({
      id: taskId,
      workOrderId: workOrderBySite.get(asset.siteId)!,
      assetId: asset.id,
      procedureId: asset.defaultProcedureId,
      assignedTechnicianId: technicianId,
      scheduledDate: calibrationDate,
    });
    recordRows.push({
      id: recordId,
      taskId,
      assetId: asset.id,
      procedureId: asset.defaultProcedureId,
      technicianId,
      status: "RELEASED",
      finalStatus,
      calibrationLocation: "Customer site — field calibration",
      comments: "Bulk historical import (seed:bulk) for scale testing.",
      submittedAt: calibrationDate,
      approvedAt,
      releasedAt,
      createdAt: calibrationDate,
    });

    const sectionId = crypto.randomUUID();
    sectionRows.push({ id: sectionId, calibrationRecordId: recordId, name: "Calibration Data", sortOrder: 0 });
    const groupId = crypto.randomUUID();
    groupRows.push({ id: groupId, sectionId, name: "Readings", sortOrder: 0 });
    const targets = ["10", "50", "100"];
    for (const [pi, target] of targets.entries()) {
      const asFound = (Number(target) + (finalStatus === "FAIL" ? 0.9 : 0.01)).toFixed(4);
      pointRows.push({
        id: crypto.randomUUID(),
        groupId,
        sortOrder: pi,
        rowLabel: target,
        values: {
          targetValue: cell(target, "g"),
          unit: "g",
          standardAsFound: cell(target),
          asFound: cell(asFound),
          deviationAsFound: cell((Number(asFound) - Number(target)).toFixed(4)),
          calTolerance: "±0.05",
        },
      });
    }

    approvalRows.push({ id: crypto.randomUUID(), calibrationRecordId: recordId, approvedByUserId: manager.id, approvedAt, notes: "Bulk-approved for scale testing." });

    const currentMax = assetMaxDate.get(asset.id);
    if (!currentMax || calibrationDate > currentMax) assetMaxDate.set(asset.id, calibrationDate);

    if ((i + 1) % 1000 === 0) console.log(`  built ${i + 1}/${COUNT} in memory…`);
  }

  console.log("Writing tasks…");
  await chunkedCreateMany(taskRows, (b) => prisma.calibrationTask.createMany({ data: b }));
  console.log("Writing calibration records…");
  await chunkedCreateMany(recordRows, (b) => prisma.calibrationRecord.createMany({ data: b }));
  console.log("Writing measurement sections/groups/points…");
  await chunkedCreateMany(sectionRows, (b) => prisma.measurementSection.createMany({ data: b }));
  await chunkedCreateMany(groupRows, (b) => prisma.measurementGroup.createMany({ data: b }));
  await chunkedCreateMany(pointRows, (b) => prisma.measurementPoint.createMany({ data: b as never }));
  console.log("Writing approvals…");
  await chunkedCreateMany(approvalRows, (b) => prisma.approval.createMany({ data: b }));

  console.log("Backfilling asset last-calibrated / next-due dates…");
  const assetUpdates = Array.from(assetMaxDate.entries()).map(([assetId, maxDate]) => {
    const asset = assetRows.find((a) => a.id === assetId)!;
    return prisma.equipmentAsset.update({
      where: { id: assetId },
      data: { lastCalibratedAt: maxDate, nextCalibrationDueAt: addMonths(maxDate, asset.calibrationIntervalMonths) },
    });
  });
  await prisma.$transaction(assetUpdates);

  await prisma.auditEvent.create({
    data: {
      userId: manager.id,
      eventType: "BULK_IMPORT",
      entityType: "CalibrationRecord",
      summary: `Bulk-imported ${COUNT} historical calibration records for scale testing (seed:bulk)`,
      detailsJson: { count: COUNT },
    },
  });

  console.log(`Done. Inserted ${COUNT} calibration records across ${ASSET_COUNT} assets.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
