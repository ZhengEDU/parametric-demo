import { randomInt } from "crypto";

/**
 * Abstraction over Parametric's real Calibration Control (Ape Software)
 * system (Section 17). No unsafe direct writes into a real Calibration
 * Control database happen anywhere in this demo — FakeCalibrationControlAdapter
 * is the only implementation, and it only ever mutates its own in-memory/
 * DB-backed demo state (the CalibrationControlSync table), never a real
 * external system. A future real integration would implement this same
 * interface against Calibration Control's vendor-supported API, an
 * approved import mechanism, or another Parametric-approved method —
 * application code that depends on CalibrationControlAdapter would not
 * need to change.
 */
export interface CalibrationControlAsset {
  ccAssetId: string;
  assetNumber: string;
  description: string;
}

export interface SyncPayload {
  calibrationRecordId: string;
  assetNumber: string;
  ccAssetId: string | null;
  procedureName: string;
  technicianName: string;
  approvedByName: string;
  approvedAt: string;
  finalStatus: string | null;
  generatedDocumentSha256: string | null;
  generatedDocumentFilename: string | null;
}

export interface SyncResult {
  success: boolean;
  ccRecordId?: string;
  failureMessage?: string;
}

export interface CalibrationControlAdapter {
  findAsset(assetNumber: string): Promise<CalibrationControlAsset | null>;
  createCalibrationRecord(payload: SyncPayload): Promise<SyncResult>;
  updateCalibrationRecord(ccRecordId: string, payload: SyncPayload): Promise<SyncResult>;
  attachGeneratedCertificate(ccRecordId: string, sha256: string, filename: string): Promise<void>;
  verifyRecord(ccRecordId: string): Promise<boolean>;
}

/**
 * DEMO implementation. Deterministic (no AI, no randomness in the data
 * that matters) except for the generated record-id suffix, which is
 * cosmetic. "Fake assets" simulate Calibration Control already knowing
 * about equipment before this system existed — see seed data
 * (EquipmentAsset.ccAssetId).
 */
export class FakeCalibrationControlAdapter implements CalibrationControlAdapter {
  private knownAssets = new Map<string, CalibrationControlAsset>();
  private records = new Map<string, SyncPayload & { ccRecordId: string }>();

  registerKnownAsset(asset: CalibrationControlAsset) {
    this.knownAssets.set(asset.assetNumber, asset);
  }

  async findAsset(assetNumber: string): Promise<CalibrationControlAsset | null> {
    return this.knownAssets.get(assetNumber) ?? null;
  }

  async createCalibrationRecord(payload: SyncPayload): Promise<SyncResult> {
    const ccRecordId = generateCcRecordId();
    this.records.set(ccRecordId, { ...payload, ccRecordId });
    return { success: true, ccRecordId };
  }

  async updateCalibrationRecord(ccRecordId: string, payload: SyncPayload): Promise<SyncResult> {
    if (!this.records.has(ccRecordId)) {
      return { success: false, failureMessage: `Unknown Calibration Control record ${ccRecordId}` };
    }
    this.records.set(ccRecordId, { ...payload, ccRecordId });
    return { success: true, ccRecordId };
  }

  async attachGeneratedCertificate(): Promise<void> {
    // Demo no-op: the real system would receive/store the file. The
    // generated document's SHA-256 is already recorded in our own
    // CalibrationControlSync.payloadJson for inspection.
  }

  async verifyRecord(ccRecordId: string): Promise<boolean> {
    return this.records.has(ccRecordId);
  }
}

function generateCcRecordId(): string {
  const year = new Date().getFullYear();
  const suffix = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return `CC-DEMO-${year}-${suffix}`;
}

export const calibrationControlAdapter = new FakeCalibrationControlAdapter();
