import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../auth/middleware";
import { NotFoundError, ValidationError } from "../lib/errors";
import type { Prisma } from "@prisma/client";

export const proceduresRouter = Router();
proceduresRouter.use(requireAuth);

interface FormColumn {
  key: string;
  label: string;
  type: "text" | "select";
  options?: string[];
  computed?: boolean;
}
interface FormSchema {
  kind: "measurement-flat" | "measurement-sectioned" | "checklist";
  columns?: FormColumn[];
  resultOptions?: string[];
}

/** Admin > Measurement Setup listing — every procedure that has a
 * measurement table (checklist-kind PM procedures have no "Units" column to
 * configure, so they're returned too but the UI has nothing to offer them). */
proceduresRouter.get("/", requireRole("ADMIN", "MANAGER", "AUDITOR"), async (_req, res) => {
  const procedures = await prisma.procedure.findMany({
    where: { active: true },
    include: { digitalFormTemplateRevision: true },
    orderBy: { name: "asc" },
  });
  res.json({ procedures });
});

interface UnitsBody {
  // null/omitted -> revert the Units column to free text; a non-empty list
  // -> a dropdown constrained to exactly those options (e.g. ["°C", "°F"]).
  options?: string[] | null;
}

/** Rewrites the "Units" column of a procedure's live measurement-table
 * schema in place, in the one demo-simplified revision it already has
 * (see DigitalFormTemplateRevision.status: ACTIVE_DEMO — this app doesn't
 * version form schemas the way it versions Word templates). Every record
 * using this procedure picks the change up immediately: RecordView already
 * reads formSchema.columns and renders a <select> for any column whose
 * type is "select" — see columnsFor() in web/src/components/RecordView.tsx. */
proceduresRouter.patch("/:id/units", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const body = req.body as UnitsBody;
  const options = (body.options ?? []).map((o) => o.trim()).filter(Boolean);

  const procedure = await prisma.procedure.findUnique({
    where: { id: req.params.id },
    include: { digitalFormTemplateRevision: true },
  });
  if (!procedure) throw new NotFoundError("Procedure");
  const revision = procedure.digitalFormTemplateRevision;
  if (!revision) throw new ValidationError("This procedure has no digital form template to configure");

  const schema = revision.formSchema as unknown as FormSchema;
  const columns = schema.columns ?? [];
  const unitColumnIndex = columns.findIndex((c) => c.key === "unit");
  if (unitColumnIndex === -1) {
    throw new ValidationError("This procedure's table has no Units column to configure");
  }

  const nextColumns = columns.slice();
  nextColumns[unitColumnIndex] =
    options.length > 0
      ? { ...nextColumns[unitColumnIndex], type: "select", options }
      : { key: nextColumns[unitColumnIndex].key, label: nextColumns[unitColumnIndex].label, type: "text" };
  const nextSchema: FormSchema = { ...schema, columns: nextColumns };

  await prisma.digitalFormTemplateRevision.update({
    where: { id: revision.id },
    data: { formSchema: nextSchema as unknown as Prisma.InputJsonValue },
  });

  const updatedProcedure = await prisma.procedure.findUnique({
    where: { id: req.params.id },
    include: { digitalFormTemplateRevision: true },
  });
  res.json({ procedure: updatedProcedure });
});
