/**
 * Fictional filler data for the Admin > Templates "Generate Test Document"
 * action (Section 30) — renders a template with made-up values, not tied
 * to any real CalibrationRecord, purely so an admin can eyeball template
 * fidelity.
 */
const commonFields = {
  certificate_number: "TEST-0000",
  asset_number: "TEST-ASSET-01",
  customer_name: "Test Customer (sample data)",
  asset_description: "Sample Equipment",
  customer_address_line1: "100 Sample Street",
  asset_manufacturer: "Sample Manufacturer",
  customer_address_line2: "",
  asset_model: "Sample-Model-1",
  customer_city_state_zip: "Anaheim, CA 92807",
  asset_serial_number: "SAMPLE-SN-001",
  customer_contact: "Sample Contact",
  asset_accuracy: "±1.0%",
  customer_phone: "555-000-0000",
  asset_range: "0-100",
  calibration_date: "01Jan2026",
  procedure_name: "SAMPLE-PROCEDURE",
  calibration_next_due: "Jan2027",
  calibration_interval: "12 Months",
  env_temperature_value: "23.0",
  env_temperature_as_found_status: "In Tolerance",
  env_temperature_as_left_status: "In Tolerance",
  env_temperature_status: "Pass",
  calibration_location: "Lab",
  env_humidity_value: "45.0",
  comments: "Sample comment for template fidelity testing.",
  standards: [
    { standard_id_number: "STD-SAMPLE", standard_manufacturer: "Sample Std Mfg", standard_model_number: "SM-1", standard_description: "Sample Reference Standard", standard_cal_due: "Jan2027" },
  ],
};

const samplePoint = {
  point_target_value: "10.000000",
  point_unit: "unit",
  point_standard_as_found: "10.000000",
  point_as_found: "10.010000",
  point_deviation_as_found: "+0.010000",
  point_standard_as_left: "10.000000",
  point_as_left: "10.000000",
  point_deviation_as_left: "0.000000",
  point_uncertainty: "0.005",
  point_cal_tolerance: "±0.05",
  point_adjustment_made: "No",
  point_result: "Pass",
};

export function buildSampleData(rendererKey: string): Record<string, unknown> {
  switch (rendererKey) {
    case "weight-set":
    case "temp-rh-meter":
      return { ...commonFields, groups: [{ group_name: "Sample Group", points: [samplePoint, samplePoint] }] };
    case "weathering-tester":
      return {
        ...commonFields,
        sections: [
          { section_name: "Temperature", groups: [{ group_name: "Sample Group", points: [samplePoint] }] },
          {
            section_name: "Irradiance",
            groups: [
              { group_name: "Channel 1", points: [samplePoint] },
              { group_name: "Channel 2", points: [samplePoint] },
            ],
          },
        ],
      };
    case "preventative-maintenance":
      return {
        ...commonFields,
        purpose_of_visit: "Sample preventative maintenance visit",
        service_requested: "Sample service request",
        sections: [
          {
            section_name: "Sample Section",
            items: [
              { item_label: "Sample checklist item 1", item_result: "Pass", item_notes: "" },
              { item_label: "Sample checklist item 2", item_result: "N/A", item_notes: "Not applicable to this unit" },
            ],
          },
        ],
      };
    default:
      throw new Error(`Unknown rendererKey: ${rendererKey}`);
  }
}
