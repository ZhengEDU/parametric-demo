import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../auth/middleware";
import { ValidationError, ConflictError } from "../lib/errors";

export const equipmentModelsRouter = Router();
equipmentModelsRouter.use(requireAuth);

/** Uppercases and strips everything but letters/digits, so "A01-000X",
 * "a01 000x", and "A01000X" all normalize to the same "A01000X" — lets a
 * tech's typing match a catalog entry regardless of how its dashes/spacing
 * were originally keyed in. */
export function normalizeModelText(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Search-narrowed catalog lookup for the New Calibration intake form's
 * model typeahead — readable by anyone who can start a job, not just admins,
 * since this is what powers the tech-facing autofill. */
equipmentModelsRouter.get("/", requireRole("TECHNICIAN", "DOCUMENTATION", "MANAGER", "ADMIN", "AUDITOR"), async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const normalized = normalizeModelText(q);
  const models = await prisma.equipmentModel.findMany({
    where: q
      ? {
          OR: [
            { modelNormalized: { contains: normalized } },
            { manufacturer: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { defaultProcedure: true },
    orderBy: [{ manufacturer: "asc" }, { model: "asc" }],
    take: 20,
  });
  res.json({ models });
});

interface NewModelBody {
  manufacturer: string;
  model: string;
  description?: string;
  accuracy?: string;
  range?: string;
  calibrationIntervalMonths?: number;
  defaultProcedureId?: string;
}

/** Admin-curated catalog entry (Admin > Models is the only screen that
 * exposes this) — this is what New Calibration's "add a new asset" typeahead
 * draws its suggestions from, so keeping it gated rather than letting every
 * tech free-add entries keeps the catalog from accumulating one-off typos. */
equipmentModelsRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const body = req.body as NewModelBody;
  const manufacturer = body.manufacturer?.trim();
  const model = body.model?.trim();
  if (!manufacturer) throw new ValidationError("Manufacturer is required");
  if (!model) throw new ValidationError("Model is required");
  if (
    body.calibrationIntervalMonths != null &&
    (!Number.isInteger(body.calibrationIntervalMonths) || body.calibrationIntervalMonths <= 0)
  ) {
    throw new ValidationError("Calibration interval must be a positive whole number of months");
  }
  if (body.defaultProcedureId) {
    const procedure = await prisma.procedure.findUnique({ where: { id: body.defaultProcedureId } });
    if (!procedure || !procedure.active) throw new ValidationError("Selected default procedure is not available");
  }

  let created;
  try {
    created = await prisma.equipmentModel.create({
      data: {
        manufacturer,
        model,
        modelNormalized: normalizeModelText(model),
        description: body.description?.trim() || null,
        accuracy: body.accuracy?.trim() || null,
        range: body.range?.trim() || null,
        calibrationIntervalMonths: body.calibrationIntervalMonths ?? null,
        defaultProcedureId: body.defaultProcedureId || null,
      },
      include: { defaultProcedure: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError(`${manufacturer} / ${model} is already in the catalog`);
    }
    throw err;
  }
  res.status(201).json({ model: created });
});

equipmentModelsRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  await prisma.equipmentModel.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
