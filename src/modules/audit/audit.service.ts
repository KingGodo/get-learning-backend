import { UserRole } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { canViewSchoolWide } from "../../common/utils/roles.js";
import { prisma } from "../../config/prisma.js";
import type { ListAuditQuery } from "./audit.schema.js";

export async function listAuditLogs(
  role: UserRole,
  schoolId: string | null,
  query: ListAuditQuery,
) {
  if (!canViewSchoolWide(role)) {
    throw new AppError("You do not have permission to view audit logs", 403);
  }

  const where: {
    schoolId?: string | null;
    action?: string;
    entityType?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = {};

  if (role === UserRole.ADMIN) {
    // platform admin sees all schools
  } else {
    if (!schoolId) {
      throw new AppError("School context required", 400);
    }
    where.schoolId = schoolId;
  }

  if (query.action) where.action = query.action;
  if (query.entityType) where.entityType = query.entityType;

  const createdAt: { gte?: Date; lte?: Date } = {};
  if (query.from) {
    const from = new Date(query.from);
    if (!Number.isNaN(from.getTime())) createdAt.gte = from;
  }
  if (query.to) {
    const to = new Date(query.to);
    if (!Number.isNaN(to.getTime())) createdAt.lte = to;
  }
  if (createdAt.gte || createdAt.lte) {
    where.createdAt = createdAt;
  }

  const page = query.page;
  const pageSize = query.pageSize;
  const skip = (page - 1) * pageSize;

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        school: {
          select: { id: true, name: true, code: true },
        },
      },
    }),
  ]);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
