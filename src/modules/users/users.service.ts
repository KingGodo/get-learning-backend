import { UserRole } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { prisma } from "../../config/prisma.js";

const userListSelect = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  gender: true,
  role: true,
  status: true,
  schoolId: true,
  lastLogin: true,
  createdAt: true,
  school: { select: { id: true, name: true, code: true } },
  teacher: {
    select: {
      id: true,
      employeeNumber: true,
      department: true,
      qualification: true,
    },
  },
  student: {
    select: {
      id: true,
      studentNumber: true,
      guardianName: true,
    },
  },
} as const;

export async function listUsers(role: UserRole, filters?: { role?: string; q?: string }) {
  if (role !== UserRole.ADMIN) {
    throw new AppError("Only system admins can list users", 403);
  }

  const q = filters?.q?.trim();
  const roleFilter =
    filters?.role && ["ADMIN", "TEACHER", "STUDENT"].includes(filters.role)
      ? (filters.role as UserRole)
      : undefined;

  return prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phoneNumber: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: userListSelect,
  });
}

export async function getUserById(requesterRole: UserRole, id: string) {
  if (requesterRole !== UserRole.ADMIN) {
    throw new AppError("Only system admins can view user details", 403);
  }

  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      gender: true,
      dateOfBirth: true,
      role: true,
      status: true,
      schoolId: true,
      emailVerified: true,
      phoneVerified: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
      school: true,
      teacher: true,
      student: {
        include: {
          classStudents: {
            where: { status: "ACTIVE" },
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                  classCode: true,
                  status: true,
                  subject: { select: { name: true, code: true } },
                },
              },
            },
          },
          _count: { select: { submissions: true } },
        },
      },
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Teacher class links if applicable
  if (user.teacher) {
    const classTeachers = await prisma.classTeacher.findMany({
      where: { teacherId: user.teacher.id },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            classCode: true,
            status: true,
            subject: { select: { name: true, code: true } },
            _count: { select: { classStudents: true, assignments: true } },
          },
        },
      },
    });
    return { ...user, teacher: { ...user.teacher, classTeachers } };
  }

  return user;
}
