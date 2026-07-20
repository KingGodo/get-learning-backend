import { TeacherRole, UserRole } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { newClassCode } from "../../common/utils/codes.js";
import { signToken } from "../../common/utils/tokens.js";
import { prisma } from "../../config/prisma.js";
import type { CreateClassInput, JoinClassInput, UpdateClassInput } from "./classes.schema.js";

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

export async function createClass(
  userId: string,
  schoolId: string | null,
  input: CreateClassInput,
) {
  if (!schoolId) {
    throw new AppError("Teacher must belong to a school", 400);
  }

  const teacher = await getTeacherProfile(userId);
  const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
  if (!subject) {
    throw new AppError("Subject not found", 404);
  }
  if (subject.schoolId !== schoolId) {
    throw new AppError("Subject does not belong to your school", 400);
  }

  const assigned = await prisma.teacherSubject.findUnique({
    where: {
      teacherId_subjectId: { teacherId: teacher.id, subjectId: subject.id },
    },
  });
  if (!assigned) {
    throw new AppError("Register for this subject before creating a class", 400);
  }

  return prisma.$transaction(async (tx) => {
    const classRoom = await tx.class.create({
      data: {
        schoolId,
        subjectId: input.subjectId,
        name: input.name,
        description: input.description,
        classCode: newClassCode(),
        academicYear: input.academicYear,
        semester: input.semester,
      },
      include: { subject: true },
    });

    await tx.classTeacher.create({
      data: {
        classId: classRoom.id,
        teacherId: teacher.id,
        role: TeacherRole.PRIMARY,
      },
    });

    return classRoom;
  });
}

export async function listMyClasses(userId: string, role: UserRole) {
  if (role === UserRole.TEACHER || role === UserRole.ADMIN) {
    const teacher = await getTeacherProfile(userId);
    return prisma.class.findMany({
      where: {
        classTeachers: { some: { teacherId: teacher.id } },
      },
      include: {
        subject: true,
        _count: { select: { classStudents: true, assignments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  const student = await getStudentProfile(userId);
  return prisma.class.findMany({
    where: {
      classStudents: {
        some: { studentId: student.id, status: "ACTIVE" },
      },
    },
    include: {
      subject: true,
      _count: { select: { classStudents: true, assignments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getClassById(userId: string, role: UserRole, classId: string) {
  const classRoom = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      subject: true,
      classTeachers: {
        include: {
          teacher: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        },
      },
      classStudents: {
        where: { status: "ACTIVE" },
        orderBy: { joinedAt: "asc" },
        include: {
          student: {
            select: {
              id: true,
              studentNumber: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  phoneNumber: true,
                },
              },
            },
          },
        },
      },
      _count: { select: { assignments: true } },
    },
  });

  if (!classRoom) {
    throw new AppError("Class not found", 404);
  }

  await assertClassAccess(userId, role, classId);
  return classRoom;
}

export async function updateClass(
  userId: string,
  classId: string,
  input: UpdateClassInput,
) {
  await assertTeacherOwnsClass(userId, classId);

  if (input.subjectId) {
    const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
    if (!subject) {
      throw new AppError("Subject not found", 404);
    }
  }

  return prisma.class.update({
    where: { id: classId },
    data: input,
    include: { subject: true },
  });
}

export async function deleteClass(userId: string, classId: string) {
  await assertTeacherOwnsClass(userId, classId);
  await prisma.class.delete({ where: { id: classId } });
  return { id: classId };
}

export async function joinClass(userId: string, input: JoinClassInput) {
  const student = await getStudentProfile(userId);
  const classRoom = await prisma.class.findUnique({
    where: { classCode: input.classCode.toUpperCase() },
  });

  if (!classRoom || classRoom.status !== "ACTIVE") {
    throw new AppError("Invalid class code", 404);
  }

  const existing = await prisma.classStudent.findUnique({
    where: {
      classId_studentId: {
        classId: classRoom.id,
        studentId: student.id,
      },
    },
  });

  if (existing?.status === "ACTIVE") {
    throw new AppError("You are already enrolled in this class", 409);
  }

  const enrollment = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (user && !user.schoolId) {
      await tx.user.update({
        where: { id: userId },
        data: { schoolId: classRoom.schoolId },
      });
    }

    if (existing) {
      return tx.classStudent.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", joinedAt: new Date() },
        include: { class: { include: { subject: true } } },
      });
    }

    return tx.classStudent.create({
      data: {
        classId: classRoom.id,
        studentId: student.id,
      },
      include: { class: { include: { subject: true } } },
    });
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const token = signToken({
    userId: user.id,
    role: user.role,
    schoolId: user.schoolId,
  });

  return { enrollment, token };
}

async function assertTeacherOwnsClass(userId: string, classId: string) {
  const teacher = await getTeacherProfile(userId);
  const link = await prisma.classTeacher.findFirst({
    where: { classId, teacherId: teacher.id },
  });
  if (!link) {
    throw new AppError("You are not assigned to this class", 403);
  }
}

async function assertClassAccess(userId: string, role: UserRole, classId: string) {
  if (role === UserRole.TEACHER || role === UserRole.ADMIN) {
    await assertTeacherOwnsClass(userId, classId);
    return;
  }

  const student = await getStudentProfile(userId);
  const enrollment = await prisma.classStudent.findFirst({
    where: { classId, studentId: student.id, status: "ACTIVE" },
  });
  if (!enrollment) {
    throw new AppError("You are not enrolled in this class", 403);
  }
}
