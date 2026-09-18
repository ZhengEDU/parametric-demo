import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { assertTransition } from "./workflowStateMachine";
import { runDecisionRule } from "./decisionRules";
import { NotFoundError, ForbiddenError, ValidationError } from "../lib/errors";
import { isValidDecimalString, subtractDecimalStrings } from "../lib/precision";
import { addMonths } from "../lib/dates";
import { COL } from "./measurementColumnKeys";
import type { AuthedUser } from "../auth/middleware";

function cellString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v.trim() === "" ? undefined : v;
  if (typeof v === "object" && "displayValue" in (v as Record<string, unknown>)) {
    const dv = (v as { displayValue?: unknown }).displayValue;
    return typeof dv === "string" && dv.trim() !== "" ? dv : undefined;
  }
  return undefined;
}

/**
 * Two guarantees on every saved measurement point, matched against the 7
 * real certificates in samples/word-documents/ before writing this (see
 * docs/ASSUMPTIONS.md, "Calculation / decision rules"):
 *
 * 1. Standard/As-Found/As-Left readings must be syntactically valid
 *    decimal numbers — reject garbage, don't persist it.
 * 2. Deviation is ALWAYS server-derived from Standard and the reading
 *    (DEMO-CALC-1, `deviation = reading − standard`) — never trusted
 *    from client input, so it can never drift from what was actually
 *    typed into Standard/As Found/As Left.
 *
 * Deliberately NOT enforced: that Standard and the reading share the
 * same decimal scale. Real certs show the reference standard commonly
 * read to more decimal places than the DUT (e.g. a real CO2 incubator
 * cert: standard "4.859", reading "5.0") — that's normal (the reference
 * has finer resolution than the unit under test), not a data-entry
 * error, so a same-scale rule would reject legitimate readings.
 */
export function validatePointValues(pointId: string, values: Record<string, unknown>): Record<string, unknown> {
  const out = { ...values };
  const checkPair = (standardKey: string, readingKey: string, deviationKey: string) => {
    const standard = cellString(out[standardKey]);
    const reading = cellString(out[readingKey]);
    if (standard == null || reading == null) return;
    for (const [key, val] of [[standardKey, standard], [readingKey, reading]] as const) {
      if (!isValidDecimalString(val)) {
        throw new ValidationError(`Point ${pointId}: "${key}" (${JSON.stringify(val)}) is not a valid decimal number.`);
      }
    }
    out[deviationKey] = subtractDecimalStrings(reading, standard);
  };
  checkPair(COL.STANDARD_AS_FOUND, COL.AS_FOUND, COL.DEVIATION_AS_FOUND);
  checkPair(COL.STANDARD_AS_LEFT, COL.AS_LEFT, COL.DEVIATION_AS_LEFT);
  return out;
}

export interface DraftPointUpdate {
  pointId: string;
  values: Record<string, unknown>;
}
export interface DraftEnvironmentalUpdate {
  id: string;
  numericValue?: string | null;
  displayScale?: number;
  displayValue?: string | null;
  asFoundStatus?: string | null;
  asLeftStatus?: string | null;
  finalStatus?: string | null;
}
export interface DraftChecklistUpdate {
  itemId: string;
  result?: string | null;
  notes?: string | null;
}
export interface SaveDraftInput {
  comments?: string;
  calibrationLocation?: string;
  purposeOfVisit?: string;
  serviceRequested?: string;
  standardIds?: string[];
  points?: DraftPointUpdate[];
  environmental?: DraftEnvironmentalUpdate[];
  checklistItems?: DraftChecklistUpdate[];
}

async function loadRecordOr404(recordId: string) {
  const record = await prisma.calibrationRecord.findUnique({
    where: { id: recordId },
    include: { measurementSections: { include: { groups: { include: { points: true } } } } },
  });
  if (!record) throw new NotFoundError("CalibrationRecord");
  return record;
}

export async function saveDraft(recordId: string, user: AuthedUser, input: SaveDraftInput) {
  const record = await loadRecordOr404(recordId);
  if (record.technicianId !== user.id && user.role !== "DOCUMENTATION" && user.role !== "ADMIN") {
    throw new ForbiddenError("Only the assigned technician (or documentation staff, for legacy entry) can edit this record");
  }
  if (record.status !== "DRAFT" && record.status !== "RETURNED_FOR_CORRECTION") {
    throw new ValidationError(`Cannot edit a record in status ${record.status}`);
  }

  await prisma.$transaction(async (tx) => {
    if (input.comments !== undefined) {
      await tx.calibrationRecord.update({ where: { id: recordId }, data: { comments: input.comments } });
    }
    if (input.calibrationLocation !== undefined) {
      await tx.calibrationRecord.update({ where: { id: recordId }, data: { calibrationLocation: input.calibrationLocation } });
    }
    if (input.purposeOfVisit !== undefined) {
      await tx.calibrationRecord.update({ where: { id: recordId }, data: { purposeOfVisit: input.purposeOfVisit } });
    }
    if (input.serviceRequested !== undefined) {
      await tx.calibrationRecord.update({ where: { id: recordId }, data: { serviceRequested: input.serviceRequested } });
    }
    if (input.standardIds) {
      await tx.calibrationStandardUsage.deleteMany({ where: { calibrationRecordId: recordId } });
      await tx.calibrationStandardUsage.createMany({
        data: input.standardIds.map((standardId, i) => ({ calibrationRecordId: recordId, standardId, sortOrder: i })),
      });
    }
    for (const p of input.points ?? []) {
      const values = validatePointValues(p.pointId, p.values);
      await tx.measurementPoint.update({ where: { id: p.pointId }, data: { values: values as never } });
    }
    for (const e of input.environmental ?? []) {
      await tx.environmentalObservation.update({
        where: { id: e.id },
        data: {
          numericValue: e.numericValue === undefined ? undefined : e.numericValue === null ? null : e.numericValue,
          displayScale: e.displayScale,
          displayValue: e.displayValue === undefined ? undefined : e.displayValue,
          asFoundStatus: (e.asFoundStatus as never) ?? undefined,
          asLeftStatus: (e.asLeftStatus as never) ?? undefined,
          finalStatus: (e.finalStatus as never) ?? undefined,
        },
      });
    }
    for (const c of input.checklistItems ?? []) {
      await tx.pMChecklistItem.update({
        where: { id: c.itemId },
        data: { result: (c.result as never) ?? null, notes: c.notes ?? null },
      });
    }
    await recordAuditEvent(tx, {
      userId: user.id,
      eventType: "DRAFT_SAVED",
      entityType: "CalibrationRecord",
      entityId: recordId,
      summary: `${user.fullName} saved a draft`,
    });
  });

  return loadRecordOr404(recordId);
}

function assertEditable(record: { technicianId: string; status: string }, user: AuthedUser) {
  if (record.technicianId !== user.id && user.role !== "DOCUMENTATION" && user.role !== "ADMIN") {
    throw new ForbiddenError("Only the assigned technician (or documentation staff, for legacy entry) can edit this record");
  }
  if (record.status !== "DRAFT" && record.status !== "RETURNED_FOR_CORRECTION") {
    throw new ValidationError(`Cannot edit a record in status ${record.status}`);
  }
}

export async function addMeasurementPoint(recordId: string, user: AuthedUser, groupId: string, rowLabel: string | undefined) {
  const record = await prisma.calibrationRecord.findUniqueOrThrow({ where: { id: recordId } });
  assertEditable(record, user);
  const group = await prisma.measurementGroup.findUnique({
    where: { id: groupId },
    include: { section: true, points: { select: { sortOrder: true } } },
  });
  if (!group || group.section.calibrationRecordId !== recordId) throw new NotFoundError("MeasurementGroup");
  const sortOrder = group.points.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1;
  await prisma.measurementPoint.create({
    data: { groupId, sortOrder, rowLabel: rowLabel?.trim() || `Point ${sortOrder + 1}`, values: {} },
  });
  return loadRecordOr404(recordId);
}

export async function removeMeasurementPoint(recordId: string, user: AuthedUser, pointId: string) {
  const record = await prisma.calibrationRecord.findUniqueOrThrow({ where: { id: recordId } });
  assertEditable(record, user);
  const point = await prisma.measurementPoint.findUnique({
    where: { id: pointId },
    include: { group: { include: { section: true } } },
  });
  if (!point || point.group.section.calibrationRecordId !== recordId) throw new NotFoundError("MeasurementPoint");
  await prisma.measurementPoint.delete({ where: { id: pointId } });
  return loadRecordOr404(recordId);
}

export async function addChecklistItem(recordId: string, user: AuthedUser, sectionId: string, label: string) {
  const record = await prisma.calibrationRecord.findUniqueOrThrow({ where: { id: recordId } });
  assertEditable(record, user);
  const section = await prisma.pMChecklistSection.findUnique({
    where: { id: sectionId },
    include: { items: { select: { sortOrder: true } } },
  });
  if (!section || section.calibrationRecordId !== recordId) throw new NotFoundError("PMChecklistSection");
  if (!label.trim()) throw new ValidationError("Checklist item label is required");
  const sortOrder = section.items.reduce((max, i) => Math.max(max, i.sortOrder), -1) + 1;
  await prisma.pMChecklistItem.create({ data: { sectionId, sortOrder, label: label.trim() } });
  return loadRecordOr404(recordId);
}

export async function removeChecklistItem(recordId: string, user: AuthedUser, itemId: string) {
  const record = await prisma.calibrationRecord.findUniqueOrThrow({ where: { id: recordId } });
  assertEditable(record, user);
  const item = await prisma.pMChecklistItem.findUnique({ where: { id: itemId }, include: { section: true } });
  if (!item || item.section.calibrationRecordId !== recordId) throw new NotFoundError("PMChecklistItem");
  await prisma.pMChecklistItem.delete({ where: { id: itemId } });
  return loadRecordOr404(recordId);
}

async function computeAndApplyDecisionRule(tx: typeof prisma, recordId: string) {
  const record = await tx.calibrationRecord.findUniqueOrThrow({
    where: { id: recordId },
    include: {
      procedure: true,
      measurementSections: { include: { groups: { include: { points: true } } } },
    },
  });
  if (record.procedure.documentFamily !== "CALIBRATION_CERTIFICATE") return;
  const points = record.measurementSections.flatMap((s) => s.groups.flatMap((g) => g.points));
  const decision = runDecisionRule(record.procedure.decisionRuleRevision, points as never);
  await tx.calibrationRecord.update({
    where: { id: recordId },
    data: {
      asFoundStatus: decision.asFoundStatus,
      asLeftStatus: decision.asLeftStatus,
      adjustmentMade: decision.adjustmentMade,
      finalStatus: decision.finalStatus,
    },
  });
}

/** Submits a DRAFT, or resubmits a RETURNED_FOR_CORRECTION record — the
 * action taken is derived from current state, never chosen by the client
 * (Section 14: no arbitrary status dropdown). */
export async function submitRecord(recordId: string, user: AuthedUser) {
  const record = await loadRecordOr404(recordId);
  if (record.technicianId !== user.id && user.role !== "DOCUMENTATION" && user.role !== "ADMIN") {
    throw new ForbiddenError("Only the assigned technician (or documentation staff) can submit this record");
  }
  const isResubmit = record.status === "RETURNED_FOR_CORRECTION";
  const action = isResubmit ? "RESUBMIT" : "SUBMIT";
  const toState = assertTransition(record.status, action);

  await prisma.$transaction(async (tx) => {
    await computeAndApplyDecisionRule(tx as never, recordId);

    if (isResubmit) {
      const pendingCorrections = await tx.correction.findMany({ where: { calibrationRecordId: recordId, status: "PENDING" } });
      for (const c of pendingCorrections) {
        const [kind, ref] = c.fieldRef.split(":");
        let newValue: unknown = null;
        if (kind === "point") {
          const point = await tx.measurementPoint.findUnique({ where: { id: ref } });
          newValue = point?.values ?? null;
        } else if (kind === "environmental") {
          const env = await tx.environmentalObservation.findUnique({ where: { id: ref } });
          newValue = env?.displayValue ?? null;
        } else if (kind === "record") {
          const rec = await tx.calibrationRecord.findUnique({ where: { id: recordId } });
          newValue = rec ? (rec as never as Record<string, unknown>)[ref] : null;
        }
        await tx.correction.update({
          where: { id: c.id },
          data: { correctedValueJson: newValue as never, correctedByUserId: user.id, correctedAt: new Date(), status: "RESOLVED" },
        });
      }
    }

    const revisionNumber = record.currentRevisionNumber + 1;
    const snapshot = await tx.calibrationRecord.findUniqueOrThrow({
      where: { id: recordId },
      include: {
        measurementSections: { include: { groups: { include: { points: true } } } },
        environmentalObservations: true,
        pmChecklistSections: { include: { items: true } },
      },
    });
    await tx.calibrationRecordRevision.create({
      data: {
        calibrationRecordId: recordId,
        revisionNumber,
        action: isResubmit ? "RESUBMITTED" : "SUBMITTED",
        snapshotJson: snapshot as never,
        createdByUserId: user.id,
      },
    });
    await tx.calibrationRecord.update({
      where: { id: recordId },
      data: { status: toState, currentRevisionNumber: revisionNumber, submittedAt: new Date() },
    });
    await recordAuditEvent(tx, {
      userId: user.id,
      eventType: isResubmit ? "RESUBMITTED" : "SUBMITTED",
      entityType: "CalibrationRecord",
      entityId: recordId,
      summary: `${user.fullName} ${isResubmit ? "resubmitted" : "submitted"} the calibration record (revision ${revisionNumber})`,
    });
  });

  return loadRecordOr404(recordId);
}

export async function openForReview(recordId: string, user: AuthedUser) {
  const record = await prisma.calibrationRecord.findUniqueOrThrow({ where: { id: recordId } });
  const toState = assertTransition(record.status, "OPEN_FOR_REVIEW");
  if (toState !== record.status) {
    await prisma.$transaction(async (tx) => {
      await tx.calibrationRecord.update({ where: { id: recordId }, data: { status: toState } });
      await recordAuditEvent(tx, {
        userId: user.id,
        eventType: "OPENED_FOR_REVIEW",
        entityType: "CalibrationRecord",
        entityId: recordId,
        summary: `${user.fullName} opened the record for review`,
      });
    });
  }
  return prisma.calibrationRecord.findUniqueOrThrow({ where: { id: recordId } });
}

export interface FlaggedField {
  fieldRef: string; // e.g. "point:<id>", "environmental:<id>", "record:comments"
  label: string;
  reason: string;
}

export async function returnForCorrection(recordId: string, manager: AuthedUser, comments: string | undefined, flagged: FlaggedField[]) {
  if (flagged.length === 0) throw new ValidationError("At least one field must be flagged to return a record for correction");
  const record = await prisma.calibrationRecord.findUniqueOrThrow({ where: { id: recordId } });
  const toState = assertTransition(record.status, "RETURN_FOR_CORRECTION");

  await prisma.$transaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        calibrationRecordId: recordId,
        reviewerUserId: manager.id,
        action: "RETURNED_FOR_CORRECTION",
        comments,
        flaggedFields: flagged as never,
      },
    });
    for (const f of flagged) {
      const [kind, ref] = f.fieldRef.split(":");
      let originalValue: unknown = null;
      if (kind === "point") {
        originalValue = (await tx.measurementPoint.findUnique({ where: { id: ref } }))?.values ?? null;
      } else if (kind === "environmental") {
        originalValue = (await tx.environmentalObservation.findUnique({ where: { id: ref } }))?.displayValue ?? null;
      } else if (kind === "record") {
        const rec = await tx.calibrationRecord.findUnique({ where: { id: recordId } });
        originalValue = rec ? (rec as never as Record<string, unknown>)[f.fieldRef.split(":")[1]] : null;
      }
      await tx.correction.create({
        data: {
          calibrationRecordId: recordId,
          reviewId: review.id,
          fieldRef: f.fieldRef,
          fieldLabel: f.label,
          originalValueJson: originalValue as never,
          reason: f.reason,
          status: "PENDING",
        },
      });
    }
    await tx.calibrationRecord.update({ where: { id: recordId }, data: { status: toState } });
    await recordAuditEvent(tx, {
      userId: manager.id,
      eventType: "RETURNED_FOR_CORRECTION",
      entityType: "CalibrationRecord",
      entityId: recordId,
      summary: `${manager.fullName} returned the record for correction (${flagged.length} field(s) flagged)`,
      details: { flagged },
    });
  });

  return prisma.calibrationRecord.findUniqueOrThrow({ where: { id: recordId } });
}

export async function approveRecord(recordId: string, manager: AuthedUser, comments: string | undefined) {
  const record = await prisma.calibrationRecord.findUniqueOrThrow({ where: { id: recordId }, include: { asset: true } });
  if (record.technicianId === manager.id) {
    throw new ForbiddenError("A technician cannot approve their own calibration record");
  }
  const toState = assertTransition(record.status, "APPROVE");
  // The calibration date is the date the work was actually performed, same
  // definition used for the printed certificate (documentGeneration.ts).
  const calibrationDate = record.submittedAt ?? record.createdAt;
  const nextDue = addMonths(calibrationDate, record.asset.calibrationIntervalMonths);

  await prisma.$transaction(async (tx) => {
    await tx.review.create({
      data: { calibrationRecordId: recordId, reviewerUserId: manager.id, action: "APPROVED", comments },
    });
    await tx.approval.create({
      data: { calibrationRecordId: recordId, approvedByUserId: manager.id, notes: comments },
    });
    await tx.calibrationRecord.update({ where: { id: recordId }, data: { status: toState, approvedAt: new Date() } });
    // Guard against an out-of-order approval (e.g. an older resubmission
    // approved after a newer one) regressing the asset's due date.
    if (!record.asset.lastCalibratedAt || calibrationDate >= record.asset.lastCalibratedAt) {
      await tx.equipmentAsset.update({
        where: { id: record.assetId },
        data: { lastCalibratedAt: calibrationDate, nextCalibrationDueAt: nextDue },
      });
    }
    await recordAuditEvent(tx, {
      userId: manager.id,
      eventType: "APPROVED",
      entityType: "CalibrationRecord",
      entityId: recordId,
      summary: `${manager.fullName} approved the calibration record`,
    });
  });

  return prisma.calibrationRecord.findUniqueOrThrow({ where: { id: recordId } });
}

export async function releaseRecord(recordId: string, user: AuthedUser) {
  const record = await prisma.calibrationRecord.findUniqueOrThrow({ where: { id: recordId } });
  const toState = assertTransition(record.status, "RELEASE");
  await prisma.$transaction(async (tx) => {
    await tx.calibrationRecord.update({ where: { id: recordId }, data: { status: toState, releasedAt: new Date() } });
    await recordAuditEvent(tx, {
      userId: user.id,
      eventType: "RELEASED",
      entityType: "CalibrationRecord",
      entityId: recordId,
      summary: `${user.fullName} released the record`,
    });
  });
  return prisma.calibrationRecord.findUniqueOrThrow({ where: { id: recordId } });
}
