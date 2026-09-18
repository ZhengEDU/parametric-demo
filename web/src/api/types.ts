export type RoleName = "TECHNICIAN" | "DOCUMENTATION" | "MANAGER" | "ADMIN" | "AUDITOR";

export type WorkflowState =
  | "DRAFT"
  | "SUBMITTED"
  | "RETURNED_FOR_CORRECTION"
  | "RESUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "DOCUMENT_GENERATED"
  | "SYNCED_TO_CALIBRATION_CONTROL"
  | "READY_FOR_RELEASE"
  | "RELEASED";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: RoleName;
}

export interface Cell {
  numericValue?: string;
  displayScale?: number;
  displayValue?: string;
  unit?: string;
}
export type CellValue = Cell | string | undefined;

export interface MeasurementPoint {
  id: string;
  sortOrder: number;
  rowLabel: string;
  values: Record<string, CellValue>;
}
export interface MeasurementGroup {
  id: string;
  name: string;
  sortOrder: number;
  points: MeasurementPoint[];
}
export interface MeasurementSection {
  id: string;
  name: string;
  sortOrder: number;
  groups: MeasurementGroup[];
}

export interface PMChecklistItem {
  id: string;
  sortOrder: number;
  label: string;
  result: "PASS" | "FAIL" | "NOT_APPLICABLE" | null;
  notes: string | null;
}
export interface PMChecklistSection {
  id: string;
  name: string;
  sortOrder: number;
  items: PMChecklistItem[];
}

export interface EnvironmentalObservation {
  id: string;
  parameter: string;
  unit: string;
  numericValue: string | null;
  displayScale: number;
  displayValue: string | null;
  asFoundStatus: "IN_TOLERANCE" | "OUT_OF_TOLERANCE" | "NOT_APPLICABLE" | null;
  asLeftStatus: "IN_TOLERANCE" | "OUT_OF_TOLERANCE" | "NOT_APPLICABLE" | null;
  finalStatus: "PASS" | "FAIL" | "LIMITED" | "NOT_APPLICABLE" | null;
  sortOrder: number;
}

export interface ReferenceStandard {
  id: string;
  idNumber: string;
  manufacturer: string;
  model: string;
  description: string;
  calDue: string;
  active: boolean;
}
export interface StandardUsage {
  id: string;
  sortOrder: number;
  standard: ReferenceStandard;
}

export interface Correction {
  id: string;
  fieldRef: string;
  fieldLabel: string;
  originalValueJson: unknown;
  correctedValueJson: unknown;
  reason: string;
  status: "PENDING" | "RESOLVED";
  correctedBy: { id: string; fullName: string } | null;
  correctedAt: string | null;
  createdAt: string;
}

export interface Review {
  id: string;
  action: "RETURNED_FOR_CORRECTION" | "APPROVED";
  comments: string | null;
  flaggedFields: { fieldRef: string; label: string; reason: string }[] | null;
  createdAt: string;
  reviewer: { id: string; fullName: string };
}

export interface Approval {
  id: string;
  approvedAt: string;
  notes: string | null;
  approvedBy: { id: string; fullName: string };
}

export interface GeneratedDocument {
  id: string;
  filename: string;
  sha256: string;
  status: "GENERATED" | "FAILED";
  generatedAt: string;
  storagePath?: string;
}

export interface SyncEvent {
  id: string;
  status: "QUEUED" | "SYNCING" | "SUCCESS" | "FAILED";
  ccRecordId: string | null;
  requestedAt: string;
  syncedAt: string | null;
  failureMessage: string | null;
}

export interface Customer {
  id: string;
  name: string;
}
export interface CustomerSite {
  id: string;
  label: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
}
export interface EquipmentAsset {
  id: string;
  assetNumber: string;
  description: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  accuracy: string;
  range: string;
  calibrationIntervalMonths: number;
  ccAssetId: string | null;
  defaultProcedureId?: string | null;
  lastCalibratedAt?: string | null;
  nextCalibrationDueAt?: string | null;
  customer: Customer;
  site: CustomerSite;
}

export interface FormColumn {
  key: string;
  label: string;
  type: "text" | "select";
  options?: string[];
  computed?: boolean;
}
export interface FormSchema {
  kind: "measurement-flat" | "measurement-sectioned" | "checklist";
  columns?: FormColumn[];
  resultOptions?: string[];
}

export interface Procedure {
  id: string;
  name: string;
  documentFamily: "CALIBRATION_CERTIFICATE" | "PREVENTATIVE_MAINTENANCE_REPORT";
  rendererKey: string;
  calculationRuleRevision: string;
  decisionRuleRevision: string;
  digitalFormTemplateRevision?: { id: string; formSchema: FormSchema } | null;
}

export interface WorkOrder {
  id: string;
  scheduledDate: string;
}
export interface CalibrationTask {
  id: string;
  scheduledDate: string;
  asset: EquipmentAsset;
  procedure: Procedure;
  workOrder?: WorkOrder;
  calibrationRecord?: {
    id: string;
    status: WorkflowState;
    finalStatus: string | null;
    submittedAt: string | null;
    updatedAt: string;
  } | null;
}

export interface FullRecord {
  id: string;
  status: WorkflowState;
  currentRevisionNumber: number;
  calibrationLocation: string | null;
  comments: string | null;
  purposeOfVisit: string | null;
  serviceRequested: string | null;
  entryMode: "DIGITAL_FIELD" | "LEGACY_PAPER";
  legacyScanFilename: string | null;
  asFoundStatus: string | null;
  asLeftStatus: string | null;
  adjustmentMade: boolean | null;
  finalStatus: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  asset: EquipmentAsset;
  procedure: Procedure;
  technician: { id: string; fullName: string; email: string };
  task: { id: string; workOrder: WorkOrder };
  measurementSections: MeasurementSection[];
  pmChecklistSections: PMChecklistSection[];
  environmentalObservations: EnvironmentalObservation[];
  standardUsages: StandardUsage[];
  reviews: Review[];
  corrections: Correction[];
  approval: Approval | null;
  generatedDocuments: GeneratedDocument[];
  syncEvents: SyncEvent[];
  revisions: { id: string; revisionNumber: number; action: string; createdAt: string }[];
}

export interface AuditEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  detailsJson: unknown;
  createdAt: string;
  user: { id: string; fullName: string; email: string } | null;
}

export interface DashboardStats {
  assignedToday: number;
  draft: number;
  awaitingReview: number;
  returnedForCorrection: number;
  approvedToday: number;
  documentsGenerated: number;
  syncFailures: number;
  manualTranscriptionStepsEliminated: number;
}

export interface WordFieldMapping {
  id: string;
  fieldKey: string;
  placeholderTag: string;
  description: string | null;
  sortOrder: number;
}
export interface WordTemplateRevision {
  id: string;
  revision: string;
  filename: string;
  sha256: string;
  status: "DRAFT" | "ACTIVE_DEMO" | "RETIRED";
  uploadedAt: string;
  wordTemplate: { id: string; name: string; documentFamily: string };
  fieldMappings: WordFieldMapping[];
  uploadedBy: { id: string; fullName: string } | null;
  activeForProcedures: { id: string; name: string }[];
}
