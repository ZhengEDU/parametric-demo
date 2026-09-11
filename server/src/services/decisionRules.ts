import { ConditionStatus, FinalStatus } from "@prisma/client";
import { magnitudeExceeds } from "../lib/precision";
import { COL } from "./measurementColumnKeys";

/**
 * DEMO DECISION RULES — no written spec was ever provided, so these stay
 * labeled DEMO, but the out-of-tolerance-if-|deviation|>tolerance logic
 * matches Parametric's own printed boilerplate on every real certificate
 * ("Decision Rule of Simple Acceptance ... reporting the acceptance
 * limit equal to the tolerance limit", ILAC G8) — the separate
 * Uncertainty column is reported but not folded into the decision. See
 * "Calculation / decision rules" in docs/ASSUMPTIONS.md.
 *
 * Section 22: As-Found status, As-Left status, Adjustment Made, and Final
 * Status are modeled as separate concepts, never collapsed into one
 * boolean. Each Procedure names one of these rules via
 * `decisionRuleRevision`; the UI always labels output with that tag.
 */

export interface PointLike {
  values: Record<string, { displayValue?: string } | string | undefined>;
}

export interface DecisionResult {
  asFoundStatus: ConditionStatus | null;
  asLeftStatus: ConditionStatus | null;
  adjustmentMade: boolean | null;
  finalStatus: FinalStatus | null;
}

function cellText(point: PointLike, key: string): string | undefined {
  const cell = point.values[key];
  if (cell == null) return undefined;
  if (typeof cell === "string") return cell;
  return cell.displayValue;
}

/**
 * For procedures with a full As-Found / As-Left / Adjustment table
 * (Weight Set, Temp/RH Meter): out-of-tolerance if ANY point's deviation
 * exceeds that point's own tolerance magnitude. Final status follows the
 * As-Left condition (an out-of-tolerance As-Found that was successfully
 * adjusted still passes) — Adjustment Made is true if any point recorded
 * "Yes".
 */
function demoDecision1(points: PointLike[]): DecisionResult {
  let asFoundOOT = false;
  let asLeftOOT = false;
  let anyAdjusted = false;
  let sawAsLeft = false;

  for (const p of points) {
    const tolerance = cellText(p, COL.CAL_TOLERANCE);
    const devFound = cellText(p, COL.DEVIATION_AS_FOUND);
    const devLeft = cellText(p, COL.DEVIATION_AS_LEFT);
    const adj = cellText(p, COL.ADJUSTMENT_MADE);

    if (tolerance && devFound && magnitudeExceeds(devFound, tolerance)) asFoundOOT = true;
    if (tolerance && devLeft != null) {
      sawAsLeft = true;
      if (magnitudeExceeds(devLeft, tolerance)) asLeftOOT = true;
    }
    if (adj && adj.trim().toLowerCase() === "yes") anyAdjusted = true;
  }

  const asFoundStatus = asFoundOOT ? ConditionStatus.OUT_OF_TOLERANCE : ConditionStatus.IN_TOLERANCE;
  const asLeftStatus = sawAsLeft ? (asLeftOOT ? ConditionStatus.OUT_OF_TOLERANCE : ConditionStatus.IN_TOLERANCE) : null;
  const finalStatus = sawAsLeft
    ? asLeftOOT
      ? FinalStatus.FAIL
      : FinalStatus.PASS
    : asFoundOOT
      ? FinalStatus.FAIL
      : FinalStatus.PASS;

  return { asFoundStatus, asLeftStatus, adjustmentMade: anyAdjusted, finalStatus };
}

/**
 * For verification-only procedures with a single per-point Pass/Fail
 * result column and no adjustment step (Weathering Tester): final status
 * is PASS only if every point passed.
 */
function demoDecision2(points: PointLike[]): DecisionResult {
  const results = points.map((p) => (cellText(p, COL.RESULT) || "").trim().toLowerCase());
  const anyFail = results.some((r) => r === "fail");
  const status = anyFail ? ConditionStatus.OUT_OF_TOLERANCE : ConditionStatus.IN_TOLERANCE;
  return {
    asFoundStatus: status,
    asLeftStatus: null,
    adjustmentMade: null,
    finalStatus: anyFail ? FinalStatus.FAIL : FinalStatus.PASS,
  };
}

export const DECISION_RULES: Record<string, (points: PointLike[]) => DecisionResult> = {
  "DEMO-DECISION-1": demoDecision1,
  "DEMO-DECISION-2": demoDecision2,
};

export function runDecisionRule(revision: string, points: PointLike[]): DecisionResult {
  const rule = DECISION_RULES[revision];
  if (!rule) throw new Error(`Unknown decision rule revision: ${revision}`);
  return rule(points);
}
