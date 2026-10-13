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

const PASS_MARK_PERCENT = 50;

type ReportContext = {
  userId: string;
  role: UserRole;
  schoolId: string | null;
};

type PeriodBounds = { from?: Date; to?: Date };

function parseDay(value: string | undefined, endOfDay: boolean) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new AppError("Choose a valid date", 400);
  }
  if (endOfDay) date.setUTCHours(23, 59, 59, 999);
  return date;
}

function assertRange(from?: Date, to?: Date) {
  if (from && to && from.getTime() > to.getTime()) {
    throw new AppError("The start date must be on or before the end date", 400);
  }
}

function inRange(due: Date, bounds: PeriodBounds) {
  if (bounds.from && due.getTime() < bounds.from.getTime()) return false;
  if (bounds.to && due.getTime() > bounds.to.getTime()) return false;
  return true;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

const reportClassSelect = {
  id: true,
  name: true,
  academicYear: true,
  semester: true,
  subject: { select: { name: true } },
} as const;

async function classesForReport(ctx: ReportContext) {
  if (ctx.role === UserRole.TEACHER) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: ctx.userId },
      select: { id: true },
    });
    if (!teacher) throw new AppError("Teacher profile not found", 404);
    return prisma.class.findMany({
      where: {
        status: "ACTIVE",
        classTeachers: { some: { teacherId: teacher.id } },
      },
      select: reportClassSelect,
      orderBy: { name: "asc" },
    });
  }

  if (ctx.role === UserRole.SCHOOL_ADMIN || ctx.role === UserRole.HEADMASTER) {
    if (!ctx.schoolId) throw new AppError("You must belong to a school", 400);
    return prisma.class.findMany({
      where: { schoolId: ctx.schoolId, status: "ACTIVE" },
      select: reportClassSelect,
      orderBy: { name: "asc" },
    });
  }

  throw new AppError("You do not have permission to view reports", 403);
}

type Mark = { studentId: string; percent: number };

function periodSummary(marks: Mark[], enrolledIds: Set<string>) {
  const counted = marks.filter((mark) => enrolledIds.has(mark.studentId));
  const passes = counted.filter((mark) => mark.percent >= PASS_MARK_PERCENT).length;
  const average =
    counted.length > 0
      ? round1(counted.reduce((sum, mark) => sum + mark.percent, 0) / counted.length)
      : null;

  const byStudent = new Map<string, number[]>();
  for (const mark of counted) {
    const list = byStudent.get(mark.studentId) ?? [];
    list.push(mark.percent);
    byStudent.set(mark.studentId, list);
  }

  let studentsPassed = 0;
  for (const scores of byStudent.values()) {
    const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    if (avg >= PASS_MARK_PERCENT) studentsPassed += 1;
  }

  return {
    graded: counted.length,
    passes,
    passRatePercent: counted.length > 0 ? pct(passes, counted.length) : null,
    averageScorePercent: average,
    studentsGraded: byStudent.size,
    studentsPassed,
    studentPassRatePercent:
      byStudent.size > 0 ? pct(studentsPassed, byStudent.size) : null,
  };
}

export async function getPerformanceReport(
  ctx: ReportContext,
  query: {
    classId?: string;
    from?: string;
    to?: string;
    compareFrom?: string;
    compareTo?: string;
  },
) {
  const period: PeriodBounds = {
    from: parseDay(query.from, false),
    to: parseDay(query.to, true),
  };
  const compare: PeriodBounds | null =
    query.compareFrom && query.compareTo
      ? {
          from: parseDay(query.compareFrom, false),
          to: parseDay(query.compareTo, true),
        }
      : null;
  assertRange(period.from, period.to);
  if (compare) assertRange(compare.from, compare.to);

  const visible = await classesForReport(ctx);
  const classIds = visible.map((room) => room.id);
  if (query.classId && !classIds.includes(query.classId)) {
    throw new AppError("Class not found", 404);
  }
  const selectedIds = query.classId ? [query.classId] : classIds;

  const [rosters, assignments, submissions] = await Promise.all([
    prisma.classStudent.findMany({
      where: { classId: { in: selectedIds }, status: "ACTIVE" },
      select: {
        classId: true,
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.assignment.findMany({
      where: {
        classId: { in: selectedIds },
        status: { in: ["PUBLISHED", "CLOSED"] },
      },
      select: { id: true, classId: true, dueDate: true, totalMarks: true },
    }),
    prisma.submission.findMany({
      where: {
        status: "GRADED",
        score: { not: null },
        assignment: {
          classId: { in: selectedIds },
          status: { in: ["PUBLISHED", "CLOSED"] },
        },
      },
      select: { studentId: true, score: true, assignmentId: true },
    }),
  ]);

  const assignmentById = new Map(assignments.map((item) => [item.id, item]));
  const marksFor = (bounds: PeriodBounds) => {
    const byClass = new Map<string, Mark[]>();
    for (const submission of submissions) {
      const assignment = assignmentById.get(submission.assignmentId);
      if (!assignment || assignment.totalMarks <= 0 || submission.score == null) continue;
      if (!inRange(assignment.dueDate, bounds)) continue;
      const list = byClass.get(assignment.classId) ?? [];
      list.push({
        studentId: submission.studentId,
        percent: (submission.score / assignment.totalMarks) * 100,
      });
      byClass.set(assignment.classId, list);
    }
    return byClass;
  };

  const periodMarks = marksFor(period);
  const compareMarks = compare ? marksFor(compare) : null;
  const rosterByClass = new Map<string, typeof rosters>();
  for (const row of rosters) {
    const list = rosterByClass.get(row.classId) ?? [];
    list.push(row);
    rosterByClass.set(row.classId, list);
  }

  const selected = visible.filter((room) => selectedIds.includes(room.id));
  const rows = selected.map((room) => {
    const roster = rosterByClass.get(room.id) ?? [];
    const enrolled = new Set(roster.map((row) => row.student.id));
    const current = periodSummary(periodMarks.get(room.id) ?? [], enrolled);
    const previous = compareMarks
      ? periodSummary(compareMarks.get(room.id) ?? [], enrolled)
      : null;

    const students =
      query.classId == null
        ? undefined
        : roster
            .map((row) => {
              const mine = (periodMarks.get(room.id) ?? []).filter(
                (mark) => mark.studentId === row.student.id,
              );
              const earlier = (compareMarks?.get(room.id) ?? []).filter(
                (mark) => mark.studentId === row.student.id,
              );
              const average =
                mine.length > 0
                  ? round1(mine.reduce((sum, mark) => sum + mark.percent, 0) / mine.length)
                  : null;
              const compareAverage =
                earlier.length > 0
                  ? round1(
                      earlier.reduce((sum, mark) => sum + mark.percent, 0) / earlier.length,
                    )
                  : null;
              const passes = mine.filter((mark) => mark.percent >= PASS_MARK_PERCENT).length;
              return {
                id: row.student.id,
                name: `${row.student.user.firstName} ${row.student.user.lastName}`,
                studentNumber: row.student.studentNumber,
                graded: mine.length,
                passes,
                passRatePercent: mine.length > 0 ? pct(passes, mine.length) : null,
                averageScorePercent: average,
                comparePassRatePercent:
                  earlier.length > 0
                    ? pct(
                        earlier.filter((mark) => mark.percent >= PASS_MARK_PERCENT).length,
                        earlier.length,
                      )
                    : null,
                compareAverageScorePercent: compareAverage,
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name));

    return {
      classId: room.id,
      className: room.name,
      subjectName: room.subject?.name ?? null,
      academicYear: room.academicYear,
      semester: room.semester,
      studentCount: roster.length,
      period: current,
      compare: previous,
      students,
    };
  });

  return {
    passMarkPercent: PASS_MARK_PERCENT,
    classes: visible.map((room) => ({
      id: room.id,
      name: room.name,
      subjectName: room.subject?.name ?? null,
      academicYear: room.academicYear,
      semester: room.semester,
    })),
    period: { from: query.from ?? null, to: query.to ?? null },
    compare: compare
      ? { from: query.compareFrom ?? null, to: query.compareTo ?? null }
      : null,
    rows,
  };
}
