import bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { UserRole } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { newEmployeeNumber, newStudentNumber } from "../../common/utils/codes.js";
import { signToken } from "../../common/utils/tokens.js";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterStudentInput,
  RegisterTeacherInput,
  ResetPasswordInput,
  UpdateProfileInput,
  VerifyPasswordInput,
} from "./auth.schema.js";

function sanitizeUser<T extends { password: string }>(user: T) {
  const { password: _password, ...safe } = user;
  return safe;
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

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

export async function registerTeacher(input: RegisterTeacherInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    if (existing.deletedAt) {
      await archiveDeletedUserIdentity(existing);
    } else {
      throw new AppError("Email is already registered", 409);
    }
  }

  const school = await prisma.school.findUnique({
    where: { id: input.schoolId },
  });
  if (!school) {
    throw new AppError("School not found", 404);
  }
  if (school.status !== "ACTIVE") {
    throw new AppError("This school is not accepting new teachers", 400);
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        schoolId: school.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phoneNumber: input.phoneNumber,
        password: hashedPassword,
        gender: input.gender,
        role: UserRole.TEACHER,
      },
    });

    const teacher = await tx.teacher.create({
      data: {
        userId: user.id,
        employeeNumber: newEmployeeNumber(),
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

export async function listSchoolsForRegistration() {
  return prisma.school.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      code: true,
      city: true,
      province: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function registerStudent(input: RegisterStudentInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    if (existing.deletedAt) {
      await archiveDeletedUserIdentity(existing);
    } else {
      throw new AppError("Email is already registered", 409);
    }
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
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      teacher: true,
      student: true,
      school: true,
    },
  });

  if (!user || user.deletedAt) {
    console.warn(`[auth] login failed: no active user for ${email}`);
    throw new AppError("Invalid email or password", 401);
  }

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) {
    console.warn(`[auth] login failed: bad password for ${email}`);
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
        ...(passwordHash
          ? { password: passwordHash, mustChangePassword: false }
          : {}),
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

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) {
    throw new AppError("User not found", 404);
  }

  const valid = await bcrypt.compare(input.currentPassword, user.password);
  if (!valid) {
    throw new AppError("Current password is incorrect", 400);
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: passwordHash, mustChangePassword: false },
  });

  return { message: "Password updated successfully." };
}

export async function verifyCurrentPassword(
  userId: string,
  input: VerifyPasswordInput,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) {
    throw new AppError("User not found", 404);
  }

  const valid = await bcrypt.compare(input.currentPassword, user.password);
  if (!valid) {
    throw new AppError("Current password is incorrect", 400);
  }

  return { valid: true };
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function forgotPassword(input: ForgotPasswordInput) {
  const generic = {
    message:
      "If an account exists for that email, a password reset link has been sent.",
  };

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || user.deletedAt || user.status !== "ACTIVE") {
    return generic;
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: tokenHash,
      passwordResetExpires: expires,
    },
  });

  const frontendBase = env.FRONTEND_URL.replace(/\/$/, "");
  const resetUrl = `${frontendBase}/reset-password?token=${rawToken}`;

  // No email provider configured yet — log for local/LAN testing.
  console.log(`[auth] Password reset for ${user.email}: ${resetUrl}`);

  if (env.NODE_ENV === "development") {
    return { ...generic, resetUrl };
  }

  return generic;
}

export async function resetPassword(input: ResetPasswordInput) {
  const tokenHash = hashResetToken(input.token);

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash,
      passwordResetExpires: { gt: new Date() },
      deletedAt: null,
    },
  });

  if (!user) {
    throw new AppError("Reset link is invalid or has expired", 400);
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      mustChangePassword: false,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  return { message: "Password updated. You can sign in with your new password." };
}
