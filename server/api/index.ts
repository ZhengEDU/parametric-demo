import type { VercelRequest, VercelResponse } from "@vercel/node";
import { app } from "../src/app";

// Vercel serverless entrypoint. vercel.json rewrites every request to this
// function; Express's `app` is itself a valid (req, res) => void handler,
// so no adapter library is needed — this file only exists because Vercel
// requires something under api/ to route to, not because the Express app
// needs wrapping.
export default function handler(req: VercelRequest, res: VercelResponse) {
  app(req as never, res as never);
}
