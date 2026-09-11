import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { assertTransition } from "./workflowStateMachine";
import { calibrationControlAdapter, type SyncPayload } from "./calibrationControlAdapter";
import { NotFoundError, ValidationError } from "../lib/errors";
import type { AuthedUser } from "../auth/middleware";

/**
 * Approved-only, deterministic sync (Section 17/42 self-review: sync can
 * never happen before DOCUMENT_GENERATED, i.e. never before APPROVED).
 * The workflow state machine enforces the ordering; this function additionally
 * requires a GeneratedDocument to exist so the sync payload can reference
 * its hash even if that weren't already implied by the state machine.
 */
export async function triggerCalibrationControlSync(recordId: string, user: AuthedUser) {
  const record = await prisma.calibrationRecord.findUnique({
    where: { id: recordId },
    include: {
      asset: true,
      procedure: true,
      technician: true,
      approval: { include: { approvedBy: true } },
      generatedDocuments: { orderBy: { generatedAt: "desc" }, take: 1 },
    },
  });
  if (!record) throw new NotFoundError("CalibrationRecord");
  if (!record.approval) throw new ValidationError("Cannot sync a record that has not been approved");
  const latestDoc = record.generatedDocuments[0];
  if (!latestDoc) throw new ValidationError("Cannot sync a record with no generated document");

  const toState = assertTransition(record.status, "SYNC_TO_CALIBRATION_CONTROL");

  const payload: SyncPayload = {
    calibrationRecordId: record.id,
    assetNumber: record.asset.assetNumber,
    ccAssetId: record.asset.ccAssetId,
    procedureName: record.procedure.name,
    technicianName: record.technician ? await technicianName(record.technicianId) : "",
    approvedByName: record.approval.approvedBy.fullName,
    approvedAt: record.approval.approvedAt.toISOString(),
    finalStatus: record.finalStatus,
    generatedDocumentSha256: latestDoc.sha256,
    generatedDocumentFilename: latestDoc.filename,
  };

  const queued = await prisma.$transaction(async (tx) => {
    const sync = await tx.calibrationControlSync.create({
      data: {
        calibrationRecordId: record.id,
        assetId: record.assetId,
        status: "QUEUED",
        payloadJson: payload as never,
      },
    });
    await recordAuditEvent(tx, {
      userId: user.id,
      eventType: "CALIBRATION_CONTROL_SYNC_QUEUED",
      entityType: "CalibrationRecord",
      entityId: record.id,
      summary: `${user.fullName} queued a Calibration Control sync`,
    });
    return sync;
  });

  await prisma.calibrationControlSync.update({ where: { id: queued.id }, data: { status: "SYNCING" } });

  let result;
  try {
    result = await calibrationControlAdapter.createCalibrationRecord(payload);
  } catch (err) {
    result = { success: false, failureMessage: err instanceof Error ? err.message : String(err) };
  }

  await prisma.$transaction(async (tx) => {
    if (result.success) {
      await tx.calibrationControlSync.update({
        where: { id: queued.id },
        data: { status: "SUCCESS", ccRecordId: result.ccRecordId, syncedAt: new Date() },
      });
      await tx.calibrationRecord.update({ where: { id: recordId }, data: { status: toState } });
      await recordAuditEvent(tx, {
        userId: user.id,
        eventType: "CALIBRATION_CONTROL_SYNC_SUCCESS",
        entityType: "CalibrationRecord",
        entityId: record.id,
        summary: `Calibration Control sync succeeded: ${result.ccRecordId}`,
        details: { ccRecordId: result.ccRecordId },
      });
      // Auto-advance to READY_FOR_RELEASE — a successful sync is the last
      // automated gate before a human releases the record.
      const readyState = assertTransition(toState, "MARK_READY_FOR_RELEASE");
      await tx.calibrationRecord.update({ where: { id: recordId }, data: { status: readyState } });
      await recordAuditEvent(tx, {
        userId: user.id,
        eventType: "READY_FOR_RELEASE",
        entityType: "CalibrationRecord",
        entityId: record.id,
        summary: "Record marked ready for release",
      });
    } else {
      await tx.calibrationControlSync.update({
        where: { id: queued.id },
        data: { status: "FAILED", failureMessage: result.failureMessage },
      });
      await recordAuditEvent(tx, {
        userId: user.id,
        eventType: "CALIBRATION_CONTROL_SYNC_FAILED",
        entityType: "CalibrationRecord",
        entityId: record.id,
        summary: `Calibration Control sync failed: ${result.failureMessage}`,
      });
    }
  });

  return prisma.calibrationControlSync.findUniqueOrThrow({ where: { id: queued.id } });
}

async function technicianName(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  return u?.fullName ?? "";
}
