import { UserRole } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { prisma } from "../../config/prisma.js";
import { uploadFile } from "../storage/storage.service.js";
import {
  notifyStudentOfGrade,
  notifyTeacherOfSubmission,
} from "../notifications/notifications.service.js";
import type {
  GradeSubmissionInput,
  SubmitAssignmentInput,
} from "./submissions.schema.js";

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

export async function submitAssignment(
  userId: string,
  input: SubmitAssignmentInput,
  file?: Express.Multer.File,
) {
  if (!file) {
    throw new AppError("Submission file is required", 400);
  }

  const student = await getStudentProfile(userId);
  const assignment = await prisma.assignment.findUnique({
    where: { id: input.assignmentId },
    include: {
      teacher: { include: { user: { select: { id: true, firstName: true } } } },
    },
  });

  if (!assignment || assignment.status !== "PUBLISHED") {
    throw new AppError("Assignment is not available for submission", 400);
  }

  const enrolled = await prisma.classStudent.findFirst({
    where: {
      classId: assignment.classId,
      studentId: student.id,
      status: "ACTIVE",
    },
  });

  if (!enrolled) {
    throw new AppError("You are not enrolled in this class", 403);
  }

  const now = new Date();
  const isLate = now > assignment.dueDate;

  if (isLate && !assignment.allowLateSubmission) {
    throw new AppError("Late submissions are not allowed for this assignment", 400);
  }

  const attachment = await uploadFile("submissions", file);
  const status = isLate ? "LATE" : "SUBMITTED";

  const existing = await prisma.submission.findUnique({
    where: {
      assignmentId_studentId: {
        assignmentId: assignment.id,
        studentId: student.id,
      },
    },
  });

  const studentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });
  const studentName = studentUser
    ? `${studentUser.firstName} ${studentUser.lastName}`
    : "A student";

  let submission;
  if (existing) {
    if (existing.status === "GRADED") {
      throw new AppError(
        "This submission has been graded and cannot be replaced",
        400,
      );
    }

    if (now > assignment.dueDate && !assignment.allowLateSubmission) {
      throw new AppError("Cannot replace submission after due date", 400);
    }

    submission = await prisma.submission.update({
      where: { id: existing.id },
      data: {
        attachment,
        submittedAt: now,
        status,
        score: null,
        feedback: null,
        gradedById: null,
        gradedAt: null,
      },
    });
  } else {
    submission = await prisma.submission.create({
      data: {
        assignmentId: assignment.id,
        studentId: student.id,
        attachment,
        submittedAt: now,
        status,
      },
    });
  }

  await notifyTeacherOfSubmission({
    teacherUserId: assignment.teacher.userId,
    studentName,
    assignmentId: assignment.id,
    assignmentTitle: assignment.title,
    isLate,
  }).catch((err) => {
    console.warn("[notifications] submission:", err);
  });

  return submission;
}

export async function listSubmissions(
  userId: string,
  role: UserRole,
  assignmentId?: string,
) {
  if (role === UserRole.SCHOOL_ADMIN) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } });
    if (!user?.schoolId) return [];
    return prisma.submission.findMany({
      where: {
        assignment: { class: { schoolId: user.schoolId } },
        ...(assignmentId ? { assignmentId } : {}),
      },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            dueDate: true,
            totalMarks: true,
            class: { select: { id: true, name: true } },
          },
        },
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });
  }

  if (role === UserRole.TEACHER || role === UserRole.ADMIN) {
    const teacher = await getTeacherProfile(userId);
    return prisma.submission.findMany({
      where: {
        assignment: { teacherId: teacher.id },
        ...(assignmentId ? { assignmentId } : {}),
      },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            dueDate: true,
            totalMarks: true,
            class: { select: { id: true, name: true } },
          },
        },
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });
  }

  const student = await getStudentProfile(userId);
  return prisma.submission.findMany({
    where: {
      studentId: student.id,
      ...(assignmentId ? { assignmentId } : {}),
    },
    include: {
      assignment: {
        select: { id: true, title: true, dueDate: true, status: true, totalMarks: true },
      },
    },
    orderBy: { submittedAt: "desc" },
  });
}

export async function getSubmission(userId: string, role: UserRole, id: string) {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      assignment: true,
      student: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
      gradedBy: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!submission) {
    throw new AppError("Submission not found", 404);
  }

  if (role === UserRole.SCHOOL_ADMIN) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } });
    if (!user?.schoolId || submission.assignment.classId == null) {
      throw new AppError("Submission not found", 404);
    }
    const cls = await prisma.class.findUnique({ where: { id: submission.assignment.classId }, select: { schoolId: true } });
    if (cls?.schoolId !== user.schoolId) {
      throw new AppError("Submission not found", 404);
    }
  } else if (role === UserRole.TEACHER || role === UserRole.ADMIN) {
    const teacher = await getTeacherProfile(userId);
    if (submission.assignment.teacherId !== teacher.id) {
      throw new AppError("You do not have access to this submission", 403);
    }
  } else {
    const student = await getStudentProfile(userId);
    if (submission.studentId !== student.id) {
      throw new AppError("You do not have access to this submission", 403);
    }
  }

  return submission;
}

export async function gradeSubmission(
  userId: string,
  submissionId: string,
  input: GradeSubmissionInput,
) {
  const teacher = await getTeacherProfile(userId);
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: true },
  });

  if (!submission) {
    throw new AppError("Submission not found", 404);
  }

  if (submission.assignment.teacherId !== teacher.id) {
    throw new AppError("You do not own this assignment", 403);
  }

  if (input.score > submission.assignment.totalMarks) {
    throw new AppError(
      `Score cannot exceed total marks (${submission.assignment.totalMarks})`,
      400,
    );
  }

  const graded = await prisma.submission.update({
    where: { id: submissionId },
    data: {
      score: input.score,
      feedback: input.feedback,
      status: "GRADED",
      gradedById: teacher.id,
      gradedAt: new Date(),
    },
    include: {
      assignment: {
        select: { id: true, title: true, totalMarks: true, dueDate: true },
      },
      student: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      gradedBy: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  await notifyStudentOfGrade({
    studentUserId: graded.student.userId,
    assignmentId: graded.assignment.id,
    assignmentTitle: graded.assignment.title,
    score: input.score,
    totalMarks: graded.assignment.totalMarks,
  }).catch((err) => {
    console.warn("[notifications] graded:", err);
  });

  return graded;
}
