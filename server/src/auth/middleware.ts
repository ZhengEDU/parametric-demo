import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { verifyToken } from "./jwt";
import { ForbiddenError } from "../lib/errors";
import type { RoleName } from "@prisma/client";

export interface AuthedUser {
  id: string;
  email: string;
  fullName: string;
  role: RoleName;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.session;
    if (!token) throw new ForbiddenError("Not authenticated");
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });
    if (!user || !user.active) throw new ForbiddenError("Not authenticated");
    req.user = { id: user.id, email: user.email, fullName: user.fullName, role: user.role.name };
    next();
  } catch {
    res.status(401).json({ error: "UNAUTHENTICATED", message: "Please log in" });
  }
}

export function requireRole(...roles: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "UNAUTHENTICATED", message: "Please log in" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "FORBIDDEN", message: `Requires role: ${roles.join(" or ")}` });
      return;
    }
    next();
  };
}

/**
 * Lightweight CSRF mitigation for the demo: mutating requests must carry
 * this custom header. A cross-site <form> POST cannot set a custom
 * header, and the browser's CORS preflight for a fetch() that sets one
 * only succeeds if our CORS origin allowlist (server/src/index.ts) allows
 * it. Combined with the session cookie's SameSite=Lax. See docs/SECURITY.md
 * for why this is demo-appropriate but not a full CSRF solution.
 */
export function requireDemoCsrfHeader(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  if (req.headers["x-parametric-demo-client"] !== "1") {
    res.status(403).json({ error: "FORBIDDEN", message: "Missing required client header" });
    return;
  }
  next();
}
