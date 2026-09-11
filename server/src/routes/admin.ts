import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../auth/middleware";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN", "AUDITOR"));

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({ include: { role: true }, orderBy: { email: "asc" } });
  res.json({ users: users.map((u) => ({ id: u.id, email: u.email, fullName: u.fullName, role: u.role.name, active: u.active })) });
});

adminRouter.get("/customers", async (_req, res) => {
  const customers = await prisma.customer.findMany({ include: { sites: true, contacts: true, assets: true } });
  res.json({ customers });
});

adminRouter.get("/assets", async (_req, res) => {
  const assets = await prisma.equipmentAsset.findMany({
    include: { customer: true, site: true, defaultProcedure: true },
    orderBy: { assetNumber: "asc" },
  });
  res.json({ assets });
});
