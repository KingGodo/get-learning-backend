import bcrypt from "bcrypt";
import type { UserRole } from "../../generated/prisma/client.js";
import { UserRole as Role } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import {
  newSchoolCode,
  newTemporaryPassword,
} from "../../common/utils/codes.js";
import { prisma } from "../../config/prisma.js";
import type { CreateSchoolInput, UpdateSchoolInput } from "./schools.schema.js";

function sanitizeUser<T extends { password: string }>(user: T) {
  const { password: _password, ...safe } = user;
  return safe;
}

export async function listSchools(role: UserRole) {
  if (role !== Role.ADMIN) {
    throw new AppError("Only system admins can list all schools", 403);
  }

  return prisma.school.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      code: true,
      email: true,
      phoneNumber: true,
      website: true,
      address: true,
      city: true,
      province: true,
      country: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { users: true, classes: true } },
    },
  });
}

export async function getMySchool(schoolId: string | null) {
  if (!schoolId) {
    throw new AppError("No school associated with this account", 404);
  }

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    throw new AppError("School not found", 404);
  }

  return school;
}

export async function createSchool(
  _userId: string,
  role: UserRole,
  _schoolId: string | null,
  input: CreateSchoolInput,
) {
  if (role !== Role.ADMIN) {
    throw new AppError("Only system admins can create schools", 403);
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email: input.admin.email },
  });
  if (existingAdmin) {
    throw new AppError("School admin email is already registered", 409);
  }

  const temporaryPassword =
    input.admin.password ?? newTemporaryPassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  const result = await prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: {
        name: input.name,
        code: newSchoolCode(),
        email: input.email,
        phoneNumber: input.phoneNumber,
        website: input.website,
        address: input.address,
        city: input.city,
        province: input.province,
        country: input.country ?? "Zimbabwe",
        termSystem: input.termSystem ?? "TERM",
        termsPerYear: input.termsPerYear ?? 3,
      },
    });

    const admin = await tx.user.create({
      data: {
        schoolId: school.id,
        firstName: input.admin.firstName,
        lastName: input.admin.lastName,
        email: input.admin.email,
        phoneNumber: input.admin.phoneNumber,
        password: hashedPassword,
        gender: input.admin.gender,
        role: Role.SCHOOL_ADMIN,
        emailVerified: true,
        status: "ACTIVE",
        mustChangePassword: true,
      },
    });

    return { school, admin };
  });

  return {
    school: result.school,
    admin: sanitizeUser(result.admin),
    credentials: {
      email: result.admin.email,
      temporaryPassword,
      mustChangePassword: true,
    },
  };
}

export async function updateMySchool(schoolId: string | null, input: UpdateSchoolInput) {
  if (!schoolId) {
    throw new AppError("No school associated with this account", 404);
  }

  return prisma.school.update({
    where: { id: schoolId },
    data: input,
  });
}

export async function getSchoolByCode(code: string) {
  const school = await prisma.school.findUnique({ where: { code } });
  if (!school) {
    throw new AppError("School not found", 404);
  }
  return school;
}

export async function getSchoolById(role: UserRole, id: string) {
  if (role !== Role.ADMIN) {
    throw new AppError("Only system admins can view school details", 403);
  }

  const school = await prisma.school.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, classes: true } },
      users: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          role: true,
          status: true,
          createdAt: true,
          teacher: { select: { employeeNumber: true, department: true } },
          student: { select: { studentNumber: true } },
        },
      },
      classes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          classCode: true,
          academicYear: true,
          semester: true,
          status: true,
          subject: { select: { id: true, name: true, code: true } },
          _count: { select: { classStudents: true, assignments: true } },
        },
      },
    },
  });

  if (!school) {
    throw new AppError("School not found", 404);
  }

  return school;
}
