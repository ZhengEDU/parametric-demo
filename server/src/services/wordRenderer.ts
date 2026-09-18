import fs from "fs";
import crypto from "crypto";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { writeFile, readFile } from "../lib/fileStorage";

/**
 * DocumentRenderer (Section 32): business logic hands this a plain JSON
 * view model; this module knows nothing about CalibrationRecord, Prisma,
 * or any business concept — it only knows how to run docxtemplater
 * against a template file and return bytes + a hash. See
 * docs/WORD_TEMPLATE_ENGINE.md for how the templates themselves were
 * built and validated.
 */
export interface RenderResult {
  buffer: Buffer;
  sha256: string;
}

export function renderWordTemplate(templateFilePath: string, data: Record<string, unknown>): RenderResult {
  const content = fs.readFileSync(templateFilePath, "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(data);
  const buffer = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  return { buffer, sha256 };
}

const SUBDIR = "generated";
const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function persistGeneratedDocument(buffer: Buffer, suggestedFilename: string): Promise<{ storagePath: string; filename: string }> {
  const safeName = `${crypto.randomUUID()}-${suggestedFilename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const storagePath = await writeFile(SUBDIR, safeName, buffer, DOCX_CONTENT_TYPE);
  return { storagePath, filename: suggestedFilename };
}

export async function readGeneratedDocument(storagePath: string): Promise<Buffer> {
  // storagePath values are only ever ones this module itself wrote
  // (never derived from user input — see routes/documents.ts, which looks
  // up storagePath by GeneratedDocument.id, not by accepting a path).
  return readFile(storagePath, SUBDIR);
}
