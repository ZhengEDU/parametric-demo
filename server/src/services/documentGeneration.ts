import { prisma } from "../lib/prisma";
import { NotFoundError, ValidationError } from "../lib/errors";
import { recordAuditEvent } from "../lib/audit";
import { assertTransition } from "./workflowStateMachine";
import { renderWordTemplate, persistGeneratedDocument } from "./wordRenderer";
import {
  buildFlatGroupsViewModel,
  buildSectionedGroupsViewModel,
  buildChecklistViewModel,
  type CommonRecordFields,
  type SectionRecord,
} from "./wordViewModels";
import path from "path";
import { addMonths } from "../lib/dates";

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" }).replace(" ", "");
}
function formatDDMonYYYY(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleDateString("en-US", { month: "short" });
  return `${day}${mon}${d.getFullYear()}`;
}
function formatYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
/**
 * Real Parametric certificate numbers are `{calibration date, YYYYMMDD}.
 * {global sequence, zero-padded to 3+ digits}` — confirmed across all 7
 * real certificates in samples/word-documents/ (e.g. "20260806.009" and
 * "20260806.010" on the same day, "20260817.003" on another). This counts
 * documents generated so far as a best-effort sequence — good enough for
 * this demo's single-actor "Generate Document" flow, but not a strictly
 * concurrency-safe atomic counter (a real implementation would use a DB
 * sequence). See docs/ASSUMPTIONS.md.
 */
async function nextCertificateNumber(calibrationDate: Date): Promise<string> {
  const seq = (await prisma.generatedDocument.count()) + 1;
  return `${formatYYYYMMDD(calibrationDate)}.${String(seq).padStart(3, "0")}`;
}

/** Shared render pipeline for both the real post-approval "Generate
 * Document" action and the pre-submission preview a technician can pull up
 * for themselves — same template, same data, so what the tech confirms is
 * exactly what a manager's later "Generate Document" will produce (modulo
 * the certificate number, which preview never allocates). */
async function renderCertificateBuffer(recordId: string, certificateNumber: string) {
  const record = await prisma.calibrationRecord.findUnique({
    where: { id: recordId },
    include: {
      asset: { include: { customer: true, site: true } },
      procedure: { include: { outputWordTemplateRevision: true } },
      technician: true,
      measurementSections: {
        orderBy: { sortOrder: "asc" },
        include: { groups: { orderBy: { sortOrder: "asc" }, include: { points: { orderBy: { sortOrder: "asc" } } } } },
      },
      pmChecklistSections: { orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" } } } },
      environmentalObservations: true,
      standardUsages: { include: { standard: true }, orderBy: { sortOrder: "asc" } },
      approval: { include: { approvedBy: true } },
    },
  });
  if (!record) throw new NotFoundError("CalibrationRecord");
  const templateRevision = record.procedure.outputWordTemplateRevision;
  if (!templateRevision) throw new ValidationError("Procedure has no active Word template revision configured");

  const calibrationDate = record.submittedAt ?? record.createdAt;

  const common: CommonRecordFields = {
    certificateNumber,
    assetNumber: record.asset.assetNumber,
    customerName: record.asset.customer.name,
    assetDescription: record.asset.description,
    customerAddressLine1: record.asset.site.addressLine1,
    assetManufacturer: record.asset.manufacturer,
    customerAddressLine2: record.asset.site.addressLine2 ?? "",
    assetModel: record.asset.model,
    customerCityStateZip: `${record.asset.site.city}, ${record.asset.site.state} ${record.asset.site.zip}`,
    assetSerialNumber: record.asset.serialNumber,
    customerContact: "",
    assetAccuracy: record.asset.accuracy,
    customerPhone: "",
    assetRange: record.asset.range,
    calibrationDateDisplay: formatDDMonYYYY(calibrationDate),
    procedureName: record.procedure.name,
    calibrationNextDueDisplay: formatMonthYear(addMonths(calibrationDate, record.asset.calibrationIntervalMonths)),
    calibrationIntervalDisplay: `${record.asset.calibrationIntervalMonths} Months`,
    calibrationLocation: record.calibrationLocation ?? "",
    comments: record.comments ?? "",
    environment: record.environmentalObservations.map((e) => ({
      parameter: e.parameter,
      displayValue: `${e.displayValue ?? ""}`,
      asFoundStatus: e.asFoundStatus,
      asLeftStatus: e.asLeftStatus,
      finalStatus: e.finalStatus,
    })),
    standards: record.standardUsages.map((u) => ({
      idNumber: u.standard.idNumber,
      manufacturer: u.standard.manufacturer,
      model: u.standard.model,
      description: u.standard.description,
      calDueDisplay: formatMonthYear(u.standard.calDue),
    })),
  };

  const primaryContact = await prisma.customerContact.findFirst({ where: { customerId: record.asset.customerId } });
  common.customerContact = primaryContact?.name ?? "";
  common.customerPhone = primaryContact?.phone ?? "";

  const sections: SectionRecord[] = record.measurementSections.map((s) => ({
    name: s.name,
    groups: s.groups.map((g) => ({
      name: g.name,
      points: g.points.map((p) => ({ rowLabel: p.rowLabel, values: p.values as Record<string, unknown> as never })),
    })),
  }));

  let data: Record<string, unknown>;
  switch (record.procedure.rendererKey) {
    case "weight-set":
      data = buildFlatGroupsViewModel(common, sections, { includeUncertainty: false });
      break;
    case "temp-rh-meter":
      data = buildFlatGroupsViewModel(common, sections, { includeUncertainty: true });
      break;
    case "weathering-tester":
      data = buildSectionedGroupsViewModel(common, sections);
      break;
    case "preventative-maintenance":
      data = buildChecklistViewModel(
        common,
        record.pmChecklistSections.map((s) => ({
          name: s.name,
          items: s.items.map((i) => ({ label: i.label, result: i.result, notes: i.notes })),
        })),
        { purposeOfVisit: record.purposeOfVisit ?? "", serviceRequested: record.serviceRequested ?? "" }
      );
      break;
    default:
      throw new ValidationError(`Unknown rendererKey: ${record.procedure.rendererKey}`);
  }

  const templateFilePath = path.resolve(__dirname, "..", "..", templateRevision.storagePath);
  const renderResult = renderWordTemplate(templateFilePath, data);

  return { record, templateRevision, renderResult, rendererKey: record.procedure.rendererKey };
}

/** Manager-facing, post-approval action: renders the certificate, persists
 * it as a GeneratedDocument, and advances the workflow state. */
export async function generateCertificateForRecord(recordId: string, generatedByUserId: string) {
  const preRecord = await prisma.calibrationRecord.findUniqueOrThrow({ where: { id: recordId } });
  const toState = assertTransition(preRecord.status, "GENERATE_DOCUMENT");
  const calibrationDate = preRecord.submittedAt ?? preRecord.createdAt;
  const certificateNumber = await nextCertificateNumber(calibrationDate);

  let built;
  try {
    built = await renderCertificateBuffer(recordId, certificateNumber);
  } catch (err) {
    // Fail closed (Section 42 self-review): a failed render must not
    // advance workflow state or create a GeneratedDocument row.
    await recordAuditEvent(prisma, {
      userId: generatedByUserId,
      eventType: "DOCUMENT_GENERATION_FAILED",
      entityType: "CalibrationRecord",
      entityId: recordId,
      summary: `Word document generation failed for record ${recordId}`,
      details: { message: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
  const { record, templateRevision, renderResult, rendererKey } = built;

  const filename = `${rendererKey}-${certificateNumber}.docx`;
  const { storagePath } = await persistGeneratedDocument(renderResult.buffer, filename);

  const [generatedDocument] = await prisma.$transaction([
    prisma.generatedDocument.create({
      data: {
        calibrationRecordId: record.id,
        wordTemplateRevisionId: templateRevision.id,
        generatedByUserId,
        filename,
        sha256: renderResult.sha256,
        storagePath,
        status: "GENERATED",
      },
    }),
    prisma.calibrationRecord.update({ where: { id: record.id }, data: { status: toState } }),
    prisma.auditEvent.create({
      data: {
        userId: generatedByUserId,
        eventType: "DOCUMENT_GENERATED",
        entityType: "CalibrationRecord",
        entityId: record.id,
        summary: `Generated ${filename} (sha256 ${renderResult.sha256.slice(0, 12)}…)`,
        detailsJson: { sha256: renderResult.sha256, filename, templateRevisionId: templateRevision.id },
      },
    }),
  ]);

  return generatedDocument;
}

/** Technician-facing, pre-submission preview: same renderer and template,
 * no certificate number allocated, nothing written to the database or the
 * workflow state — safe to call repeatedly from DRAFT. */
export async function previewCertificateForRecord(recordId: string) {
  const { renderResult, rendererKey } = await renderCertificateBuffer(recordId, "PREVIEW — NOT YET ISSUED");
  return { buffer: renderResult.buffer, filename: `${rendererKey}-preview.docx` };
}
