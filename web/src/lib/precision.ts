// Mirrors server/src/lib/precision.ts subtractDecimalStrings — kept as a
// small client-side duplicate (different runtime) rather than a shared
// package, since it's the only piece of server business logic the
// technician form needs to replicate for live deviation display.
const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

export function isValidDecimalString(value: string): boolean {
  return DECIMAL_RE.test(value.trim());
}

function scaleOf(value: string): number {
  const trimmed = value.trim();
  const dot = trimmed.indexOf(".");
  return dot === -1 ? 0 : trimmed.length - dot - 1;
}

export function subtractDecimalStrings(a: string, b: string): string | null {
  if (!isValidDecimalString(a) || !isValidDecimalString(b)) return null;
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
