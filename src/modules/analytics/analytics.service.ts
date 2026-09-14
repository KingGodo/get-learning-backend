import { UserRole } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { prisma } from "../../config/prisma.js";

function pct(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export async function getTeacherAnalytics(userId: string, role: UserRole) {
  if (role !== UserRole.TEACHER) {
    throw new AppError("Teacher analytics are only available to teachers", 403);
  }

  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!teacher) {
    throw new AppError("Teacher profile not found", 404);
  }

  const classes = await prisma.class.findMany({
    where: {
      classTeachers: { some: { teacherId: teacher.id } },
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      academicYear: true,
      semester: true,
      subject: { select: { id: true, name: true, code: true } },
      _count: {
        select: {
          classStudents: { where: { status: "ACTIVE" } },
          assignments: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const classIds = classes.map((c) => c.id);

  const assignments = await prisma.assignment.findMany({
    where: { teacherId: teacher.id },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      totalMarks: true,
      classId: true,
      class: { select: { id: true, name: true } },
      _count: {
        select: {
          submissions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const submissions = await prisma.submission.findMany({
    where: { assignment: { teacherId: teacher.id } },
    select: {
      id: true,
      status: true,
      score: true,
      submittedAt: true,
      assignmentId: true,
      assignment: {
        select: {
          id: true,
          totalMarks: true,
          dueDate: true,
          classId: true,
          status: true,
        },
      },
    },
  });

  const publishedAssignments = assignments.filter((a) => a.status === "PUBLISHED" || a.status === "CLOSED");
  const graded = submissions.filter((s) => s.status === "GRADED" && s.score != null);
  const pending = submissions.filter((s) =>
    s.status === "SUBMITTED" || s.status === "LATE",
  );
  const late = submissions.filter((s) => s.status === "LATE").length;
  const onTime = submissions.filter((s) => s.status === "SUBMITTED" || s.status === "GRADED").length;

  let scoreSum = 0;
  let scoreWeight = 0;
  for (const s of graded) {
    const total = s.assignment.totalMarks || 0;
    if (total > 0 && s.score != null) {
      scoreSum += (s.score / total) * 100;
      scoreWeight += 1;
    }
  }

  const overview = {
    assignmentsPublished: publishedAssignments.length,
    assignmentsTotal: assignments.length,
    submissionsReceived: submissions.length,
    gradedCount: graded.length,
    pendingGrading: pending.length,
    averageScorePercent:
      scoreWeight > 0 ? Math.round((scoreSum / scoreWeight) * 10) / 10 : null,
    onTimeRatePercent: pct(onTime, submissions.length),
    lateRatePercent: pct(late, submissions.length),
  };

  const submissionsByClass = new Map<string, typeof submissions>();
  const assignmentsByClass = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const list = assignmentsByClass.get(a.classId) ?? [];
    list.push(a);
    assignmentsByClass.set(a.classId, list);
  }
  for (const s of submissions) {
    const classId = s.assignment.classId;
    const list = submissionsByClass.get(classId) ?? [];
    list.push(s);
    submissionsByClass.set(classId, list);
  }

  const perClass = classes.map((cls) => {
    const classAssignments = assignmentsByClass.get(cls.id) ?? [];
    const classSubs = submissionsByClass.get(cls.id) ?? [];
    const classGraded = classSubs.filter(
      (s) => s.status === "GRADED" && s.score != null,
    );
    let classScoreSum = 0;
    let classScoreN = 0;
    for (const s of classGraded) {
      const total = s.assignment.totalMarks || 0;
      if (total > 0 && s.score != null) {
        classScoreSum += (s.score / total) * 100;
        classScoreN += 1;
      }
    }
    const published = classAssignments.filter(
      (a) => a.status === "PUBLISHED" || a.status === "CLOSED",
    );
    const expected =
      published.length * cls._count.classStudents;
    const pendingForClass = classSubs.filter(
      (s) => s.status === "SUBMITTED" || s.status === "LATE",
    ).length;

    return {
      id: cls.id,
      name: cls.name,
      academicYear: cls.academicYear,
      semester: cls.semester,
      subject: cls.subject,
      studentCount: cls._count.classStudents,
      assignmentCount: classAssignments.length,
      submissionCount: classSubs.length,
      submissionRatePercent: pct(classSubs.length, expected),
      averageScorePercent:
        classScoreN > 0
          ? Math.round((classScoreSum / classScoreN) * 10) / 10
          : null,
      pendingGrading: pendingForClass,
    };
  });

  const studentCountByClass = new Map(
    classes.map((c) => [c.id, c._count.classStudents] as const),
  );

  const now = Date.now();
  const recentAssignments = assignments.slice(0, 12).map((a) => {
    const aSubs = submissions.filter((s) => s.assignmentId === a.id);
    const aGraded = aSubs.filter((s) => s.status === "GRADED" && s.score != null);
    let aScoreSum = 0;
    let aScoreN = 0;
    for (const s of aGraded) {
      if (a.totalMarks > 0 && s.score != null) {
        aScoreSum += (s.score / a.totalMarks) * 100;
        aScoreN += 1;
      }
    }
    const students = studentCountByClass.get(a.classId) ?? 0;
    const overdueUnsubmitted =
      a.status === "PUBLISHED" &&
      new Date(a.dueDate).getTime() < now
        ? Math.max(0, students - aSubs.length)
        : 0;

    return {
      id: a.id,
      title: a.title,
      status: a.status,
      dueDate: a.dueDate,
      class: a.class,
      totalMarks: a.totalMarks,
      submittedCount: aSubs.length,
      studentCount: students,
      submissionRatePercent: pct(aSubs.length, students),
      averageScorePercent:
        aScoreN > 0 ? Math.round((aScoreSum / aScoreN) * 10) / 10 : null,
      overdueUnsubmitted,
    };
  });

  return {
    overview,
    perClass,
    recentAssignments,
    classCount: classIds.length,
  };
}
