import fs from "fs";
import path from "path";
import crypto from "crypto";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

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

const STORAGE_DIR = path.join(__dirname, "..", "..", "storage", "generated");

export function persistGeneratedDocument(buffer: Buffer, suggestedFilename: string): { storagePath: string; filename: string } {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  const safeName = `${crypto.randomUUID()}-${suggestedFilename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const fullPath = path.join(STORAGE_DIR, safeName);
  fs.writeFileSync(fullPath, buffer);
  return { storagePath: fullPath, filename: suggestedFilename };
}

export function readGeneratedDocument(storagePath: string): Buffer {
  // storagePath values are only ever ones this module itself wrote
  // (never derived from user input — see routes/documents.ts, which looks
  // up storagePath by GeneratedDocument.id, not by accepting a path).
  const resolved = path.resolve(storagePath);
  if (!resolved.startsWith(path.resolve(STORAGE_DIR))) {
    throw new Error("Refusing to read outside the generated-documents storage directory");
  }
  return fs.readFileSync(resolved);
}
