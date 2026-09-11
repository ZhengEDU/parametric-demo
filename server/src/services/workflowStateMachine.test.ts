import { WorkflowState } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { assertTransition } from "./workflowStateMachine";

describe("workflowStateMachine", () => {
  it("allows the full happy-path sequence", () => {
    expect(assertTransition(WorkflowState.DRAFT, "SUBMIT")).toBe(WorkflowState.SUBMITTED);
    expect(assertTransition(WorkflowState.SUBMITTED, "OPEN_FOR_REVIEW")).toBe(WorkflowState.UNDER_REVIEW);
    expect(assertTransition(WorkflowState.UNDER_REVIEW, "APPROVE")).toBe(WorkflowState.APPROVED);
    expect(assertTransition(WorkflowState.APPROVED, "GENERATE_DOCUMENT")).toBe(WorkflowState.DOCUMENT_GENERATED);
    expect(assertTransition(WorkflowState.DOCUMENT_GENERATED, "SYNC_TO_CALIBRATION_CONTROL")).toBe(WorkflowState.SYNCED_TO_CALIBRATION_CONTROL);
    expect(assertTransition(WorkflowState.SYNCED_TO_CALIBRATION_CONTROL, "MARK_READY_FOR_RELEASE")).toBe(WorkflowState.READY_FOR_RELEASE);
    expect(assertTransition(WorkflowState.READY_FOR_RELEASE, "RELEASE")).toBe(WorkflowState.RELEASED);
  });

  it("allows the correction loop", () => {
    expect(assertTransition(WorkflowState.UNDER_REVIEW, "RETURN_FOR_CORRECTION")).toBe(WorkflowState.RETURNED_FOR_CORRECTION);
    expect(assertTransition(WorkflowState.RETURNED_FOR_CORRECTION, "RESUBMIT")).toBe(WorkflowState.RESUBMITTED);
    expect(assertTransition(WorkflowState.RESUBMITTED, "OPEN_FOR_REVIEW")).toBe(WorkflowState.UNDER_REVIEW);
  });

  it("rejects a technician approving straight from DRAFT (skipping review)", () => {
    expect(() => assertTransition(WorkflowState.DRAFT, "APPROVE")).toThrow(/Cannot APPROVE/);
  });

  it("rejects syncing before a document has been generated", () => {
    expect(() => assertTransition(WorkflowState.APPROVED, "SYNC_TO_CALIBRATION_CONTROL")).toThrow();
  });
});
