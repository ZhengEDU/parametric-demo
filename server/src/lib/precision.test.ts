import { describe, expect, it } from "vitest";
import { isValidDecimalString, magnitudeExceeds, scaleOf, subtractDecimalStrings } from "./precision";

describe("precision", () => {
  it("validates decimal strings without parsing to float", () => {
    expect(isValidDecimalString("200.00")).toBe(true);
    expect(isValidDecimalString("-4.5")).toBe(true);
    expect(isValidDecimalString("abc")).toBe(false);
    expect(isValidDecimalString("1.2.3")).toBe(false);
  });

  it("computes scale from decimal places", () => {
    expect(scaleOf("200.00")).toBe(2);
    expect(scaleOf("200")).toBe(0);
    expect(scaleOf("0.0005")).toBe(4);
  });

  it("subtracts decimal strings exactly, matching the real sample's sign convention", () => {
    expect(subtractDecimalStrings("202.00", "200.00")).toBe("+2.00");
    expect(subtractDecimalStrings("396.50", "400.00")).toBe("-3.50");
    expect(subtractDecimalStrings("0.00", "0.00")).toBe("0.00");
  });

  it("detects out-of-tolerance magnitude regardless of sign or ± prefix", () => {
    expect(magnitudeExceeds("+2.00", "±2.00")).toBe(false);
    expect(magnitudeExceeds("-2.01", "±2.00")).toBe(true);
    expect(magnitudeExceeds("+0.07", "±0.05")).toBe(true);
  });
});
