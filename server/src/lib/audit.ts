import type { Prisma, PrismaClient } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

export interface AuditInput {
  userId: string | null;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  details?: Record<string, unknown> | null;
}

/**
 * Appends one AuditEvent row. Called from inside the same transaction as
 * the state-changing write it documents, so the audit record and the
 * business change succeed or fail together. The AuditEvent table itself
 * is append-only at the database level (see prisma/migrations/*_audit_append_only)
 * — there is intentionally no updateAuditEvent/deleteAuditEvent helper.
 */
export async function recordAuditEvent(tx: Tx, input: AuditInput) {
  await tx.auditEvent.create({
    data: {
      userId: input.userId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      detailsJson: (input.details as Prisma.InputJsonValue | undefined) ?? PrismaRuntime.JsonNull,
    },
  });
}
