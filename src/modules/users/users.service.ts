import bcrypt from "bcrypt";
import { UserRole, UserStatus } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import {
  newEmployeeNumber,
  newStudentNumber,
  newTemporaryPassword,
} from "../../common/utils/codes.js";
import { prisma } from "../../config/prisma.js";
import type {
  CreateStudentInput,
  CreateTeacherInput,
  UpdateUserStatusInput,
} from "./users.schema.js";

const MANAGEABLE_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.STUDENT];

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
  mustChangePassword: true,
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

function sanitizeUser<T extends { password: string }>(user: T) {
  const { password: _password, ...safe } = user;
  return safe;
}

function assertCanManageUsers(role: UserRole) {
  if (role !== UserRole.ADMIN && role !== UserRole.SCHOOL_ADMIN) {
    throw new AppError("You do not have permission to manage users", 403);
  }
}

async function resolveTargetSchoolId(
  requesterRole: UserRole,
  requesterSchoolId: string | null,
  requestedSchoolId?: string,
) {
  if (requesterRole === UserRole.SCHOOL_ADMIN) {
    if (!requesterSchoolId) {
      throw new AppError("No school associated with this account", 400);
    }
    return requesterSchoolId;
  }

  // Platform ADMIN
  if (!requestedSchoolId) {
    throw new AppError("schoolId is required when creating users as a system admin", 400);
  }

  const school = await prisma.school.findUnique({
    where: { id: requestedSchoolId },
  });
  if (!school) {
    throw new AppError("School not found", 404);
  }
  if (school.status !== "ACTIVE") {
    throw new AppError("This school is not active", 400);
  }

  return school.id;
}

async function assertCanAccessUser(
  requesterRole: UserRole,
  requesterSchoolId: string | null,
  target: { role: UserRole; schoolId: string | null },
) {
  if (requesterRole === UserRole.ADMIN) {
    return;
  }

  if (requesterRole !== UserRole.SCHOOL_ADMIN) {
    throw new AppError("You do not have permission to view this user", 403);
  }

  if (!requesterSchoolId || target.schoolId !== requesterSchoolId) {
    throw new AppError("User not found", 404);
  }

  // School admins manage teachers/students; they may also view other school admins.
  if (
    target.role !== UserRole.TEACHER &&
    target.role !== UserRole.STUDENT &&
    target.role !== UserRole.SCHOOL_ADMIN
  ) {
    throw new AppError("User not found", 404);
  }
}

export async function listUsers(
  requesterRole: UserRole,
  requesterSchoolId: string | null,
  filters?: { role?: string; q?: string },
) {
  assertCanManageUsers(requesterRole);

  if (requesterRole === UserRole.SCHOOL_ADMIN && !requesterSchoolId) {
    throw new AppError("No school associated with this account", 400);
  }

  const allowedRoleFilters =
    requesterRole === UserRole.ADMIN
      ? ["ADMIN", "SCHOOL_ADMIN", "TEACHER", "STUDENT"]
      : ["SCHOOL_ADMIN", "TEACHER", "STUDENT"];

  const q = filters?.q?.trim();
  const roleFilter =
    filters?.role && allowedRoleFilters.includes(filters.role)
      ? (filters.role as UserRole)
      : undefined;

  return prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(requesterRole === UserRole.SCHOOL_ADMIN
        ? {
            schoolId: requesterSchoolId!,
            role: roleFilter
              ? roleFilter
              : { in: [UserRole.SCHOOL_ADMIN, UserRole.TEACHER, UserRole.STUDENT] },
          }
        : roleFilter
          ? { role: roleFilter }
          : {}),
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

export async function getUserById(
  requesterRole: UserRole,
  requesterSchoolId: string | null,
  id: string,
) {
  assertCanManageUsers(requesterRole);

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
      mustChangePassword: true,
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

  await assertCanAccessUser(requesterRole, requesterSchoolId, user);

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

export async function createTeacher(
  requesterRole: UserRole,
  requesterSchoolId: string | null,
  input: CreateTeacherInput,
) {
  assertCanManageUsers(requesterRole);

  const schoolId = await resolveTargetSchoolId(
    requesterRole,
    requesterSchoolId,
    input.schoolId,
  );

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError("Email is already registered", 409);
  }

  const temporaryPassword = input.password ?? newTemporaryPassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        schoolId,
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        email: input.email,
        phoneNumber: input.phoneNumber,
        password: hashedPassword,
        gender: input.gender,
        role: UserRole.TEACHER,
        mustChangePassword: true,
        status: UserStatus.ACTIVE,
      },
    });

    const teacher = await tx.teacher.create({
      data: {
        userId: user.id,
        employeeNumber: newEmployeeNumber(),
        department: input.department,
        qualification: input.qualification,
      },
    });

    return { user, teacher };
  });

  return {
    user: sanitizeUser(result.user),
    teacher: result.teacher,
    credentials: {
      email: result.user.email,
      temporaryPassword,
      mustChangePassword: true,
    },
  };
}

export async function createStudent(
  requesterRole: UserRole,
  requesterSchoolId: string | null,
  input: CreateStudentInput,
) {
  assertCanManageUsers(requesterRole);

  const schoolId = await resolveTargetSchoolId(
    requesterRole,
    requesterSchoolId,
    input.schoolId,
  );

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError("Email is already registered", 409);
  }

  const temporaryPassword = input.password ?? newTemporaryPassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        schoolId,
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        email: input.email,
        phoneNumber: input.phoneNumber,
        password: hashedPassword,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        role: UserRole.STUDENT,
        mustChangePassword: true,
        status: UserStatus.ACTIVE,
      },
    });

    const student = await tx.student.create({
      data: {
        userId: user.id,
        studentNumber: newStudentNumber(),
        guardianName: input.guardianName,
        guardianPhone: input.guardianPhone,
        guardianEmail: input.guardianEmail,
        emergencyContact: input.emergencyContact,
      },
    });

    return { user, student };
  });

  return {
    user: sanitizeUser(result.user),
    student: result.student,
    credentials: {
      email: result.user.email,
      temporaryPassword,
      mustChangePassword: true,
    },
  };
}

export async function resetUserCredentials(
  requesterRole: UserRole,
  requesterSchoolId: string | null,
  userId: string,
) {
  assertCanManageUsers(requesterRole);

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  await assertCanAccessUser(requesterRole, requesterSchoolId, user);

  if (requesterRole === UserRole.SCHOOL_ADMIN && !MANAGEABLE_ROLES.includes(user.role)) {
    throw new AppError("School admins can only reset teacher or student credentials", 403);
  }

  const temporaryPassword = newTemporaryPassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      mustChangePassword: true,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  return {
    user: sanitizeUser(updated),
    credentials: {
      email: updated.email,
      temporaryPassword,
      mustChangePassword: true,
    },
  };
}

export async function updateUserStatus(
  requesterRole: UserRole,
  requesterSchoolId: string | null,
  userId: string,
  input: UpdateUserStatusInput,
) {
  assertCanManageUsers(requesterRole);

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  await assertCanAccessUser(requesterRole, requesterSchoolId, user);

  if (requesterRole === UserRole.SCHOOL_ADMIN && !MANAGEABLE_ROLES.includes(user.role)) {
    throw new AppError("School admins can only update teacher or student status", 403);
  }

  if (user.role === UserRole.ADMIN) {
    throw new AppError("Cannot change system admin status", 403);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status: input.status },
  });

  return sanitizeUser(updated);
}
