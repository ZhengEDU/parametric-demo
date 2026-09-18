import { describe, expect, it } from "vitest";
import { dedupeMostRecentByRecord, dedupeMostRecentSectionsByRecord } from "./recordProvisioning";

describe("dedupeMostRecentByRecord", () => {
  it("returns an empty array when there is no prior history", () => {
    expect(dedupeMostRecentByRecord([])).toEqual([]);
  });

  it("keeps only rows belonging to the newest record instead of mixing two visits", () => {
    // Query is ordered newest-record-first, so rows[0]'s record is the one to keep.
    const rows = [
      { calibrationRecordId: "record-new", name: "Section A" },
      { calibrationRecordId: "record-new", name: "Section B" },
      { calibrationRecordId: "record-old", name: "Stale Section" },
    ];
    expect(dedupeMostRecentByRecord(rows)).toEqual([
      { calibrationRecordId: "record-new", name: "Section A" },
      { calibrationRecordId: "record-new", name: "Section B" },
    ]);
  });
});

describe("dedupeMostRecentSectionsByRecord", () => {
  it("flattens the newest record's sections/groups/points into cloneable name+rows shape", () => {
    const sections = [
      {
        calibrationRecordId: "record-new",
        name: "Calibration Data",
        groups: [{ name: "Readings", points: [{ rowLabel: "10" }, { rowLabel: "50" }] }],
      },
      {
        calibrationRecordId: "record-old",
        name: "Old Calibration Data",
        groups: [{ name: "Readings", points: [{ rowLabel: "5" }] }],
      },
    ];
    expect(dedupeMostRecentSectionsByRecord(sections)).toEqual([
      { name: "Calibration Data", groups: [{ name: "Readings", rows: ["10", "50"] }] },
    ]);
  });
});
