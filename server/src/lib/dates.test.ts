import { describe, expect, it } from "vitest";
import { addMonths } from "./dates";

describe("addMonths", () => {
  it("adds whole months for a day that exists in every month", () => {
    expect(addMonths(new Date("2026-01-15T00:00:00.000Z"), 1).toISOString()).toBe("2026-02-15T00:00:00.000Z");
  });

  it("clamps to the last day of the target month instead of rolling over", () => {
    // Native Date.setMonth would silently roll Jan 31 + 1 month into March —
    // wrong for a calibration due date, which must land in February.
    expect(addMonths(new Date("2026-01-31T00:00:00.000Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("clamps onto a leap-year February 29th", () => {
    expect(addMonths(new Date("2027-01-31T00:00:00.000Z"), 13).toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("preserves the day across a full-year interval", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00.000Z"), 12).toISOString()).toBe("2027-01-31T00:00:00.000Z");
  });
});
