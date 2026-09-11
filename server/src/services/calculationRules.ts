import { subtractDecimalStrings } from "../lib/precision";

/**
 * DEMO CALCULATION RULES — no written spec was ever provided, so these
 * stay labeled DEMO, but `deviation = reading − standard` matches every
 * deviation value across all 7 real certificates now in
 * `samples/word-documents/` (5 instrument families) — see
 * "Calculation / decision rules" in docs/ASSUMPTIONS.md.
 *
 * Section 21: "do not invent production uncertainty calculations."
 * These are simple, transparent, labeled demo rules, each tied to a
 * `calculationRuleRevision` tag on the owning Procedure so the UI can
 * always show which rule produced a value.
 */

export type CalculationRule = (input: { standardReading: string; dutReading: string }) => {
  deviation: string;
};

const DEMO_CALC_1: CalculationRule = ({ standardReading, dutReading }) => ({
  deviation: subtractDecimalStrings(dutReading, standardReading),
});

export const CALCULATION_RULES: Record<string, CalculationRule> = {
  "DEMO-CALC-1": DEMO_CALC_1,
};

export function runCalculationRule(revision: string, input: { standardReading: string; dutReading: string }) {
  const rule = CALCULATION_RULES[revision];
  if (!rule) throw new Error(`Unknown calculation rule revision: ${revision}`);
  return rule(input);
}
