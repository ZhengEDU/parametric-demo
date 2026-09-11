import { describe, expect, it } from "vitest";
import { validatePointValues } from "./calibrationWorkflow";

describe("validatePointValues", () => {
  it("recomputes deviation server-side instead of trusting client input", () => {
    const out = validatePointValues("p1", {
      standardAsFound: "102.0087",
      asFound: "102.87",
      deviationAsFound: "+999.9999", // wrong on purpose — must be overwritten
    });
    expect(out.deviationAsFound).toBe("+0.8613");
  });

  it("rejects a non-numeric reading instead of silently persisting it", () => {
    expect(() =>
      validatePointValues("p1", { standardAsFound: "10.00", asFound: "not a number" })
    ).toThrow(/not a valid decimal number/);
  });

  it("allows the standard and the reading to have different decimal scales", () => {
    // Real evidence (docs/ASSUMPTIONS.md, CO2 incubator certs): the
    // reference standard is commonly read to finer resolution than the
    // unit under test — this is normal, not a data-entry error.
    const out = validatePointValues("p1", { standardAsFound: "4.859", asFound: "5.0" });
    expect(out.deviationAsFound).toBe("+0.141");
  });

  it("leaves a point untouched when Standard or the reading is still blank", () => {
    const out = validatePointValues("p1", { standardAsFound: "10.00", targetValue: "10" });
    expect(out.deviationAsFound).toBeUndefined();
  });

  it("validates As-Found and As-Left independently", () => {
    const out = validatePointValues("p1", {
      standardAsFound: "10.00",
      asFound: "10.05",
      standardAsLeft: "10.00",
      asLeft: "9.98",
    });
    expect(out.deviationAsFound).toBe("+0.05");
    expect(out.deviationAsLeft).toBe("-0.02");
  });
});
