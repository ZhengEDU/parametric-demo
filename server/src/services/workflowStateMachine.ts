import { WorkflowState } from "@prisma/client";
import { ConflictError } from "../lib/errors";

/**
 * Explicit workflow actions and the state transitions they're allowed to
 * make (Section 14). There is intentionally no generic "set status"
 * endpoint anywhere in the API — every route that changes
 * CalibrationRecord.status names one of these actions and calls
 * assertTransition() before writing.
 */
export type WorkflowAction =
  | "SAVE_DRAFT"
  | "SUBMIT"
  | "RETURN_FOR_CORRECTION"
  | "RESUBMIT"
  | "OPEN_FOR_REVIEW"
  | "APPROVE"
  | "GENERATE_DOCUMENT"
  | "SYNC_TO_CALIBRATION_CONTROL"
  | "MARK_READY_FOR_RELEASE"
  | "RELEASE";

const TRANSITIONS: Record<WorkflowAction, { from: WorkflowState[]; to: WorkflowState }> = {
  SAVE_DRAFT: { from: [WorkflowState.DRAFT, WorkflowState.RETURNED_FOR_CORRECTION], to: WorkflowState.DRAFT },
  SUBMIT: { from: [WorkflowState.DRAFT], to: WorkflowState.SUBMITTED },
  OPEN_FOR_REVIEW: {
    from: [WorkflowState.SUBMITTED, WorkflowState.RESUBMITTED, WorkflowState.UNDER_REVIEW],
    to: WorkflowState.UNDER_REVIEW,
  },
  RETURN_FOR_CORRECTION: { from: [WorkflowState.UNDER_REVIEW], to: WorkflowState.RETURNED_FOR_CORRECTION },
  RESUBMIT: { from: [WorkflowState.RETURNED_FOR_CORRECTION], to: WorkflowState.RESUBMITTED },
  APPROVE: { from: [WorkflowState.UNDER_REVIEW], to: WorkflowState.APPROVED },
  GENERATE_DOCUMENT: {
    from: [WorkflowState.APPROVED, WorkflowState.DOCUMENT_GENERATED],
    to: WorkflowState.DOCUMENT_GENERATED,
  },
  SYNC_TO_CALIBRATION_CONTROL: {
    from: [WorkflowState.DOCUMENT_GENERATED, WorkflowState.SYNCED_TO_CALIBRATION_CONTROL],
    to: WorkflowState.SYNCED_TO_CALIBRATION_CONTROL,
  },
  MARK_READY_FOR_RELEASE: { from: [WorkflowState.SYNCED_TO_CALIBRATION_CONTROL], to: WorkflowState.READY_FOR_RELEASE },
  RELEASE: { from: [WorkflowState.READY_FOR_RELEASE], to: WorkflowState.RELEASED },
};

export function assertTransition(current: WorkflowState, action: WorkflowAction): WorkflowState {
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(current)) {
    throw new ConflictError(
      `Cannot ${action} a calibration record in state ${current}. Allowed from: ${rule.from.join(", ")}.`
    );
  }
  return rule.to;
}
