import type { UserRole } from "../../generated/prisma/client.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: UserRole;
        schoolId: string | null;
      };
    }
  }
}

export {};
