/**
 * Decimal-safe numeric cell handling (Section 20 of the product brief).
 *
 * Never format a stored measurement by round-tripping it through a JS
 * `number` (`Number("2.000000")` becomes `2`, silently losing intended
 * precision). Every numeric measurement cell is stored and transported as
 * this exact triple: the value AS A STRING (numericValue), how many
 * decimal places matter (displayScale), and the pre-formatted string to
 * show/print (displayValue). The Word renderer and the technician/manager
 * UI both read `displayValue` directly — they never reformat.
 */

export interface PrecisionValue {
  numericValue: string;
  displayScale: number;
  displayValue: string;
  unit?: string;
}

/** Validates a decimal string without ever parsing it into a float. */
const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

export function isValidDecimalString(value: string): boolean {
  return DECIMAL_RE.test(value.trim());
}

export function scaleOf(value: string): number {
  const trimmed = value.trim();
  const dot = trimmed.indexOf(".");
  return dot === -1 ? 0 : trimmed.length - dot - 1;
}

/**
 * Builds a PrecisionValue from raw technician input (always a string from
 * an <input type="text" inputmode="decimal">, never type="number" — see
 * docs/QUALITY_LIMITATIONS.md and the technician form components).
 */
export function makePrecisionValue(rawInput: string, unit?: string): PrecisionValue {
  const trimmed = rawInput.trim();
  if (!isValidDecimalString(trimmed)) {
    throw new Error(`Invalid decimal value: ${JSON.stringify(rawInput)}`);
  }
  const displayScale = scaleOf(trimmed);
  return {
    numericValue: trimmed,
    displayScale,
    displayValue: trimmed,
    unit,
  };
}

/**
 * Deviation = DUT reading - Standard reading, computed on BigInt-scaled
 * integers (never floating point) so trailing precision is exact. Applies
 * DEMO-CALC-1 only — see server/src/services/calculationRules.ts.
 */
export function subtractDecimalStrings(a: string, b: string): string {
  const scale = Math.max(scaleOf(a), scaleOf(b));
  const toScaledBigInt = (v: string): bigint => {
    const neg = v.trim().startsWith("-");
    const [intPart, fracPart = ""] = v.trim().replace("-", "").split(".");
    const paddedFrac = (fracPart + "0".repeat(scale)).slice(0, scale);
    const combined = BigInt(intPart + paddedFrac || "0");
    return neg ? -combined : combined;
  };
  const diff = toScaledBigInt(a) - toScaledBigInt(b);
  const negative = diff < 0n;
  const abs = (negative ? -diff : diff).toString().padStart(scale + 1, "0");
  const intPart = abs.slice(0, abs.length - scale) || "0";
  const fracPart = scale > 0 ? "." + abs.slice(abs.length - scale) : "";
  const sign = negative ? "-" : diff > 0n ? "+" : "";
  return `${sign}${intPart}${fracPart}`;
}

/**
 * True if |deviation| exceeds the tolerance magnitude (tolerance strings
 * may carry a leading "±", stripped before comparing). Integer/BigInt
 * comparison — no floating point involved.
 */
export function magnitudeExceeds(deviation: string, toleranceMagnitude: string): boolean {
  const stripSign = (v: string) => v.trim().replace(/^[+\-±]/, "");
  const a = stripSign(deviation);
  const b = stripSign(toleranceMagnitude);
  const scale = Math.max(scaleOf(a), scaleOf(b));
  const toScaledBigInt = (v: string): bigint => {
    const [intPart, fracPart = ""] = v.split(".");
    const paddedFrac = (fracPart + "0".repeat(scale)).slice(0, scale);
    return BigInt((intPart || "0") + paddedFrac);
  };
  return toScaledBigInt(a) > toScaledBigInt(b);
}
