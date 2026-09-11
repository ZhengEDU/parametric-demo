/**
 * Demo seed data — DEVELOPMENT DEMO ONLY, not real Parametric data (except
 * the company's own public office address/phone, and the numeric shape of
 * the one real sample document — see docs/ASSUMPTIONS.md and
 * docs/DOCUMENT_ANALYSIS.md). Fictional customers, assets, and users only.
 *
 * Re-running this script is a no-op once seeded (guarded by a User count
 * check) — it does not attempt incremental/idempotent upserts beyond that.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PrismaClient, RoleName } from "@prisma/client";
import { hashPassword } from "../src/auth/password";
import { scaleOf, subtractDecimalStrings } from "../src/lib/precision";
import { saveDraft, submitRecord, openForReview, returnForCorrection, approveRecord, releaseRecord } from "../src/services/calibrationWorkflow";
import { generateCertificateForRecord } from "../src/services/documentGeneration";
import { triggerCalibrationControlSync } from "../src/services/calibrationControlSyncService";
import type { AuthedUser } from "../src/auth/middleware";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Parametric123!";

function cell(value: string, unit?: string) {
  return { numericValue: value, displayScale: scaleOf(value), displayValue: value, unit };
}
function dev(dut: string, standard: string) {
  const d = subtractDecimalStrings(dut, standard);
  return cell(d);
}
function sha256File(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

async function main() {
  const alreadySeeded = await prisma.user.count();
  if (alreadySeeded > 0) {
    console.log("Database already has users — skipping seed (not idempotent past this point).");
    return;
  }

  // -------------------------------------------------------------------
  // Roles + users
  // -------------------------------------------------------------------
  const roleDescriptions: Record<RoleName, string> = {
    TECHNICIAN: "Performs calibrations and preventative maintenance visits in the field or lab.",
    DOCUMENTATION: "Transcribes legacy paper worksheets into the digital system for technicians without direct access.",
    MANAGER: "Reviews, returns, and approves submitted calibration records.",
    ADMIN: "Manages templates, users, and system configuration.",
    AUDITOR: "Read-only access to every record, review, and the full audit trail.",
  };
  const roles = new Map<RoleName, string>();
  for (const [name, description] of Object.entries(roleDescriptions) as [RoleName, string][]) {
    const role = await prisma.role.create({ data: { name, description } });
    roles.set(name, role.id);
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  async function makeUser(email: string, fullName: string, role: RoleName) {
    return prisma.user.create({
      data: { email, fullName, passwordHash, roleId: roles.get(role)! },
    });
  }
  const admin = await makeUser("admin@parametric.demo", "Alex Rivera", "ADMIN");
  const manager = await makeUser("manager@parametric.demo", "Morgan Lee", "MANAGER");
  const techJordan = await makeUser("jordan.kim@parametric.demo", "Jordan Kim", "TECHNICIAN");
  const techTaylor = await makeUser("taylor.brooks@parametric.demo", "Taylor Brooks", "TECHNICIAN");
  const documentation = await makeUser("casey.nguyen@parametric.demo", "Casey Nguyen", "DOCUMENTATION");
  const auditor = await makeUser("sam.patel@parametric.demo", "Sam Patel", "AUDITOR");

  function asAuthed(u: { id: string; email: string; fullName: string }, role: RoleName): AuthedUser {
    return { id: u.id, email: u.email, fullName: u.fullName, role };
  }
  const managerAuthed = asAuthed(manager, "MANAGER");

  // -------------------------------------------------------------------
  // Customers / sites / contacts
  // -------------------------------------------------------------------
  const pacificBio = await prisma.customer.create({ data: { name: "Pacific BioResearch" } });
  const pacificBioSite = await prisma.customerSite.create({
    data: {
      customerId: pacificBio.id,
      label: "Main Lab",
      addressLine1: "1220 Kraemer Blvd",
      addressLine2: "Suite 140",
      city: "Anaheim",
      state: "CA",
      zip: "92806",
    },
  });
  await prisma.customerContact.create({
    data: { customerId: pacificBio.id, siteId: pacificBioSite.id, name: "Dana Whitfield", phone: "714.555.0148", email: "dana.whitfield@pacificbio.example" },
  });

  const coastline = await prisma.customer.create({ data: { name: "Coastline Materials Testing" } });
  const coastlineSite = await prisma.customerSite.create({
    data: {
      customerId: coastline.id,
      label: "Test Yard",
      addressLine1: "4410 Warner Ave",
      addressLine2: null,
      city: "Huntington Beach",
      state: "CA",
      zip: "92649",
    },
  });
  await prisma.customerContact.create({
    data: { customerId: coastline.id, siteId: coastlineSite.id, name: "Raymond Ostrowski", phone: "714.555.0177", email: "r.ostrowski@coastlinemt.example" },
  });

  // -------------------------------------------------------------------
  // Reference standards
  // -------------------------------------------------------------------
  const massStandard = await prisma.referenceStandard.create({
    data: { idNumber: "STD-MASS-014", manufacturer: "Rice Lake", model: "RL-1kg-ASTM1", description: "1 kg ASTM Class 1 mass set", calDue: new Date("2027-03-01") },
  });
  const thermoHygroStandard = await prisma.referenceStandard.create({
    data: { idNumber: "STD-THG-007", manufacturer: "Fluke", model: "1620A", description: "Precision thermo-hygrometer reference", calDue: new Date("2027-01-15") },
  });
  const irradianceStandard = await prisma.referenceStandard.create({
    data: { idNumber: "STD-IRR-003", manufacturer: "Eppley", model: "PSP", description: "Precision spectral pyranometer", calDue: new Date("2026-11-30") },
  });
  const co2IndicatorStandard = await prisma.referenceStandard.create({
    data: { idNumber: "STD-CO2-011", manufacturer: "Vaisala", model: "MI70 w/ HMP77B + GMP221", description: "Temp/RH/CO2 indicator with reference probes", calDue: new Date("2027-05-01") },
  });

  // -------------------------------------------------------------------
  // Digital form templates (structural hints for a future dynamic form
  // renderer — not yet consumed by any route; the current UI infers
  // columns from MeasurementPoint.values, see docs/QUALITY_LIMITATIONS.md)
  // -------------------------------------------------------------------
  async function makeFormTemplate(name: string, rendererKey: string, formSchema: Record<string, unknown>) {
    const template = await prisma.digitalFormTemplate.create({ data: { name } });
    return prisma.digitalFormTemplateRevision.create({
      data: { digitalFormTemplateId: template.id, revision: "1", formSchema, status: "ACTIVE_DEMO" },
    });
  }
  const flatColumns = (includeUncertainty: boolean) => [
    { key: "targetValue", label: "Target Value", type: "text" },
    { key: "unit", label: "Units", type: "text" },
    { key: "standardAsFound", label: "Standard (As Found)", type: "text" },
    { key: "asFound", label: "As Found", type: "text" },
    { key: "deviationAsFound", label: "Deviation (As Found)", type: "text", computed: true },
    { key: "standardAsLeft", label: "Standard (As Left)", type: "text" },
    { key: "asLeft", label: "As Left", type: "text" },
    { key: "deviationAsLeft", label: "Deviation (As Left)", type: "text", computed: true },
    ...(includeUncertainty ? [{ key: "uncertainty", label: "Uncertainty", type: "text" }] : []),
    { key: "calTolerance", label: "Cal Tolerance", type: "text" },
    { key: "adjustmentMade", label: "Adjustment Made", type: "select", options: ["Yes", "No"] },
  ];
  const weightSetForm = await makeFormTemplate("Weight Set Calibration Data", "weight-set", { kind: "measurement-flat", columns: flatColumns(false) });
  const tempRhForm = await makeFormTemplate("Temp/RH Meter Calibration Data", "temp-rh-meter", { kind: "measurement-flat", columns: flatColumns(true) });
  const weatheringForm = await makeFormTemplate("Weathering Tester Calibration Data", "weathering-tester", {
    kind: "measurement-sectioned",
    columns: [
      { key: "targetValue", label: "Target Value", type: "text" },
      { key: "unit", label: "Units", type: "text" },
      { key: "standardAsFound", label: "Standard", type: "text" },
      { key: "asFound", label: "Reading", type: "text" },
      { key: "deviationAsFound", label: "Deviation", type: "text", computed: true },
      { key: "calTolerance", label: "Tolerance", type: "text" },
      { key: "result", label: "Result", type: "select", options: ["Pass", "Fail"] },
    ],
  });
  const pmForm = await makeFormTemplate("Preventative Maintenance Checklist", "preventative-maintenance", {
    kind: "checklist",
    resultOptions: ["Pass", "Fail", "N/A"],
  });

  // -------------------------------------------------------------------
  // Word templates + revisions + field mappings
  // -------------------------------------------------------------------
  const templatesRoot = path.join(__dirname, "..", "templates");
  async function makeWordTemplate(key: string, name: string, documentFamily: "CALIBRATION_CERTIFICATE" | "PREVENTATIVE_MAINTENANCE_REPORT") {
    const wordTemplate = await prisma.wordTemplate.create({ data: { name, documentFamily } });
    const relativePath = path.join("templates", key, "source.docx");
    const absolutePath = path.join(templatesRoot, key, "source.docx");
    const revision = await prisma.wordTemplateRevision.create({
      data: {
        wordTemplateId: wordTemplate.id,
        revision: "1",
        filename: "source.docx",
        sha256: sha256File(absolutePath),
        storagePath: relativePath,
        uploadedByUserId: admin.id,
        status: "ACTIVE_DEMO",
      },
    });
    const mappingPath = path.join(templatesRoot, key, "mapping.json");
    const mappings: { fieldKey: string; placeholderTag: string; description?: string }[] = JSON.parse(fs.readFileSync(mappingPath, "utf8"));
    await prisma.wordFieldMapping.createMany({
      data: mappings.map((m, i) => ({
        wordTemplateRevisionId: revision.id,
        fieldKey: m.fieldKey,
        placeholderTag: m.placeholderTag,
        description: m.description ?? null,
        sortOrder: i,
      })),
    });
    return revision;
  }
  const weightSetWordRev = await makeWordTemplate("weight-set", "Certificate of Calibration — Weight Set", "CALIBRATION_CERTIFICATE");
  const tempRhWordRev = await makeWordTemplate("temp-rh-meter", "Certificate of Calibration — Temp/RH Meter", "CALIBRATION_CERTIFICATE");
  const weatheringWordRev = await makeWordTemplate("weathering-tester", "Certificate of Calibration — Weathering Tester", "CALIBRATION_CERTIFICATE");
  const pmWordRev = await makeWordTemplate("preventative-maintenance", "Preventative Maintenance Report", "PREVENTATIVE_MAINTENANCE_REPORT");

  // -------------------------------------------------------------------
  // Procedures
  // -------------------------------------------------------------------
  const weightSetProcedure = await prisma.procedure.create({
    data: {
      name: "Mass / Weight-Reading Device Calibration",
      documentFamily: "CALIBRATION_CERTIFICATE",
      rendererKey: "weight-set",
      calculationRuleRevision: "DEMO-CALC-1",
      decisionRuleRevision: "DEMO-DECISION-1",
      digitalFormTemplateRevisionId: weightSetForm.id,
      outputWordTemplateRevisionId: weightSetWordRev.id,
    },
  });
  const tempRhProcedure = await prisma.procedure.create({
    data: {
      name: "Temperature / Humidity Meter Calibration",
      documentFamily: "CALIBRATION_CERTIFICATE",
      rendererKey: "temp-rh-meter",
      calculationRuleRevision: "DEMO-CALC-1",
      decisionRuleRevision: "DEMO-DECISION-1",
      digitalFormTemplateRevisionId: tempRhForm.id,
      outputWordTemplateRevisionId: tempRhWordRev.id,
    },
  });
  const weatheringProcedure = await prisma.procedure.create({
    data: {
      name: "Weathering Tester Verification",
      documentFamily: "CALIBRATION_CERTIFICATE",
      rendererKey: "weathering-tester",
      calculationRuleRevision: "DEMO-CALC-1",
      decisionRuleRevision: "DEMO-DECISION-2",
      digitalFormTemplateRevisionId: weatheringForm.id,
      outputWordTemplateRevisionId: weatheringWordRev.id,
    },
  });
  const pmProcedure = await prisma.procedure.create({
    data: {
      name: "HVAC Preventative Maintenance Visit",
      documentFamily: "PREVENTATIVE_MAINTENANCE_REPORT",
      rendererKey: "preventative-maintenance",
      calculationRuleRevision: "DEMO-CALC-1",
      decisionRuleRevision: "DEMO-DECISION-2",
      digitalFormTemplateRevisionId: pmForm.id,
      outputWordTemplateRevisionId: pmWordRev.id,
    },
  });

  // -------------------------------------------------------------------
  // Equipment assets
  // -------------------------------------------------------------------
  const bloodCollectionMonitor = await prisma.equipmentAsset.create({
    data: {
      customerId: pacificBio.id, siteId: pacificBioSite.id,
      assetNumber: "PBR-0231", description: "Blood Collection Monitor", manufacturer: "Terumo BCT", model: "TBCM-500",
      serialNumber: "TBC-88213", accuracy: "±0.5%", range: "0-1000 g", defaultProcedureId: weightSetProcedure.id,
      calibrationIntervalMonths: 12, ccAssetId: "CC-ASSET-40021",
    },
  });
  const labIncubator = await prisma.equipmentAsset.create({
    data: {
      customerId: pacificBio.id, siteId: pacificBioSite.id,
      assetNumber: "PBR-0344", description: "CO2 Incubator", manufacturer: "Thermo Scientific", model: "Heracell VIOS 160i",
      serialNumber: "HRV-51092", accuracy: "Local: ±1°C / ±5%RH / ±1%CO2. Rees probe: ±1°C / ±1%RH / ±1%CO2.", range: "Ambient +3 to 55°C / 0 to 20% CO2 / 0 to 100 %RH", defaultProcedureId: tempRhProcedure.id,
      calibrationIntervalMonths: 6, ccAssetId: null,
    },
  });
  const analyticalBalance = await prisma.equipmentAsset.create({
    data: {
      customerId: pacificBio.id, siteId: pacificBioSite.id,
      assetNumber: "PBR-0187", description: "Analytical Balance", manufacturer: "Mettler Toledo", model: "XPE205",
      serialNumber: "MTX-30987", accuracy: "±0.1 mg", range: "0-220 g", defaultProcedureId: weightSetProcedure.id,
      calibrationIntervalMonths: 12, ccAssetId: null,
    },
  });
  const weatheringChamber = await prisma.equipmentAsset.create({
    data: {
      customerId: coastline.id, siteId: coastlineSite.id,
      assetNumber: "CMT-0091", description: "Weathering Chamber", manufacturer: "Q-Lab", model: "QUV/spray WX-200",
      serialNumber: "QLB-77410", accuracy: "±3% irradiance / ±1°C", range: "0-1.5 W/m2 / 0-100°C", defaultProcedureId: weatheringProcedure.id,
      calibrationIntervalMonths: 12, ccAssetId: "CC-ASSET-40088",
    },
  });
  const hvacUnit = await prisma.equipmentAsset.create({
    data: {
      customerId: coastline.id, siteId: coastlineSite.id,
      assetNumber: "CMT-0142", description: "Rooftop HVAC Unit 3", manufacturer: "Carrier", model: "48TC-A08",
      serialNumber: "CAR-19004", accuracy: "N/A", range: "N/A", defaultProcedureId: pmProcedure.id,
      calibrationIntervalMonths: 6, ccAssetId: null,
    },
  });
  const environmentalChamber = await prisma.equipmentAsset.create({
    data: {
      customerId: coastline.id, siteId: coastlineSite.id,
      assetNumber: "CMT-0056", description: "Environmental Chamber", manufacturer: "Espec", model: "SH-222",
      serialNumber: "CSZ-64410", accuracy: "See Comments", range: "-20 to 150°C / 30 to 95% RH", defaultProcedureId: tempRhProcedure.id,
      calibrationIntervalMonths: 12, ccAssetId: "CC-ASSET-40099",
    },
  });

  // -------------------------------------------------------------------
  // Work orders + tasks
  // -------------------------------------------------------------------
  const pacificWorkOrder = await prisma.workOrder.create({
    data: { customerId: pacificBio.id, siteId: pacificBioSite.id, scheduledDate: new Date("2026-09-10"), createdByUserId: admin.id },
  });
  const coastlineWorkOrder = await prisma.workOrder.create({
    data: { customerId: coastline.id, siteId: coastlineSite.id, scheduledDate: new Date("2026-09-09"), createdByUserId: admin.id },
  });

  async function makeTask(workOrderId: string, assetId: string, procedureId: string, technicianId: string, scheduledDate: string) {
    return prisma.calibrationTask.create({
      data: { workOrderId, assetId, procedureId, assignedTechnicianId: technicianId, scheduledDate: new Date(scheduledDate) },
    });
  }
  const task1 = await makeTask(pacificWorkOrder.id, bloodCollectionMonitor.id, weightSetProcedure.id, techJordan.id, "2026-09-11");
  const task2 = await makeTask(pacificWorkOrder.id, labIncubator.id, tempRhProcedure.id, techJordan.id, "2026-09-10");
  const task3 = await makeTask(pacificWorkOrder.id, analyticalBalance.id, weightSetProcedure.id, techJordan.id, "2026-09-10");
  const task4 = await makeTask(coastlineWorkOrder.id, weatheringChamber.id, weatheringProcedure.id, techTaylor.id, "2026-09-09");
  const task5 = await makeTask(coastlineWorkOrder.id, hvacUnit.id, pmProcedure.id, techTaylor.id, "2026-09-08");
  const task6 = await makeTask(coastlineWorkOrder.id, environmentalChamber.id, tempRhProcedure.id, techTaylor.id, "2026-09-05");

  // -------------------------------------------------------------------
  // Calibration records + measurement data
  // -------------------------------------------------------------------
  async function makeCertRecord(taskId: string, assetId: string, procedureId: string, technicianId: string, withEnvironment: boolean, comments?: string) {
    const record = await prisma.calibrationRecord.create({
      data: { taskId, assetId, procedureId, technicianId, calibrationLocation: "Customer site — field calibration", comments },
    });
    if (withEnvironment) {
      await prisma.environmentalObservation.createMany({
        data: [
          { calibrationRecordId: record.id, parameter: "temperature", unit: "°C", numericValue: "21.7", displayScale: 1, displayValue: "21.7", asFoundStatus: "IN_TOLERANCE", asLeftStatus: "IN_TOLERANCE", finalStatus: "PASS", sortOrder: 0 },
          { calibrationRecordId: record.id, parameter: "humidity", unit: "%RH", numericValue: "45.2", displayScale: 1, displayValue: "45.2", asFoundStatus: null, asLeftStatus: null, finalStatus: null, sortOrder: 1 },
        ],
      });
    }
    return record;
  }

  type PointInput = { rowLabel: string; target: string; unit: string; standardFound: string; asFound: string | null; standardLeft: string | null; asLeft: string | null; uncertainty?: string; tolerance: string; adjustment: "Yes" | "No" | null };
  async function addPointsToGroup(groupId: string, points: PointInput[]) {
    for (const [i, p] of points.entries()) {
      const values: Record<string, unknown> = {
        targetValue: cell(p.target, p.unit),
        unit: p.unit,
        standardAsFound: cell(p.standardFound),
        calTolerance: `±${p.tolerance}`,
      };
      if (p.asFound != null) {
        values.asFound = cell(p.asFound);
        values.deviationAsFound = dev(p.asFound, p.standardFound);
      }
      if (p.standardLeft != null) values.standardAsLeft = cell(p.standardLeft);
      if (p.asLeft != null) {
        values.asLeft = cell(p.asLeft);
        values.deviationAsLeft = dev(p.asLeft, p.standardLeft ?? p.standardFound);
      }
      if (p.uncertainty != null) values.uncertainty = p.uncertainty;
      if (p.adjustment != null) values.adjustmentMade = p.adjustment;
      await prisma.measurementPoint.create({ data: { groupId, sortOrder: i, rowLabel: p.rowLabel, values: values as never } });
    }
  }
  // Flat (non-sectioned) procedures always get exactly ONE MeasurementSection
  // — the web UI's RecordView infers "sectioned" layout from
  // `measurementSections.length > 1` (see web/src/components/RecordView.tsx),
  // so a flat procedure with several named sub-tables (e.g. Local/Rees Probe
  // x Temperature/Humidity/CO2) must still be multiple MeasurementGroups
  // under one section, never one section per group.
  async function addFlatGroup(recordId: string, sectionName: string, groupName: string, points: PointInput[], sortOrder = 0) {
    const section = await prisma.measurementSection.create({ data: { calibrationRecordId: recordId, name: sectionName, sortOrder } });
    const group = await prisma.measurementGroup.create({ data: { sectionId: section.id, name: groupName, sortOrder: 0 } });
    await addPointsToGroup(group.id, points);
  }
  async function addFlatGroups(recordId: string, sectionName: string, groups: { name: string; points: PointInput[] }[]) {
    const section = await prisma.measurementSection.create({ data: { calibrationRecordId: recordId, name: sectionName, sortOrder: 0 } });
    for (const [gi, g] of groups.entries()) {
      const group = await prisma.measurementGroup.create({ data: { sectionId: section.id, name: g.name, sortOrder: gi } });
      await addPointsToGroup(group.id, g.points);
    }
  }

  type ResultPointInput = { rowLabel: string; target: string; unit: string; standard: string; reading: string; tolerance: string; result: "Pass" | "Fail" };
  async function addSectionedGroups(recordId: string, sections: { name: string; groups: { name: string; points: ResultPointInput[] }[] }[]) {
    for (const [si, s] of sections.entries()) {
      const section = await prisma.measurementSection.create({ data: { calibrationRecordId: recordId, name: s.name, sortOrder: si } });
      for (const [gi, g] of s.groups.entries()) {
        const group = await prisma.measurementGroup.create({ data: { sectionId: section.id, name: g.name, sortOrder: gi } });
        for (const [pi, p] of g.points.entries()) {
          const values = {
            targetValue: cell(p.target, p.unit),
            unit: p.unit,
            standardAsFound: cell(p.standard),
            asFound: cell(p.reading),
            deviationAsFound: dev(p.reading, p.standard),
            calTolerance: `±${p.tolerance}`,
            result: p.result,
          };
          await prisma.measurementPoint.create({ data: { groupId: group.id, sortOrder: pi, rowLabel: p.rowLabel, values: values as never } });
        }
      }
    }
  }

  // --- Task 1: Blood Collection Monitor — left in DRAFT, As-Found only,
  //     for the technician login to finish live during the demo.
  const record1 = await makeCertRecord(task1.id, bloodCollectionMonitor.id, weightSetProcedure.id, techJordan.id, true);
  await addFlatGroup(record1.id, "Mass", "Mass", [
    { rowLabel: "0", target: "0", unit: "g", standardFound: "0.00", asFound: "0.00", standardLeft: null, asLeft: null, tolerance: "2.00", adjustment: null },
    { rowLabel: "200", target: "200", unit: "g", standardFound: "200.00", asFound: "202.00", standardLeft: null, asLeft: null, tolerance: "4.00", adjustment: null },
    { rowLabel: "400", target: "400", unit: "g", standardFound: "400.00", asFound: "396.50", standardLeft: null, asLeft: null, tolerance: "6.00", adjustment: null },
    { rowLabel: "600", target: "600", unit: "g", standardFound: "600.00", asFound: "601.00", standardLeft: null, asLeft: null, tolerance: "8.00", adjustment: null },
    { rowLabel: "800", target: "800", unit: "g", standardFound: "800.00", asFound: "797.00", standardLeft: null, asLeft: null, tolerance: "8.00", adjustment: null },
    { rowLabel: "1000", target: "1000", unit: "g", standardFound: "1000.00", asFound: "1004.00", standardLeft: null, asLeft: null, tolerance: "10.00", adjustment: null },
  ]);
  await prisma.calibrationStandardUsage.create({ data: { calibrationRecordId: record1.id, standardId: massStandard.id, sortOrder: 0 } });

  // --- Task 2: CO2 Incubator — fully filled, submitted, sitting in queue.
  //     Real-shaped data (numeric magnitudes only, not customer-identifying)
  //     from a real Parametric CO2 incubator certificate: calibrated as a
  //     system against the built-in ("Local") sensors and an external Rees
  //     reference probe, each checked on Temperature/Humidity/CO2. Real
  //     evidence: Uncertainty has no ± sign and is "N/A" for CO2 (no
  //     uncertainty defined for that channel under ANSI/NCSL Z540-1-1994);
  //     As-Left mirrors As-Found exactly whenever Adjustment Made is "No".
  //     See docs/DOCUMENT_ANALYSIS.md, samples 6–7.
  const record2 = await makeCertRecord(
    task2.id, labIncubator.id, tempRhProcedure.id, techJordan.id, true,
    "Calibrated as a system with Rees reference probe (Temp/RH/CO2)."
  );
  await addFlatGroups(record2.id, "Calibration Data", [
    { name: "Local — Temperature", points: [
      { rowLabel: "36.5°C", target: "36.5", unit: "°C", standardFound: "37.04", asFound: "36.5", standardLeft: "37.04", asLeft: "36.5", uncertainty: "0.0072", tolerance: "1.00", adjustment: "No" },
    ] },
    { name: "Local — Humidity", points: [
      { rowLabel: "90 %RH", target: "90", unit: "%RH", standardFound: "88.49", asFound: "90", standardLeft: "88.49", asLeft: "90", uncertainty: "2.1", tolerance: "5.00", adjustment: "No" },
    ] },
    { name: "Local — CO2", points: [
      { rowLabel: "5 %CO2", target: "5", unit: "%CO2", standardFound: "4.859", asFound: "5.0", standardLeft: "4.859", asLeft: "5.0", uncertainty: "N/A", tolerance: "1.000", adjustment: "No" },
    ] },
    { name: "Rees Probe — Temperature", points: [
      { rowLabel: "36.5°C", target: "36.5", unit: "°C", standardFound: "36.63", asFound: "36.50", standardLeft: "36.63", asLeft: "36.50", uncertainty: "0.0072", tolerance: "1.00", adjustment: "No" },
    ] },
    { name: "Rees Probe — Humidity", points: [
      { rowLabel: "90 %RH", target: "90", unit: "%RH", standardFound: "88.95", asFound: "89.4", standardLeft: "88.95", asLeft: "89.4", uncertainty: "2.1", tolerance: "1.00", adjustment: "No" },
    ] },
    { name: "Rees Probe — CO2", points: [
      { rowLabel: "5 %CO2", target: "5", unit: "%CO2", standardFound: "5.126", asFound: "5.0", standardLeft: "5.126", asLeft: "5.0", uncertainty: "N/A", tolerance: "1.000", adjustment: "No" },
    ] },
  ]);
  await prisma.calibrationStandardUsage.create({ data: { calibrationRecordId: record2.id, standardId: co2IndicatorStandard.id, sortOrder: 0 } });
  await submitRecord(record2.id, asAuthed(techJordan, "TECHNICIAN"));

  // --- Task 3: Analytical Balance — one out-of-tolerance As-Left point ->
  //     submitted, opened, returned for correction by the manager.
  const record3 = await makeCertRecord(task3.id, analyticalBalance.id, weightSetProcedure.id, techJordan.id, true);
  await addFlatGroup(record3.id, "Mass", "Mass", [
    { rowLabel: "0", target: "0", unit: "g", standardFound: "0.0000", asFound: "0.0002", standardLeft: "0.0000", asLeft: "0.0001", tolerance: "0.0005", adjustment: "No" },
    { rowLabel: "50", target: "50", unit: "g", standardFound: "50.0000", asFound: "50.0800", standardLeft: "50.0000", asLeft: "50.0700", tolerance: "0.0500", adjustment: "Yes" },
    { rowLabel: "200", target: "200", unit: "g", standardFound: "200.0000", asFound: "200.1500", standardLeft: "200.0000", asLeft: "200.0300", tolerance: "0.1000", adjustment: "Yes" },
  ]);
  await prisma.calibrationStandardUsage.create({ data: { calibrationRecordId: record3.id, standardId: massStandard.id, sortOrder: 0 } });
  await submitRecord(record3.id, asAuthed(techJordan, "TECHNICIAN"));
  await openForReview(record3.id, managerAuthed);
  const record3Points = await prisma.measurementPoint.findMany({ where: { group: { section: { calibrationRecordId: record3.id } } }, orderBy: { sortOrder: "asc" } });
  const flaggedPoint = record3Points[1]; // 50 g row — As-Left deviation (+0.07) exceeds ±0.05 tolerance
  await returnForCorrection(record3.id, managerAuthed, "As-left reading at 50 g is still out of tolerance after adjustment — please re-adjust and re-verify.", [
    { fieldRef: `point:${flaggedPoint.id}`, label: "50 g — As Left Reading", reason: "Deviation of +0.07 g exceeds the ±0.05 g tolerance for this point." },
  ]);

  // --- Task 4: Weathering Chamber — submitted, reviewed, approved. Ready
  //     for a manager login to demo "Generate Document" live.
  const record4 = await makeCertRecord(task4.id, weatheringChamber.id, weatheringProcedure.id, techTaylor.id, true, "All channels within tolerance, no adjustment necessary.");
  await addSectionedGroups(record4.id, [
    { name: "Temperature", groups: [{ name: "Chamber", points: [{ rowLabel: "Black Panel", target: "63.0", unit: "°C", standard: "63.0", reading: "63.4", tolerance: "3.0", result: "Pass" }] }] },
    {
      name: "Irradiance",
      groups: [
        { name: "Channel 1", points: [{ rowLabel: "0.35 W/m2", target: "0.35", unit: "W/m2", standard: "0.35", reading: "0.34", tolerance: "0.02", result: "Pass" }] },
        { name: "Channel 2", points: [{ rowLabel: "0.35 W/m2", target: "0.35", unit: "W/m2", standard: "0.35", reading: "0.36", tolerance: "0.02", result: "Pass" }] },
      ],
    },
  ]);
  await prisma.calibrationStandardUsage.create({ data: { calibrationRecordId: record4.id, standardId: irradianceStandard.id, sortOrder: 0 } });
  await submitRecord(record4.id, asAuthed(techTaylor, "TECHNICIAN"));
  await openForReview(record4.id, managerAuthed);
  await approveRecord(record4.id, managerAuthed, "Looks good — all channels within tolerance.");

  // --- Task 5: HVAC PM visit — full pipeline through document generation
  //     and Calibration Control sync. Ready for a manager login to demo
  //     "Release" live.
  const record5 = await prisma.calibrationRecord.create({
    data: {
      taskId: task5.id, assetId: hvacUnit.id, procedureId: pmProcedure.id, technicianId: techTaylor.id,
      calibrationLocation: "Customer site — rooftop", purposeOfVisit: "Semi-annual preventative maintenance", serviceRequested: "Filter replacement, coil inspection, refrigerant check",
    },
  });
  const pmSection = await prisma.pMChecklistSection.create({ data: { calibrationRecordId: record5.id, name: "Inspection & Service", sortOrder: 0 } });
  await prisma.pMChecklistItem.createMany({
    data: [
      { sectionId: pmSection.id, sortOrder: 0, label: "Replace air filters", result: "PASS", notes: "Both filters replaced with MERV-13." },
      { sectionId: pmSection.id, sortOrder: 1, label: "Inspect condenser coil", result: "PASS", notes: "Cleaned, no corrosion found." },
      { sectionId: pmSection.id, sortOrder: 2, label: "Check refrigerant charge", result: "PASS", notes: "Within manufacturer spec." },
      { sectionId: pmSection.id, sortOrder: 3, label: "Test economizer damper", result: "NOT_APPLICABLE", notes: "Unit has no economizer." },
    ],
  });
  await submitRecord(record5.id, asAuthed(techTaylor, "TECHNICIAN"));
  await openForReview(record5.id, managerAuthed);
  await approveRecord(record5.id, managerAuthed, "Approved.");
  await generateCertificateForRecord(record5.id, manager.id);
  await triggerCalibrationControlSync(record5.id, managerAuthed);

  // --- Task 6: Environmental Chamber — full pipeline all the way to
  //     RELEASED, for the auditor/documents/audit-log views to have a
  //     complete example. Real-shaped data (numeric magnitudes only) from
  //     a real Parametric Environmental Chamber certificate: 3 Temperature
  //     setpoints + 4 Humidity setpoints, both in tolerance, no adjustment.
  //     See docs/DOCUMENT_ANALYSIS.md, sample 20260908.014.
  const record6 = await makeCertRecord(
    task6.id, environmentalChamber.id, tempRhProcedure.id, techTaylor.id, true,
    "Accuracy: Temperature: -20°C to 100°C: ±0.3°C temperature fluctuation plus 2.5°C temperature variation in space; >100°C to 150°C: ±0.5°C temperature fluctuation plus 4.0°C temperature variation in space; Humidity: ±5.0%RH."
  );
  await addFlatGroups(record6.id, "Calibration Data", [
    { name: "Temperature", points: [
      { rowLabel: "25°C", target: "25", unit: "°C", standardFound: "24.76", asFound: "25.0", standardLeft: "24.76", asLeft: "25.0", uncertainty: "0.0072", tolerance: "2.80", adjustment: "No" },
      { rowLabel: "35°C", target: "35", unit: "°C", standardFound: "34.80", asFound: "35.0", standardLeft: "34.80", asLeft: "35.0", uncertainty: "0.0072", tolerance: "2.80", adjustment: "No" },
      { rowLabel: "65°C", target: "65", unit: "°C", standardFound: "64.66", asFound: "65.0", standardLeft: "64.66", asLeft: "65.0", uncertainty: "0.0072", tolerance: "2.80", adjustment: "No" },
    ] },
    { name: "Humidity", points: [
      { rowLabel: "50 %RH", target: "50", unit: "%RH", standardFound: "50.21", asFound: "50", standardLeft: "50.21", asLeft: "50", uncertainty: "1.4", tolerance: "5.00", adjustment: "No" },
      { rowLabel: "65 %RH", target: "65", unit: "%RH", standardFound: "65.06", asFound: "65", standardLeft: "65.06", asLeft: "65", uncertainty: "1.5", tolerance: "5.00", adjustment: "No" },
      { rowLabel: "85 %RH", target: "85", unit: "%RH", standardFound: "85.36", asFound: "85", standardLeft: "85.36", asLeft: "85", uncertainty: "2.1", tolerance: "5.00", adjustment: "No" },
      { rowLabel: "95 %RH", target: "95", unit: "%RH", standardFound: "94.57", asFound: "95", standardLeft: "94.57", asLeft: "95", uncertainty: "2.1", tolerance: "5.00", adjustment: "No" },
    ] },
  ]);
  await prisma.calibrationStandardUsage.create({ data: { calibrationRecordId: record6.id, standardId: thermoHygroStandard.id, sortOrder: 0 } });
  await submitRecord(record6.id, asAuthed(techTaylor, "TECHNICIAN"));
  await openForReview(record6.id, managerAuthed);
  await approveRecord(record6.id, managerAuthed, "Approved.");
  await generateCertificateForRecord(record6.id, manager.id);
  await triggerCalibrationControlSync(record6.id, managerAuthed);
  await releaseRecord(record6.id, managerAuthed);

  console.log("Seed complete.");
  console.log(`Demo users (all password: ${DEMO_PASSWORD}):`);
  for (const u of [admin, manager, techJordan, techTaylor, documentation, auditor]) {
    console.log(`  ${u.email}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
