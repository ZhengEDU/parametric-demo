import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../auth/middleware";
import { ValidationError, ConflictError, NotFoundError } from "../lib/errors";

export const standardsRouter = Router();
standardsRouter.use(requireAuth);

/** Admin's full view of the reference-standard fleet (active and retired) —
 * distinct from GET /calibrations/reference-standards, which only returns
 * `active: true` standards for the record-editing "Standards Utilized"
 * picker. Retired standards still need to show up here so their calDue
 * history/usages remain visible even after they're taken out of service. */
standardsRouter.get("/", requireRole("ADMIN", "AUDITOR"), async (_req, res) => {
  const standards = await prisma.referenceStandard.findMany({ orderBy: { idNumber: "asc" } });
  res.json({ standards });
});

interface NewStandardBody {
  idNumber: string;
  manufacturer: string;
  model: string;
  description: string;
  calDue: string;
}

standardsRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const body = req.body as NewStandardBody;
  const idNumber = body.idNumber?.trim();
  const manufacturer = body.manufacturer?.trim();
  const model = body.model?.trim();
  const description = body.description?.trim();
  if (!idNumber) throw new ValidationError("ID number is required");
  if (!manufacturer) throw new ValidationError("Manufacturer is required");
  if (!model) throw new ValidationError("Model is required");
  if (!description) throw new ValidationError("Description is required");
  if (!body.calDue || Number.isNaN(Date.parse(body.calDue))) throw new ValidationError("A valid calibration due date is required");

  let created;
  try {
    created = await prisma.referenceStandard.create({
      data: { idNumber, manufacturer, model, description, calDue: new Date(body.calDue) },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError(`ID number ${idNumber} is already in use`);
    }
    throw err;
  }
  res.status(201).json({ standard: created });
});

interface UpdateStandardBody {
  calDue?: string;
  active?: boolean;
}

/** Admin-only correction/retirement path — never a DELETE, because a
 * standard already cited on a submitted record (CalibrationStandardUsage,
 * onDelete: Restrict) must keep existing there for traceability. Recalling
 * one from service is "set active: false", not removing the row. */
standardsRouter.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const body = req.body as UpdateStandardBody;
  const existing = await prisma.referenceStandard.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new NotFoundError("ReferenceStandard");

  const data: Prisma.ReferenceStandardUpdateInput = {};
  if (body.calDue !== undefined) {
    if (Number.isNaN(Date.parse(body.calDue))) throw new ValidationError("A valid calibration due date is required");
    data.calDue = new Date(body.calDue);
  }
  if (body.active !== undefined) data.active = body.active;

  const updated = await prisma.referenceStandard.update({ where: { id: req.params.id }, data });
  res.json({ standard: updated });
});
