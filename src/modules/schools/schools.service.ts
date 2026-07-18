import type { UserRole } from "../../generated/prisma/client.js";
import { UserRole as Role } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { newSchoolCode } from "../../common/utils/codes.js";
import { signToken } from "../../common/utils/tokens.js";
import { prisma } from "../../config/prisma.js";
import type { CreateSchoolInput, UpdateSchoolInput } from "./schools.schema.js";

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
  userId: string,
  role: UserRole,
  schoolId: string | null,
  input: CreateSchoolInput,
) {
  // Teachers may only create a school if they are not already linked.
  // System admins can create schools for the platform at any time.
  if (role !== Role.ADMIN && schoolId) {
    throw new AppError("This account is already linked to a school", 409);
  }

  const school = await prisma.school.create({
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
    },
  });

  // Link the creator only when they do not already have a school
  if (!schoolId) {
    await prisma.user.update({
      where: { id: userId },
      data: { schoolId: school.id },
    });

    const token = signToken({
      userId,
      role,
      schoolId: school.id,
    });

    return { school, token };
  }

  return { school, token: null };
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
