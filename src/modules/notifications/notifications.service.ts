import type { NotificationType } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { prisma } from "../../config/prisma.js";

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
};

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
    },
  });
}

export async function createNotifications(
  inputs: CreateNotificationInput[],
) {
  if (inputs.length === 0) return { count: 0 };
  return prisma.notification.createMany({ data: inputs });
}

/** Notify every active student in a class that an assignment was published. */
export async function notifyClassAssignmentPublished(assignment: {
  id: string;
  title: string;
  classId: string;
  dueDate: Date;
}) {
  const students = await prisma.classStudent.findMany({
    where: { classId: assignment.classId, status: "ACTIVE" },
    select: { student: { select: { userId: true } } },
  });

  const due = assignment.dueDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  await createNotifications(
    students.map((row) => ({
      userId: row.student.userId,
      type: "ASSIGNMENT_PUBLISHED" as const,
      title: "New assignment",
      body: `${assignment.title} · due ${due}`,
      href: `/assignments/${assignment.id}`,
    })),
  );
}

/** Notify the assignment’s teacher that a student submitted. */
export async function notifyTeacherOfSubmission(opts: {
  teacherUserId: string;
  studentName: string;
  assignmentId: string;
  assignmentTitle: string;
  isLate: boolean;
}) {
  await createNotification({
    userId: opts.teacherUserId,
    type: "SUBMISSION_RECEIVED",
    title: opts.isLate ? "Late submission received" : "New submission",
    body: `${opts.studentName} submitted ${opts.assignmentTitle}`,
    href: `/assignments/${opts.assignmentId}`,
  });
}

/** Notify the student that their work was graded. */
export async function notifyStudentOfGrade(opts: {
  studentUserId: string;
  assignmentId: string;
  assignmentTitle: string;
  score: number;
  totalMarks: number;
}) {
  await createNotification({
    userId: opts.studentUserId,
    type: "SUBMISSION_GRADED",
    title: "Assignment graded",
    body: `${opts.assignmentTitle} · ${opts.score}/${opts.totalMarks}`,
    href: `/assignments/${opts.assignmentId}`,
  });
}

export async function listNotifications(userId: string, limit = 50) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({
      where: { userId, readAt: null },
    }),
  ]);

  return { items, unreadCount };
}

export async function getUnreadCount(userId: string) {
  const unreadCount = await prisma.notification.count({
    where: { userId, readAt: null },
  });
  return { unreadCount };
}

export async function markNotificationsRead(
  userId: string,
  ids?: string[],
) {
  const where =
    ids && ids.length > 0
      ? { userId, readAt: null, id: { in: ids } }
      : { userId, readAt: null };

  const result = await prisma.notification.updateMany({
    where,
    data: { readAt: new Date() },
  });

  return { marked: result.count };
}

export async function markOneRead(userId: string, id: string) {
  const existing = await prisma.notification.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    throw new AppError("Notification not found", 404);
  }
  if (existing.readAt) return existing;

  return prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
}

export async function deleteNotification(userId: string, id: string) {
  const existing = await prisma.notification.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    throw new AppError("Notification not found", 404);
  }

  await prisma.notification.delete({ where: { id } });
  return { id };
}

export async function deleteNotifications(userId: string, ids?: string[]) {
  const where =
    ids && ids.length > 0 ? { userId, id: { in: ids } } : { userId };

  const result = await prisma.notification.deleteMany({ where });
  return { deleted: result.count };
}
