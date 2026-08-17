import { UserRole } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { prisma } from "../../config/prisma.js";
import type { CreateSubjectInput, UpdateSubjectInput } from "./subjects.schema.js";

type AuthContext = {
  userId: string;
  role: UserRole;
  schoolId: string | null;
};

async function getTeacher(userId: string) {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) {
    throw new AppError("Teacher profile not found", 404);
  }
  return teacher;
}

async function requireSchoolId(schoolId: string | null) {
  if (!schoolId) {
    throw new AppError("You must belong to a school", 400);
  }
  return schoolId;
}

function canManageSubjects(role: UserRole) {
  return role === UserRole.SCHOOL_ADMIN || role === UserRole.ADMIN;
}

async function getSubjectInSchool(subjectId: string, schoolId: string) {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, schoolId },
  });
  if (!subject) {
    throw new AppError("Subject not found", 404);
  }
  return subject;
}

export async function listSubjects(ctx: AuthContext) {
  if (ctx.role === UserRole.TEACHER) {
    const teacher = await getTeacher(ctx.userId);
    const rows = await prisma.teacherSubject.findMany({
      where: { teacherId: teacher.id },
      include: { subject: true },
      orderBy: { subject: { name: "asc" } },
    });
    return rows.map((row) => row.subject);
  }

  if (ctx.role === UserRole.SCHOOL_ADMIN) {
    const schoolId = await requireSchoolId(ctx.schoolId);
    return prisma.subject.findMany({
      where: { schoolId },
      orderBy: { name: "asc" },
    });
  }

  if (ctx.role === UserRole.ADMIN) {
    return prisma.subject.findMany({
      orderBy: { name: "asc" },
    });
  }

  return [];
}

export async function listSchoolCatalog(ctx: AuthContext) {
  const schoolId = await requireSchoolId(ctx.schoolId);
  if (!canManageSubjects(ctx.role) && ctx.role !== UserRole.TEACHER) {
    throw new AppError("Forbidden", 403);
  }

  const subjects = await prisma.subject.findMany({
    where: { schoolId },
    orderBy: { name: "asc" },
  });

  return subjects.map((subject) => ({
    ...subject,
    isAssigned: false,
  }));
}

export async function getSubject(
  id: string,
  opts?: { userId: string; role: UserRole; schoolId: string | null },
) {
  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) {
    throw new AppError("Subject not found", 404);
  }

  if (!opts) {
    return subject;
  }

  if (opts.role === UserRole.TEACHER) {
    const teacher = await getTeacher(opts.userId);
    const assigned = await prisma.teacherSubject.findUnique({
      where: {
        teacherId_subjectId: { teacherId: teacher.id, subjectId: id },
      },
    });
    if (!assigned) {
      throw new AppError("Subject not found", 404);
    }
  } else if (opts.role === UserRole.SCHOOL_ADMIN) {
    if (!opts.schoolId || subject.schoolId !== opts.schoolId) {
      throw new AppError("Subject not found", 404);
    }
  }

  const classWhere: {
    subjectId: string;
    classTeachers?: { some: { teacherId: string } };
  } = { subjectId: id };

  if (opts.role === UserRole.TEACHER) {
    const teacher = await getTeacher(opts.userId);
    classWhere.classTeachers = { some: { teacherId: teacher.id } };
  }

  const classes = await prisma.class.findMany({
    where: classWhere,
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          classStudents: { where: { status: "ACTIVE" } },
          assignments: true,
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
    },
  });

  const studentMap = new Map<
    string,
    {
      id: string;
      studentNumber: string;
      firstName: string;
      lastName: string;
      email: string;
      phoneNumber: string;
      classes: Array<{ id: string; name: string }>;
    }
  >();

  for (const cls of classes) {
    for (const row of cls.classStudents) {
      const existing = studentMap.get(row.student.id);
      if (existing) {
        existing.classes.push({ id: cls.id, name: cls.name });
      } else {
        studentMap.set(row.student.id, {
          id: row.student.id,
          studentNumber: row.student.studentNumber,
          firstName: row.student.user.firstName,
          lastName: row.student.user.lastName,
          email: row.student.user.email,
          phoneNumber: row.student.user.phoneNumber,
          classes: [{ id: cls.id, name: cls.name }],
        });
      }
    }
  }

  const students = Array.from(studentMap.values()).sort((a, b) =>
    a.lastName.localeCompare(b.lastName),
  );

  return {
    ...subject,
    classes: classes.map(({ classStudents: _cs, ...cls }) => cls),
    students,
  };
}

export async function createSubject(ctx: AuthContext, input: CreateSubjectInput) {
  const schoolId = await requireSchoolId(ctx.schoolId);

  if (!canManageSubjects(ctx.role)) {
    throw new AppError("Forbidden", 403);
  }

  const existing = await prisma.subject.findUnique({
    where: {
      schoolId_code: { schoolId, code: input.code },
    },
  });
  if (existing) {
    throw new AppError("Subject code already exists in this school", 409);
  }

  return prisma.subject.create({
    data: { ...input, schoolId },
  });
}

export async function updateSubject(
  ctx: AuthContext,
  id: string,
  input: UpdateSubjectInput,
) {
  const schoolId = await requireSchoolId(ctx.schoolId);

  if (!canManageSubjects(ctx.role)) {
    throw new AppError("Forbidden", 403);
  }

  const subject = await getSubjectInSchool(id, schoolId);

  if (input.code) {
    const existing = await prisma.subject.findFirst({
      where: {
        schoolId,
        code: input.code,
        NOT: { id },
      },
    });
    if (existing) {
      throw new AppError("Subject code already exists in this school", 409);
    }
  }

  return prisma.subject.update({
    where: { id: subject.id },
    data: input,
  });
}

export async function deleteSubject(ctx: AuthContext, id: string) {
  const schoolId = await requireSchoolId(ctx.schoolId);

  if (!canManageSubjects(ctx.role)) {
    throw new AppError("Forbidden", 403);
  }

  const subject = await getSubjectInSchool(id, schoolId);

  const classCount = await prisma.class.count({ where: { subjectId: id } });
  if (classCount > 0) {
    throw new AppError("Cannot delete a subject that is used by classes", 400);
  }

  return prisma.subject.delete({ where: { id: subject.id } });
}
