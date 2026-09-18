import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../auth/middleware";
import { ValidationError, NotFoundError } from "../lib/errors";
import { recordAuditEvent } from "../lib/audit";
import { provisionCalibrationRecord } from "../services/recordProvisioning";
import { loadFullRecord } from "../services/recordSerializer";

export const intakeRouter = Router();
intakeRouter.use(requireAuth);
intakeRouter.use(requireRole("TECHNICIAN", "DOCUMENTATION", "MANAGER", "ADMIN"));

/** Dropdown data sources for the "New Calibration" intake form. All are
 * search-narrowed rather than returning full tables — the customer/asset
 * base is expected to grow into the thousands alongside calibration
 * records, so no endpoint here does an unbounded findMany. */

intakeRouter.get("/customers", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const customers = await prisma.customer.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    take: 20,
  });
  res.json({ customers });
});

intakeRouter.get("/customers/:id/sites", async (req, res) => {
  const sites = await prisma.customerSite.findMany({
    where: { customerId: req.params.id },
    orderBy: { label: "asc" },
  });
  res.json({ sites });
});

intakeRouter.get("/sites/:id/assets", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const assets = await prisma.equipmentAsset.findMany({
    where: {
      siteId: req.params.id,
      ...(q
        ? {
            OR: [
              { assetNumber: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { serialNumber: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { assetNumber: "asc" },
    take: 50,
  });
  res.json({ assets });
});

intakeRouter.get("/procedures", async (_req, res) => {
  const procedures = await prisma.procedure.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  res.json({ procedures });
});

interface NewJobBody {
  customerId?: string;
  newCustomer?: { name: string };
  siteId?: string;
  newSite?: { label: string; addressLine1: string; addressLine2?: string; city: string; state: string; zip: string };
  assetId?: string;
  newAsset?: {
    assetNumber: string;
    description: string;
    manufacturer: string;
    model: string;
    serialNumber: string;
    accuracy: string;
    range: string;
    calibrationIntervalMonths: number;
  };
  procedureId: string;
  scheduledDate: string;
}

/** Creates a WorkOrder + CalibrationTask + a blank CalibrationRecord in one
 * shot, resolving (or creating) the customer/site/asset along the way, then
 * hands the technician straight into the same job-detail screen used for
 * pre-assigned work — see server/src/routes/jobs.ts's /:taskId. */
intakeRouter.post("/jobs", async (req, res) => {
  const body = req.body as NewJobBody;
  if (!body.procedureId) throw new ValidationError("A procedure is required");
  if (!body.scheduledDate || Number.isNaN(Date.parse(body.scheduledDate))) {
    throw new ValidationError("A valid scheduled date is required");
  }
  if (!body.customerId && !body.newCustomer?.name?.trim()) {
    throw new ValidationError("Select an existing customer or provide a new customer name");
  }
  if (!body.siteId && !body.newSite) {
    throw new ValidationError("Select an existing site or provide a new site address");
  }
  if (!body.assetId && !body.newAsset) {
    throw new ValidationError("Select an existing asset or provide new asset details");
  }
  if (body.newAsset) {
    const required: (keyof NonNullable<NewJobBody["newAsset"]>)[] = [
      "assetNumber",
      "description",
      "manufacturer",
      "model",
      "serialNumber",
      "accuracy",
      "range",
    ];
    for (const key of required) {
      if (!String(body.newAsset[key] ?? "").trim()) throw new ValidationError(`Asset field "${key}" is required`);
    }
    if (!Number.isInteger(body.newAsset.calibrationIntervalMonths) || body.newAsset.calibrationIntervalMonths <= 0) {
      throw new ValidationError("Calibration interval must be a positive whole number of months");
    }
  }

  const taskId = await prisma.$transaction(async (tx) => {
    let customerId = body.customerId;
    if (!customerId) {
      const customer = await tx.customer.create({ data: { name: body.newCustomer!.name.trim() } });
      customerId = customer.id;
    } else {
      const exists = await tx.customer.findUnique({ where: { id: customerId } });
      if (!exists) throw new NotFoundError("Customer");
    }

    let siteId = body.siteId;
    if (!siteId) {
      const s = body.newSite!;
      const site = await tx.customerSite.create({
        data: {
          customerId,
          label: s.label.trim(),
          addressLine1: s.addressLine1.trim(),
          addressLine2: s.addressLine2?.trim() || null,
          city: s.city.trim(),
          state: s.state.trim(),
          zip: s.zip.trim(),
        },
      });
      siteId = site.id;
    } else {
      const site = await tx.customerSite.findUnique({ where: { id: siteId } });
      if (!site || site.customerId !== customerId) throw new ValidationError("Selected site does not belong to the selected customer");
    }

    let assetId = body.assetId;
    if (!assetId) {
      const a = body.newAsset!;
      const asset = await tx.equipmentAsset.create({
        data: {
          customerId,
          siteId,
          assetNumber: a.assetNumber.trim(),
          description: a.description.trim(),
          manufacturer: a.manufacturer.trim(),
          model: a.model.trim(),
          serialNumber: a.serialNumber.trim(),
          accuracy: a.accuracy.trim(),
          range: a.range.trim(),
          calibrationIntervalMonths: a.calibrationIntervalMonths,
          defaultProcedureId: body.procedureId,
        },
      });
      assetId = asset.id;
    } else {
      const asset = await tx.equipmentAsset.findUnique({ where: { id: assetId } });
      if (!asset || asset.customerId !== customerId || asset.siteId !== siteId) {
        throw new ValidationError("Selected asset does not belong to the selected customer/site");
      }
    }

    const procedure = await tx.procedure.findUnique({ where: { id: body.procedureId } });
    if (!procedure || !procedure.active) throw new ValidationError("Selected procedure is not available");

    const workOrder = await tx.workOrder.create({
      data: { customerId, siteId, scheduledDate: new Date(body.scheduledDate), createdByUserId: req.user!.id },
    });
    const task = await tx.calibrationTask.create({
      data: {
        workOrderId: workOrder.id,
        assetId,
        procedureId: body.procedureId,
        assignedTechnicianId: req.user!.id,
        scheduledDate: new Date(body.scheduledDate),
      },
    });
    await provisionCalibrationRecord(tx, { taskId: task.id, assetId, procedureId: body.procedureId, technicianId: req.user!.id });

    await recordAuditEvent(tx, {
      userId: req.user!.id,
      eventType: "JOB_CREATED",
      entityType: "CalibrationTask",
      entityId: task.id,
      summary: `${req.user!.fullName} started a new calibration job`,
    });

    return task.id;
  });

  const record = await prisma.calibrationTask.findUniqueOrThrow({ where: { id: taskId }, select: { calibrationRecord: { select: { id: true } } } });
  res.status(201).json({ taskId, record: await loadFullRecord(record.calibrationRecord!.id) });
});
