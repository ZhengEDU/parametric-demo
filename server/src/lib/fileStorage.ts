import fs from "fs";
import path from "path";
import { put, get } from "@vercel/blob";

/**
 * Generated certificates and uploaded legacy scans need to survive between
 * requests — fine with a local disk write in dev, but Vercel's serverless
 * functions have no persistent filesystem (writes vanish after the
 * invocation ends). This picks Vercel Blob when BLOB_READ_WRITE_TOKEN is
 * configured (i.e. when deployed) and otherwise falls back to local disk,
 * so `npm run dev` keeps working with zero setup. Callers only ever see an
 * opaque storageRef string — never branch on which backend is active.
 */
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_ROOT = path.join(__dirname, "..", "..", "storage");

export async function writeFile(subdir: string, filename: string, buffer: Buffer, contentType?: string): Promise<string> {
  if (useBlob) {
    const result = await put(`${subdir}/${filename}`, buffer, { access: "private", contentType, addRandomSuffix: false });
    return `blob:${result.pathname}`;
  }
  const dir = path.join(LOCAL_ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, buffer);
  return fullPath;
}

export async function readFile(storageRef: string, subdir: string): Promise<Buffer> {
  if (storageRef.startsWith("blob:")) {
    const pathname = storageRef.slice("blob:".length);
    const result = await get(pathname, { access: "private" });
    if (!result) throw new Error(`Blob not found: ${pathname}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await new Response(result.stream as any).arrayBuffer();
    return Buffer.from(buffer);
  }
  // storageRef values only ever come from writeFile() above (callers look
  // these up server-side by DB id, never accept a path from the client —
  // this check is defense in depth, not the primary guard).
  const resolved = path.resolve(storageRef);
  const allowedRoot = path.resolve(LOCAL_ROOT, subdir);
  if (!resolved.startsWith(allowedRoot)) {
    throw new Error("Refusing to read outside the storage directory");
  }
  return fs.readFileSync(resolved);
}
