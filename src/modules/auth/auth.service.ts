import bcrypt from "bcrypt";
import { UserRole } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { newEmployeeNumber, newSchoolCode, newStudentNumber } from "../../common/utils/codes.js";
import { signToken } from "../../common/utils/tokens.js";
import { prisma } from "../../config/prisma.js";
import type {
  LoginInput,
  RegisterStudentInput,
  RegisterTeacherInput,
  UpdateProfileInput,
} from "./auth.schema.js";

function sanitizeUser<T extends { password: string }>(user: T) {
  const { password: _password, ...safe } = user;
  return safe;
}

export async function registerTeacher(input: RegisterTeacherInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError("Email is already registered", 409);
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: {
        name: input.schoolName,
        code: newSchoolCode(),
        email: input.schoolEmail,
        phoneNumber: input.schoolPhone,
        website: input.schoolWebsite,
        address: input.schoolAddress,
        city: input.schoolCity,
        province: input.schoolProvince,
      },
    });

    const user = await tx.user.create({
      data: {
        schoolId: school.id,
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        email: input.email,
        phoneNumber: input.phoneNumber,
        password: hashedPassword,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        role: UserRole.TEACHER,
      },
    });

    const teacher = await tx.teacher.create({
      data: {
        userId: user.id,
        employeeNumber: newEmployeeNumber(),
        qualification: input.qualification,
        department: input.department,
        bio: input.bio,
      },
    });

    return { school, user, teacher };
  });

  const token = signToken({
    userId: result.user.id,
    role: result.user.role,
    schoolId: result.school.id,
  });

  return {
    token,
    user: sanitizeUser(result.user),
    teacher: result.teacher,
    school: result.school,
  };
}

export async function registerStudent(input: RegisterStudentInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError("Email is already registered", 409);
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        email: input.email,
        phoneNumber: input.phoneNumber,
        password: hashedPassword,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        role: UserRole.STUDENT,
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

  const token = signToken({
    userId: result.user.id,
    role: result.user.role,
    schoolId: result.user.schoolId,
  });

  return {
    token,
    user: sanitizeUser(result.user),
    student: result.student,
  };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: {
      teacher: true,
      student: true,
      school: true,
    },
  });

  if (!user || user.deletedAt) {
    throw new AppError("Invalid email or password", 401);
  }

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) {
    throw new AppError("Invalid email or password", 401);
  }

  if (user.status !== "ACTIVE") {
    throw new AppError("Account is not active", 403);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const token = signToken({
    userId: user.id,
    role: user.role,
    schoolId: user.schoolId,
  });

  return {
    token,
    user: sanitizeUser(user),
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      teacher: true,
      student: true,
      school: true,
    },
  });

  if (!user || user.deletedAt) {
    throw new AppError("User not found", 404);
  }

  return sanitizeUser(user);
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { teacher: true, student: true, school: true },
  });

  if (!existing || existing.deletedAt) {
    throw new AppError("User not found", 404);
  }

  let passwordHash: string | undefined;
  if (input.newPassword && input.newPassword.length > 0) {
    if (!input.currentPassword) {
      throw new AppError("Current password is required", 400);
    }
    const valid = await bcrypt.compare(input.currentPassword, existing.password);
    if (!valid) {
      throw new AppError("Current password is incorrect", 400);
    }
    passwordHash = await bcrypt.hash(input.newPassword, 10);
  }

  const dateOfBirth =
    input.dateOfBirth === "" || input.dateOfBirth === null
      ? null
      : input.dateOfBirth
        ? new Date(input.dateOfBirth)
        : undefined;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        middleName: input.middleName === "" ? null : input.middleName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber,
        ...(input.gender ? { gender: input.gender } : {}),
        ...(dateOfBirth !== undefined ? { dateOfBirth } : {}),
        ...(passwordHash ? { password: passwordHash } : {}),
      },
    });

    if (existing.teacher) {
      await tx.teacher.update({
        where: { userId },
        data: {
          department:
            input.department === "" ? null : (input.department ?? undefined),
          qualification:
            input.qualification === ""
              ? null
              : (input.qualification ?? undefined),
          bio: input.bio === "" ? null : (input.bio ?? undefined),
        },
      });
    }

    if (existing.student) {
      await tx.student.update({
        where: { userId },
        data: {
          ...(input.guardianName
            ? { guardianName: input.guardianName }
            : {}),
          ...(input.guardianPhone
            ? { guardianPhone: input.guardianPhone }
            : {}),
          guardianEmail:
            input.guardianEmail === ""
              ? null
              : (input.guardianEmail ?? undefined),
          emergencyContact:
            input.emergencyContact === ""
              ? null
              : (input.emergencyContact ?? undefined),
        },
      });
    }
  });

  return getMe(userId);
}
