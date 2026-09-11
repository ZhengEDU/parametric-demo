import jwt, { type Secret } from "jsonwebtoken";

const envSecret = process.env.JWT_SECRET;
if (!envSecret) {
  throw new Error("JWT_SECRET is not set. Copy server/.env.example to server/.env first.");
}
const SECRET: Secret = envSecret;

export interface TokenPayload {
  userId: string;
  role: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "8h" });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as unknown as TokenPayload;
}
