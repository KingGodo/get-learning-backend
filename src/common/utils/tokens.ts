import jwt from "jsonwebtoken";
import type { UserRole } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";

export type JwtPayload = {
  userId: string;
  role: UserRole;
  schoolId: string | null;
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
