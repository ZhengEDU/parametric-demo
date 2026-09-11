/**
 * Shared column-key vocabulary for MeasurementPoint.values JSON. Not every
 * procedure uses every key (Section 11 — tables are data-driven and vary
 * in shape); these are just the conventional names the seed data, the
 * decision rules, and the Word view-model builders agree on so they don't
 * need per-procedure special-casing beyond picking a decision rule tag.
 */
export const COL = {
  TARGET_VALUE: "targetValue",
  UNIT: "unit",
  STANDARD_AS_FOUND: "standardAsFound",
  AS_FOUND: "asFound",
  DEVIATION_AS_FOUND: "deviationAsFound",
  STANDARD_AS_LEFT: "standardAsLeft",
  AS_LEFT: "asLeft",
  DEVIATION_AS_LEFT: "deviationAsLeft",
  UNCERTAINTY: "uncertainty",
  CAL_TOLERANCE: "calTolerance",
  ADJUSTMENT_MADE: "adjustmentMade",
  RESULT: "result",
} as const;
