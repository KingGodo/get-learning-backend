import { UserRole } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { prisma } from "../../config/prisma.js";
import { uploadFile } from "../storage/storage.service.js";
import { notifyClassAssignmentPublished } from "../notifications/notifications.service.js";
import type { CreateAssignmentInput, UpdateAssignmentInput } from "./assignments.schema.js";

async function getTeacherProfile(userId: string) {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) {
    throw new AppError("Teacher profile not found", 404);
  }
  return teacher;
}

async function getStudentProfile(userId: string) {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) {
    throw new AppError("Student profile not found", 404);
  }
  return student;
}

async function assertTeacherOwnsClass(teacherId: string, classId: string) {
  const link = await prisma.classTeacher.findFirst({
    where: { classId, teacherId },
  });
  if (!link) {
    throw new AppError("You are not assigned to this class", 403);
  }
}

export async function createAssignment(
  userId: string,
  input: CreateAssignmentInput,
  file?: Express.Multer.File,
) {
  const teacher = await getTeacherProfile(userId);
  await assertTeacherOwnsClass(teacher.id, input.classId);

  let attachment: string | undefined;
  if (file) {
    attachment = await uploadFile("assignments", file);
  }

  const assignment = await prisma.assignment.create({
    data: {
      classId: input.classId,
      teacherId: teacher.id,
      title: input.title,
      description: input.description,
      instructions: input.instructions,
      dueDate: new Date(input.dueDate),
      totalMarks: input.totalMarks,
      allowLateSubmission: input.allowLateSubmission,
      status: input.status,
      attachment,
    },
  });

  if (assignment.status === "PUBLISHED") {
    await notifyClassAssignmentPublished(assignment).catch((err) => {
      console.warn("[notifications] assignment published:", err);
    });
  }

  return assignment;
}

export async function listAssignments(
  userId: string,
  role: UserRole,
  classId?: string,
) {
  if (role === UserRole.SCHOOL_ADMIN) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } });
    if (!user?.schoolId) return [];
    return prisma.assignment.findMany({
      where: {
        class: { schoolId: user.schoolId },
        ...(classId ? { classId } : {}),
      },
      include: {
        class: { select: { id: true, name: true, classCode: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { dueDate: "asc" },
    });
  }

  if (role === UserRole.TEACHER || role === UserRole.ADMIN) {
    const teacher = await getTeacherProfile(userId);
    return prisma.assignment.findMany({
      where: {
        teacherId: teacher.id,
        ...(classId ? { classId } : {}),
      },
      include: {
        class: { select: { id: true, name: true, classCode: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { dueDate: "asc" },
    });
  }

  const student = await getStudentProfile(userId);
  return prisma.assignment.findMany({
    where: {
      status: { in: ["PUBLISHED", "CLOSED"] },
      class: {
        classStudents: {
          some: { studentId: student.id, status: "ACTIVE" },
        },
      },
      ...(classId ? { classId } : {}),
    },
    include: {
      class: { select: { id: true, name: true, classCode: true } },
      submissions: {
        where: { studentId: student.id },
        select: { id: true, status: true, submittedAt: true, score: true },
      },
    },
    orderBy: { dueDate: "asc" },
  });
}

export async function getAssignment(userId: string, role: UserRole, id: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      class: true,
      teacher: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
      submissions:
        role === UserRole.TEACHER || role === UserRole.ADMIN || role === UserRole.SCHOOL_ADMIN
          ? {
              include: {
                student: {
                  include: {
                    user: { select: { firstName: true, lastName: true, email: true } },
                  },
                },
              },
            }
          : undefined,
    },
  });

  if (!assignment) {
    throw new AppError("Assignment not found", 404);
  }

  if (role === UserRole.SCHOOL_ADMIN) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } });
    if (!user?.schoolId || assignment.class?.schoolId !== user.schoolId) {
      throw new AppError("Assignment not found", 404);
    }
  } else if (role === UserRole.TEACHER || role === UserRole.ADMIN) {
    const teacher = await getTeacherProfile(userId);
    if (assignment.teacherId !== teacher.id) {
      throw new AppError("You do not own this assignment", 403);
    }
  } else {
    const student = await getStudentProfile(userId);
    const enrolled = await prisma.classStudent.findFirst({
      where: {
        classId: assignment.classId,
        studentId: student.id,
        status: "ACTIVE",
      },
    });
    if (!enrolled || assignment.status === "DRAFT") {
      throw new AppError("Assignment not available", 403);
    }
  }

  return assignment;
}

export async function updateAssignment(
  userId: string,
  id: string,
  input: UpdateAssignmentInput,
  file?: Express.Multer.File,
) {
  const hasBodyFields = Object.values(input).some((value) => value !== undefined);
  if (!file && !hasBodyFields) {
    throw new AppError("At least one field or attachment is required to update", 400);
  }

  const teacher = await getTeacherProfile(userId);
  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Assignment not found", 404);
  }
  if (existing.teacherId !== teacher.id) {
    throw new AppError("You do not own this assignment", 403);
  }

  let attachment: string | undefined;
  if (file) {
    attachment = await uploadFile("assignments", file);
  }

  const assignment = await prisma.assignment.update({
    where: { id },
    data: {
      ...input,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      ...(attachment ? { attachment } : {}),
    },
  });

  if (
    assignment.status === "PUBLISHED" &&
    existing.status !== "PUBLISHED"
  ) {
    await notifyClassAssignmentPublished(assignment).catch((err) => {
      console.warn("[notifications] assignment published:", err);
    });
  }

  return assignment;
}

export async function deleteAssignment(userId: string, id: string) {
  const teacher = await getTeacherProfile(userId);
  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Assignment not found", 404);
  }
  if (existing.teacherId !== teacher.id) {
    throw new AppError("You do not own this assignment", 403);
  }

  await prisma.assignment.delete({ where: { id } });
  return { id };
}
