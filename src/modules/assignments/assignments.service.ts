import { TeacherRole, UserRole } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { prisma } from "../../config/prisma.js";
import { uploadFile } from "../storage/storage.service.js";
import { notifyClassAssignmentPublished } from "../notifications/notifications.service.js";
import type { CreateAssignmentInput, UpdateAssignmentInput } from "./assignments.schema.js";

type AuthContext = {
  userId: string;
  role: UserRole;
  schoolId: string | null;
};

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

async function linkTeacherToClass(teacherId: string, classId: string) {
  await prisma.classTeacher.upsert({
    where: { classId_teacherId: { classId, teacherId } },
    create: { classId, teacherId, role: TeacherRole.PRIMARY },
    update: {},
  });
}

async function ensureTeacherCanAuthorClass(
  teacherId: string,
  classRoom: { id: string; subjectId: string },
) {
  const link = await prisma.classTeacher.findFirst({
    where: { classId: classRoom.id, teacherId },
  });
  if (link) return;

  const teachesSubject = await prisma.teacherSubject.findFirst({
    where: { teacherId, subjectId: classRoom.subjectId },
  });
  if (teachesSubject) {
    await linkTeacherToClass(teacherId, classRoom.id);
    return;
  }

  throw new AppError("You are not assigned to this class", 403);
}

async function resolveAuthorTeacher(ctx: AuthContext, classId: string) {
  const classRoom = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, schoolId: true, subjectId: true },
  });
  if (!classRoom) {
    throw new AppError("Class not found", 404);
  }

  if (ctx.role === UserRole.SCHOOL_ADMIN) {
    if (!ctx.schoolId || classRoom.schoolId !== ctx.schoolId) {
      throw new AppError("Class not found", 404);
    }
  }

  const ownTeacher = await prisma.teacher.findUnique({
    where: { userId: ctx.userId },
  });

  if (ctx.role === UserRole.TEACHER) {
    if (!ownTeacher) {
      throw new AppError("Teacher profile not found", 404);
    }
    await ensureTeacherCanAuthorClass(ownTeacher.id, classRoom);
    return ownTeacher;
  }

  if (ownTeacher) {
    const assigned = await prisma.classTeacher.findFirst({
      where: { classId: classRoom.id, teacherId: ownTeacher.id },
    });
    if (assigned) return ownTeacher;
  }

  const classTeacher = await prisma.classTeacher.findFirst({
    where: { classId: classRoom.id },
    orderBy: { assignedAt: "asc" },
  });
  if (classTeacher) {
    return prisma.teacher.findUniqueOrThrow({ where: { id: classTeacher.teacherId } });
  }

  if (ownTeacher && (ctx.role === UserRole.ADMIN || ctx.role === UserRole.SCHOOL_ADMIN)) {
    await linkTeacherToClass(ownTeacher.id, classRoom.id);
    return ownTeacher;
  }

  throw new AppError(
    "Assign a teacher to this class before creating assignments",
    400,
  );
}

async function assertCanMutateAssignment(
  ctx: AuthContext,
  assignment: { teacherId: string; class: { schoolId: string } },
) {
  if (ctx.role === UserRole.ADMIN) return;

  if (ctx.role === UserRole.SCHOOL_ADMIN) {
    if (!ctx.schoolId || assignment.class.schoolId !== ctx.schoolId) {
      throw new AppError("Assignment not found", 404);
    }
    return;
  }

  const teacher = await getTeacherProfile(ctx.userId);
  if (assignment.teacherId !== teacher.id) {
    throw new AppError("You do not own this assignment", 403);
  }
}

export async function createAssignment(
  ctx: AuthContext,
  input: CreateAssignmentInput,
  file?: Express.Multer.File,
) {
  const teacher = await resolveAuthorTeacher(ctx, input.classId);

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
  ctx: AuthContext,
  id: string,
  input: UpdateAssignmentInput,
  file?: Express.Multer.File,
) {
  const hasBodyFields = Object.values(input).some((value) => value !== undefined);
  if (!file && !hasBodyFields) {
    throw new AppError("At least one field or attachment is required to update", 400);
  }

  const existing = await prisma.assignment.findUnique({
    where: { id },
    include: { class: { select: { schoolId: true } } },
  });
  if (!existing) {
    throw new AppError("Assignment not found", 404);
  }
  await assertCanMutateAssignment(ctx, existing);

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

export async function deleteAssignment(ctx: AuthContext, id: string) {
  const existing = await prisma.assignment.findUnique({
    where: { id },
    include: { class: { select: { schoolId: true } } },
  });
  if (!existing) {
    throw new AppError("Assignment not found", 404);
  }
  await assertCanMutateAssignment(ctx, existing);

  await prisma.assignment.delete({ where: { id } });
  return { id };
}
