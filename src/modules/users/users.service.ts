import bcrypt from "bcrypt";
import { TeacherRole, UserRole, UserStatus } from "../../generated/prisma/client.js";
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
  TeacherAssignmentInput,
  UpdateUserInput,
  UpdateUserStatusInput,
} from "./users.schema.js";

const MANAGEABLE_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.STUDENT];

function archivedEmail(userId: string) {
  return `deleted+${userId}@archived.local`;
}

async function archiveDeletedUserIdentity(user: {
  id: string;
  email: string;
  deletedAt: Date | null;
}) {
  if (!user.deletedAt || user.email === archivedEmail(user.id)) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { email: archivedEmail(user.id) },
  });
}

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

async function validateAndApplyTeacherAssignments(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  teacherId: string,
  schoolId: string,
  assignments: TeacherAssignmentInput[],
  mode: "create" | "replace",
) {
  const subjectIds = assignments.map((a) => a.subjectId);
  const uniqueSubjectIds = new Set(subjectIds);
  if (uniqueSubjectIds.size !== subjectIds.length) {
    throw new AppError("Duplicate subjects in assignments", 400);
  }

  const subjects = await tx.subject.findMany({
    where: { id: { in: subjectIds }, schoolId },
    select: { id: true },
  });
  if (subjects.length !== subjectIds.length) {
    throw new AppError("One or more subjects were not found in this school", 400);
  }

  const allClassIds = assignments.flatMap((a) => a.classIds);
  const uniqueClassIds = new Set(allClassIds);
  if (uniqueClassIds.size !== allClassIds.length) {
    throw new AppError("Duplicate classes in assignments", 400);
  }

  const classes = await tx.class.findMany({
    where: { id: { in: allClassIds }, schoolId },
    select: { id: true, subjectId: true },
  });
  if (classes.length !== allClassIds.length) {
    throw new AppError("One or more classes were not found in this school", 400);
  }

  const classById = new Map(classes.map((c) => [c.id, c]));
  for (const assignment of assignments) {
    for (const classId of assignment.classIds) {
      const cls = classById.get(classId);
      if (!cls || cls.subjectId !== assignment.subjectId) {
        throw new AppError(
          "Each class must belong to the selected subject",
          400,
        );
      }
    }
  }

  if (mode === "replace") {
    await tx.classTeacher.deleteMany({ where: { teacherId } });
    await tx.teacherSubject.deleteMany({ where: { teacherId } });
  }

  await tx.teacherSubject.createMany({
    data: subjectIds.map((subjectId) => ({ teacherId, subjectId })),
  });

  await tx.classTeacher.createMany({
    data: allClassIds.map((classId) => ({
      classId,
      teacherId,
      role: TeacherRole.PRIMARY,
    })),
  });
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
    const [classTeachers, teacherSubjects] = await Promise.all([
      prisma.classTeacher.findMany({
        where: { teacherId: user.teacher.id },
        include: {
          class: {
            select: {
              id: true,
              name: true,
              classCode: true,
              status: true,
              subjectId: true,
              subject: { select: { id: true, name: true, code: true } },
              _count: { select: { classStudents: true, assignments: true } },
            },
          },
        },
      }),
      prisma.teacherSubject.findMany({
        where: { teacherId: user.teacher.id },
        include: {
          subject: {
            select: { id: true, name: true, code: true, description: true },
          },
        },
        orderBy: { subject: { name: "asc" } },
      }),
    ]);
    return {
      ...user,
      teacher: { ...user.teacher, classTeachers, teacherSubjects },
    };
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
    if (existing.deletedAt) {
      await archiveDeletedUserIdentity(existing);
    } else {
      throw new AppError("Email is already registered", 409);
    }
  }

  const temporaryPassword = input.password || newTemporaryPassword();
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

    await validateAndApplyTeacherAssignments(
      tx,
      teacher.id,
      schoolId,
      input.assignments,
      "create",
    );

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
    if (existing.deletedAt) {
      await archiveDeletedUserIdentity(existing);
    } else {
      throw new AppError("Email is already registered", 409);
    }
  }

  const temporaryPassword = input.password || newTemporaryPassword();
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

export async function updateUser(
  requesterRole: UserRole,
  requesterSchoolId: string | null,
  userId: string,
  input: UpdateUserInput,
) {
  assertCanManageUsers(requesterRole);

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { teacher: true, student: true },
  });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  await assertCanAccessUser(requesterRole, requesterSchoolId, user);

  if (
    requesterRole === UserRole.SCHOOL_ADMIN &&
    !MANAGEABLE_ROLES.includes(user.role)
  ) {
    throw new AppError("School admins can only edit teacher or student profiles", 403);
  }

  if (requesterRole !== UserRole.ADMIN && input.status && input.status !== user.status) {
    throw new AppError("Only system admins can change status from this form", 403);
  }

  if (input.email && input.email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      if (existing.deletedAt) {
        await archiveDeletedUserIdentity(existing);
      } else {
        throw new AppError("Email is already registered", 409);
      }
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextUser = await tx.user.update({
      where: { id: user.id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.middleName !== undefined
          ? { middleName: input.middleName === "" ? null : input.middleName }
          : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber } : {}),
        ...(input.gender !== undefined ? { gender: input.gender } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });

    if (user.teacher) {
      await tx.teacher.update({
        where: { userId: user.id },
        data: {
          ...(input.department !== undefined
            ? { department: input.department === "" ? null : input.department }
            : {}),
          ...(input.qualification !== undefined
            ? {
                qualification:
                  input.qualification === "" ? null : input.qualification,
              }
            : {}),
        },
      });

      if (input.assignments) {
        if (!user.schoolId) {
          throw new AppError("Teacher must belong to a school", 400);
        }
        await validateAndApplyTeacherAssignments(
          tx,
          user.teacher.id,
          user.schoolId,
          input.assignments,
          "replace",
        );
      }
    }

    if (user.student) {
      await tx.student.update({
        where: { userId: user.id },
        data: {
          ...(input.guardianName !== undefined
            ? { guardianName: input.guardianName }
            : {}),
          ...(input.guardianPhone !== undefined
            ? { guardianPhone: input.guardianPhone }
            : {}),
          ...(input.guardianEmail !== undefined
            ? {
                guardianEmail:
                  input.guardianEmail === "" ? null : input.guardianEmail,
              }
            : {}),
          ...(input.emergencyContact !== undefined
            ? {
                emergencyContact:
                  input.emergencyContact === "" ? null : input.emergencyContact,
              }
            : {}),
        },
      });
    }

    return nextUser;
  });

  return sanitizeUser(updated);
}

export async function deleteUser(
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
    throw new AppError("School admins can only delete teacher or student accounts", 403);
  }

  if (user.role === UserRole.ADMIN) {
    throw new AppError("Cannot delete system admin accounts", 403);
  }

  const deleted = await prisma.user.update({
    where: { id: user.id },
    data: {
      email: archivedEmail(user.id),
      status: UserStatus.INACTIVE,
      deletedAt: new Date(),
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  return sanitizeUser(deleted);
}
