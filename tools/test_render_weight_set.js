// One-off validation script: render the weight-set template with fake
// multi-group / multi-point / multi-standard data to prove the nested
// table-row loop works with docxtemplater's free/core module before the
// real renderer service is built on top of it.
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const templatePath = path.join(__dirname, "..", "server", "templates", "weight-set", "source.docx");
const outPath = path.join(__dirname, "render-test-output.docx");

const content = fs.readFileSync(templatePath, "binary");
const zip = new PizZip(content);
const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

const data = {
  certificate_number: "DEMO-2026-000456",
  asset_number: "PBR-WS-2201",
  customer_name: "Pacific BioResearch",
  asset_description: "Precision Analytical Balance",
  customer_address_line1: "1200 Innovation Way",
  asset_manufacturer: "Ohaus-Fictional Co",
  customer_address_line2: "Suite 400",
  asset_model: "FX-4400D (fictional)",
  customer_city_state_zip: "Irvine, CA 92618",
  asset_serial_number: "FICT-88213",
  customer_contact: "Jordan Alvarez (fictional)",
  asset_accuracy: "±0.1% of reading",
  customer_phone: "555-010-2044",
  asset_range: "0 to 4200 grams",
  calibration_date: "10Sep2026",
  procedure_name: "DEMO-PROC-MASS-1",
  calibration_next_due: "Sep2027",
  calibration_interval: "12 Months",
  env_temperature_value: "22.1",
  env_temperature_as_found_status: "In Tolerance",
  env_temperature_as_left_status: "In Tolerance",
  env_temperature_status: "Pass",
  calibration_location: "Field Calibration",
  env_humidity_value: "47.5",
  comments: "DEMO comment: rendered via automated test script.",
  standards: [
    { standard_id_number: "STD-1001", standard_manufacturer: "Troemner-Fictional", standard_model_number: "7219-00W", standard_description: "Class 0 Weight Set", standard_cal_due: "Apr2027" },
    { standard_id_number: "STD-1002", standard_manufacturer: "Rice Lake-Fictional", standard_model_number: "RL-50", standard_description: "50g Check Weight", standard_cal_due: "Jun2027" },
  ],
  groups: [
    {
      group_name: "Mass (Low Range)",
      points: [
        { point_target_value: "0.000000", point_unit: "g", point_standard_as_found: "0.000000", point_as_found: "0.000000", point_deviation_as_found: "0.000000", point_standard_as_left: "0.000000", point_as_left: "0.000000", point_deviation_as_left: "0.000000", point_cal_tolerance: "±0.5", point_adjustment_made: "No" },
        { point_target_value: "200.000000", point_unit: "g", point_standard_as_found: "200.000000", point_as_found: "202.000000", point_deviation_as_found: "+2.000000", point_standard_as_left: "200.000000", point_as_left: "200.000000", point_deviation_as_left: "0.000000", point_cal_tolerance: "±2.0", point_adjustment_made: "Yes" },
      ],
    },
    {
      group_name: "Mass (High Range)",
      points: [
        { point_target_value: "1000.00", point_unit: "g", point_standard_as_found: "1000.00", point_as_found: "1002.00", point_deviation_as_found: "+2.00", point_standard_as_left: "1000.00", point_as_left: "1000.00", point_deviation_as_left: "0.00", point_cal_tolerance: "±10.00", point_adjustment_made: "Yes" },
        { point_target_value: "2000.00", point_unit: "g", point_standard_as_found: "2000.00", point_as_found: "2000.00", point_deviation_as_found: "0.00", point_standard_as_left: "2000.00", point_as_left: "2000.00", point_deviation_as_left: "0.00", point_cal_tolerance: "±20.00", point_adjustment_made: "No" },
        { point_target_value: "4000.00", point_unit: "g", point_standard_as_found: "4000.00", point_as_found: "4000.00", point_deviation_as_found: "0.00", point_standard_as_left: "4000.00", point_as_left: "4000.00", point_deviation_as_left: "0.00", point_cal_tolerance: "±40.00", point_adjustment_made: "No" },
      ],
    },
  ],
};

doc.render(data);

const buf = doc.getZip().generate({ type: "nodebuffer" });
fs.writeFileSync(outPath, buf);
console.log("Wrote", outPath);
