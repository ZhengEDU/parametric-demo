import { COL } from "./measurementColumnKeys";

/**
 * Per-family Word view-model builders (Section 32: DocumentRenderer
 * receives structured data; this is the one place that data gets shaped
 * into the literal `{tag}` names baked into each template — see
 * docs/WORD_TEMPLATE_ENGINE.md). Nothing here touches OOXML.
 */

type Cell = { numericValue?: string; displayScale?: number; displayValue?: string; unit?: string } | string | undefined;

function cellText(values: Record<string, Cell>, key: string): string {
  const cell = values[key];
  if (cell == null) return "";
  if (typeof cell === "string") return cell;
  return cell.displayValue ?? "";
}

export interface PointRecord {
  rowLabel: string;
  values: Record<string, Cell>;
}
export interface GroupRecord {
  name: string;
  points: PointRecord[];
}
export interface SectionRecord {
  name: string;
  groups: GroupRecord[];
}
export interface StandardUsageRecord {
  idNumber: string;
  manufacturer: string;
  model: string;
  description: string;
  calDueDisplay: string;
}
export interface EnvironmentalRecord {
  parameter: string;
  displayValue: string;
  asFoundStatus?: string | null;
  asLeftStatus?: string | null;
  finalStatus?: string | null;
}

export interface CommonRecordFields {
  certificateNumber: string;
  assetNumber: string;
  customerName: string;
  assetDescription: string;
  customerAddressLine1: string;
  assetManufacturer: string;
  customerAddressLine2: string;
  assetModel: string;
  customerCityStateZip: string;
  assetSerialNumber: string;
  customerContact: string;
  assetAccuracy: string;
  customerPhone: string;
  assetRange: string;
  calibrationDateDisplay: string;
  procedureName: string;
  calibrationNextDueDisplay: string;
  calibrationIntervalDisplay: string;
  calibrationLocation: string;
  comments: string;
  environment: EnvironmentalRecord[];
  standards: StandardUsageRecord[];
}

function envValue(env: EnvironmentalRecord[], parameter: string): string {
  return env.find((e) => e.parameter === parameter)?.displayValue ?? "";
}
function envStatus(env: EnvironmentalRecord[], parameter: string, which: "asFoundStatus" | "asLeftStatus" | "finalStatus"): string {
  const val = env.find((e) => e.parameter === parameter)?.[which];
  if (!val) return "";
  return val
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

function baseTags(common: CommonRecordFields) {
  return {
    certificate_number: common.certificateNumber,
    asset_number: common.assetNumber,
    customer_name: common.customerName,
    asset_description: common.assetDescription,
    customer_address_line1: common.customerAddressLine1,
    asset_manufacturer: common.assetManufacturer,
    customer_address_line2: common.customerAddressLine2,
    asset_model: common.assetModel,
    customer_city_state_zip: common.customerCityStateZip,
    asset_serial_number: common.assetSerialNumber,
    customer_contact: common.customerContact,
    asset_accuracy: common.assetAccuracy,
    customer_phone: common.customerPhone,
    asset_range: common.assetRange,
    calibration_date: common.calibrationDateDisplay,
    procedure_name: common.procedureName,
    calibration_next_due: common.calibrationNextDueDisplay,
    calibration_interval: common.calibrationIntervalDisplay,
    env_temperature_value: envValue(common.environment, "temperature"),
    env_temperature_as_found_status: envStatus(common.environment, "temperature", "asFoundStatus"),
    env_temperature_as_left_status: envStatus(common.environment, "temperature", "asLeftStatus"),
    env_temperature_status: envStatus(common.environment, "temperature", "finalStatus"),
    calibration_location: common.calibrationLocation,
    env_humidity_value: envValue(common.environment, "humidity"),
    comments: common.comments,
    standards: common.standards.map((s) => ({
      standard_id_number: s.idNumber,
      standard_manufacturer: s.manufacturer,
      standard_model_number: s.model,
      standard_description: s.description,
      standard_cal_due: s.calDueDisplay,
    })),
  };
}

function pointTags(p: PointRecord, includeAsLeft: boolean, includeUncertainty: boolean) {
  if (includeAsLeft) {
    return {
      point_target_value: cellText(p.values, COL.TARGET_VALUE),
      point_unit: cellText(p.values, COL.UNIT),
      point_standard_as_found: cellText(p.values, COL.STANDARD_AS_FOUND),
      point_as_found: cellText(p.values, COL.AS_FOUND),
      point_deviation_as_found: cellText(p.values, COL.DEVIATION_AS_FOUND),
      point_standard_as_left: cellText(p.values, COL.STANDARD_AS_LEFT),
      point_as_left: cellText(p.values, COL.AS_LEFT),
      point_deviation_as_left: cellText(p.values, COL.DEVIATION_AS_LEFT),
      ...(includeUncertainty ? { point_uncertainty: cellText(p.values, COL.UNCERTAINTY) } : {}),
      point_cal_tolerance: cellText(p.values, COL.CAL_TOLERANCE),
      point_adjustment_made: cellText(p.values, COL.ADJUSTMENT_MADE),
    };
  }
  return {
    point_target_value: cellText(p.values, COL.TARGET_VALUE),
    point_unit: cellText(p.values, COL.UNIT),
    point_standard_as_found: cellText(p.values, COL.STANDARD_AS_FOUND),
    point_as_found: cellText(p.values, COL.AS_FOUND),
    point_deviation_as_found: cellText(p.values, COL.DEVIATION_AS_FOUND),
    point_cal_tolerance: cellText(p.values, COL.CAL_TOLERANCE),
    point_result: cellText(p.values, COL.RESULT),
  };
}

/** weight-set / temp-rh-meter: flat {groups:[{points:[...]}]} */
export function buildFlatGroupsViewModel(
  common: CommonRecordFields,
  sections: SectionRecord[],
  opts: { includeUncertainty: boolean }
) {
  const groups = sections.flatMap((s) => s.groups);
  return {
    ...baseTags(common),
    groups: groups.map((g) => ({
      group_name: g.name,
      points: g.points.map((p) => pointTags(p, true, opts.includeUncertainty)),
    })),
  };
}

/** weathering-tester: {sections:[{groups:[{points:[...]}]}]} */
export function buildSectionedGroupsViewModel(common: CommonRecordFields, sections: SectionRecord[]) {
  return {
    ...baseTags(common),
    sections: sections.map((s) => ({
      section_name: s.name,
      groups: s.groups.map((g) => ({
        group_name: g.name,
        points: g.points.map((p) => pointTags(p, false, false)),
      })),
    })),
  };
}

/** preventative-maintenance: {sections:[{items:[...]}]} */
export interface ChecklistItemRecord {
  label: string;
  result: string | null;
  notes: string | null;
}
export interface ChecklistSectionRecord {
  name: string;
  items: ChecklistItemRecord[];
}
function formatChecklistResult(result: string | null): string {
  if (!result) return "";
  if (result === "NOT_APPLICABLE") return "N/A";
  return result[0] + result.slice(1).toLowerCase();
}
export function buildChecklistViewModel(
  common: CommonRecordFields,
  checklistSections: ChecklistSectionRecord[],
  extra: { purposeOfVisit: string; serviceRequested: string }
) {
  return {
    ...baseTags(common),
    purpose_of_visit: extra.purposeOfVisit,
    service_requested: extra.serviceRequested,
    sections: checklistSections.map((s) => ({
      section_name: s.name,
      items: s.items.map((i) => ({
        item_label: i.label,
        item_result: formatChecklistResult(i.result),
        item_notes: i.notes ?? "",
      })),
    })),
  };
}
