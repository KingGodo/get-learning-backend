import type { Prisma, UserRole } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";

export type WriteAuditInput = {
  schoolId?: string | null;
  actorUserId?: string | null;
  actorRole: UserRole | string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
};

/** Best effort audit write. Never throws to callers. */
export async function writeAuditLog(input: WriteAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        schoolId: input.schoolId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorRole: String(input.actorRole),
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadata: input.metadata ?? undefined,
        ip: input.ip ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write log", error);
  }
}

export function clientIp(req: {
  ip?: string;
  headers: { [key: string]: string | string[] | undefined };
}) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(",")[0]?.trim() || null;
  }
  return req.ip ?? null;
}
