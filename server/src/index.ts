import { app } from "./app";

// Local-dev-only entrypoint — binds a port. The deployed (Vercel) entrypoint
// is api/index.ts, which imports the same `app` but never calls listen().
const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Parametric demo API listening on :${port}`);
  // eslint-disable-next-line no-console
  console.log("DEVELOPMENT DEMO — NOT VALIDATED FOR PRODUCTION CALIBRATION USE");
});
