import { UserRole } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { prisma } from "../../config/prisma.js";

export async function getDashboard(userId: string, role: UserRole) {
  if (role === UserRole.ADMIN) {
    const [
      totalSchools,
      totalTeachers,
      totalStudents,
      totalClasses,
      totalSubjects,
      totalAssignments,
      pendingGrading,
      schools,
      recentTeachers,
      recentSubmissions,
      upcomingDeadlines,
    ] = await Promise.all([
      prisma.school.count(),
      prisma.teacher.count(),
      prisma.student.count(),
      prisma.class.count({ where: { status: "ACTIVE" } }),
      prisma.subject.count(),
      prisma.assignment.count(),
      prisma.submission.count({
        where: { status: { in: ["SUBMITTED", "LATE"] } },
      }),
      prisma.school.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          code: true,
          email: true,
          city: true,
          province: true,
          status: true,
          createdAt: true,
          _count: { select: { users: true, classes: true } },
        },
      }),
      prisma.teacher.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          employeeNumber: true,
          createdAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              school: { select: { name: true } },
            },
          },
        },
      }),
      prisma.submission.findMany({
        where: { status: { in: ["SUBMITTED", "LATE", "GRADED"] } },
        include: {
          assignment: { select: { id: true, title: true } },
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
        take: 5,
      }),
      prisma.assignment.findMany({
        where: {
          status: "PUBLISHED",
          dueDate: { gte: new Date() },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
        select: {
          id: true,
          title: true,
          dueDate: true,
          class: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      role,
      totalSchools,
      totalTeachers,
      totalStudents,
      totalClasses,
      totalSubjects,
      totalAssignments,
      pendingGrading,
      schools,
      recentTeachers,
      recentSubmissions,
      upcomingDeadlines,
    };
  }

  if (role === UserRole.TEACHER) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            school: {
              select: {
                id: true,
                name: true,
                code: true,
                email: true,
                phoneNumber: true,
                city: true,
                province: true,
                address: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!teacher) {
      throw new AppError("Teacher profile not found", 404);
    }

    const teacherClassFilter = {
      classTeachers: { some: { teacherId: teacher.id } },
    };

    const [
      classes,
      totalAssignments,
      pendingGrading,
      recentSubmissions,
      upcomingDeadlines,
      studentLinks,
      teacherSubjectRows,
    ] = await Promise.all([
      prisma.class.findMany({
        where: teacherClassFilter,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          classCode: true,
          academicYear: true,
          semester: true,
          status: true,
          subject: {
            select: { id: true, name: true, code: true, description: true },
          },
          classStudents: {
            where: { status: "ACTIVE" },
            take: 6,
            orderBy: { joinedAt: "asc" },
            select: {
              student: {
                select: {
                  studentNumber: true,
                  user: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
          _count: {
            select: {
              classStudents: { where: { status: "ACTIVE" } },
              assignments: true,
            },
          },
        },
      }),
      prisma.assignment.count({ where: { teacherId: teacher.id } }),
      prisma.submission.count({
        where: {
          assignment: { teacherId: teacher.id },
          status: { in: ["SUBMITTED", "LATE"] },
        },
      }),
      prisma.submission.findMany({
        where: { assignment: { teacherId: teacher.id } },
        include: {
          assignment: { select: { id: true, title: true } },
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
        take: 8,
      }),
      prisma.assignment.findMany({
        where: {
          teacherId: teacher.id,
          status: "PUBLISHED",
          dueDate: { gte: new Date() },
        },
        orderBy: { dueDate: "asc" },
        take: 8,
        select: {
          id: true,
          title: true,
          dueDate: true,
          class: { select: { id: true, name: true } },
        },
      }),
      prisma.classStudent.findMany({
        where: {
          status: "ACTIVE",
          class: teacherClassFilter,
        },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      prisma.teacherSubject.findMany({
        where: { teacherId: teacher.id },
        include: { subject: true },
        orderBy: { subject: { name: "asc" } },
      }),
    ]);

    const classCountBySubject = new Map<string, number>();
    for (const cls of classes) {
      if (!cls.subject) continue;
      classCountBySubject.set(
        cls.subject.id,
        (classCountBySubject.get(cls.subject.id) ?? 0) + 1,
      );
    }

    const subjects = teacherSubjectRows.map((row) => ({
      id: row.subject.id,
      name: row.subject.name,
      code: row.subject.code,
      description: row.subject.description,
      classCount: classCountBySubject.get(row.subject.id) ?? 0,
    }));

    return {
      role,
      profile: {
        employeeNumber: teacher.employeeNumber,
        department: teacher.department,
        qualification: teacher.qualification,
        bio: teacher.bio,
        firstName: teacher.user.firstName,
        lastName: teacher.user.lastName,
        email: teacher.user.email,
        phoneNumber: teacher.user.phoneNumber,
      },
      school: teacher.user.school,
      subjects,
      classes,
      totalSubjects: subjects.length,
      totalClasses: classes.length,
      totalStudents: studentLinks.length,
      totalAssignments,
      pendingGrading,
      recentSubmissions,
      upcomingDeadlines,
    };
  }

  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) {
    throw new AppError("Student profile not found", 404);
  }

  const [joinedClasses, activeAssignments, upcomingDeadlines, recentSubmissions] =
    await Promise.all([
      prisma.classStudent.count({
        where: { studentId: student.id, status: "ACTIVE" },
      }),
      prisma.assignment.count({
        where: {
          status: "PUBLISHED",
          class: {
            classStudents: {
              some: { studentId: student.id, status: "ACTIVE" },
            },
          },
          NOT: {
            submissions: {
              some: { studentId: student.id },
            },
          },
        },
      }),
      prisma.assignment.findMany({
        where: {
          status: "PUBLISHED",
          dueDate: { gte: new Date() },
          class: {
            classStudents: {
              some: { studentId: student.id, status: "ACTIVE" },
            },
          },
          // Only work still waiting on the student — submitted items belong in Recent
          NOT: {
            submissions: {
              some: { studentId: student.id },
            },
          },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
        select: {
          id: true,
          title: true,
          dueDate: true,
          class: { select: { id: true, name: true } },
        },
      }),
      prisma.submission.findMany({
        where: { studentId: student.id },
        include: {
          assignment: { select: { id: true, title: true, dueDate: true } },
        },
        orderBy: { submittedAt: "desc" },
        take: 5,
      }),
    ]);

  return {
    role,
    joinedClasses,
    activeAssignments,
    upcomingDeadlines,
    recentSubmissions,
  };
}
