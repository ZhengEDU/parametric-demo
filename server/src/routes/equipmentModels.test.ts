import { describe, expect, it } from "vitest";
import { normalizeModelText } from "./equipmentModels";

describe("normalizeModelText", () => {
  it("strips dashes so a tech typing without them still matches", () => {
    expect(normalizeModelText("A01-000X")).toBe("A01000X");
    expect(normalizeModelText("A01000X")).toBe("A01000X");
  });

  it("is case-insensitive", () => {
    expect(normalizeModelText("a01-000x")).toBe("A01000X");
  });

  it("strips spaces and other punctuation", () => {
    expect(normalizeModelText("A01 000/X")).toBe("A01000X");
  });
});
