import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import { authRouter } from "./routes/auth";
import { jobsRouter } from "./routes/jobs";
import { calibrationsRouter } from "./routes/calibrations";
import { reviewRouter } from "./routes/review";
import { documentsRouter } from "./routes/documents";
import { syncRouter } from "./routes/sync";
import { templatesRouter } from "./routes/templates";
import { auditRouter } from "./routes/audit";
import { dashboardRouter } from "./routes/dashboard";
import { adminRouter } from "./routes/admin";
import { requireDemoCsrfHeader } from "./auth/middleware";
import { AppError } from "./lib/errors";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(requireDemoCsrfHeader);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, notice: "DEVELOPMENT DEMO — NOT VALIDATED FOR PRODUCTION CALIBRATION USE" });
});

app.use("/api/auth", authRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/calibrations", calibrationsRouter);
app.use("/api/review", reviewRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/sync", syncRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/audit", auditRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/admin", adminRouter);

app.use((req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` });
});

// Centralized error handler — every route above can just `throw` or let a
// rejected promise propagate (routes are wrapped by express-async-errors-
// style handling via the try/catch inside each service call site); this
// keeps error shape consistent everywhere.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: "INTERNAL_ERROR", message: "Something went wrong" });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Parametric demo API listening on :${port}`);
  // eslint-disable-next-line no-console
  console.log("DEVELOPMENT DEMO — NOT VALIDATED FOR PRODUCTION CALIBRATION USE");
});

void path; // reserved for future static-file serving of the built frontend
