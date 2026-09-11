import type { CellValue } from "../api/types";

export function getDisplay(v: CellValue): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return v.displayValue ?? "";
}
