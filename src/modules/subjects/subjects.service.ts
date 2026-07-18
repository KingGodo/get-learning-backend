import { UserRole } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { prisma } from "../../config/prisma.js";
import type { CreateSubjectInput, UpdateSubjectInput } from "./subjects.schema.js";

export async function listSubjects() {
  return prisma.subject.findMany({ orderBy: { name: "asc" } });
}

export async function getSubject(
  id: string,
  opts?: { userId: string; role: UserRole },
) {
  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) {
    throw new AppError("Subject not found", 404);
  }

  // Without auth context (e.g. internal checks), return subject only.
  if (!opts) {
    return subject;
  }

  const classWhere: {
    subjectId: string;
    classTeachers?: { some: { teacherId: string } };
  } = { subjectId: id };

  if (opts.role === UserRole.TEACHER) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: opts.userId },
    });
    if (teacher) {
      classWhere.classTeachers = { some: { teacherId: teacher.id } };
    }
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

export async function createSubject(input: CreateSubjectInput) {
  const existing = await prisma.subject.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new AppError("Subject code already exists", 409);
  }

  return prisma.subject.create({ data: input });
}

export async function updateSubject(id: string, input: UpdateSubjectInput) {
  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) {
    throw new AppError("Subject not found", 404);
  }

  if (input.code) {
    const existing = await prisma.subject.findFirst({
      where: { code: input.code, NOT: { id } },
    });
    if (existing) {
      throw new AppError("Subject code already exists", 409);
    }
  }

  return prisma.subject.update({
    where: { id },
    data: input,
  });
}

export async function deleteSubject(id: string) {
  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) {
    throw new AppError("Subject not found", 404);
  }

  const classCount = await prisma.class.count({ where: { subjectId: id } });
  if (classCount > 0) {
    throw new AppError("Cannot delete a subject that is used by classes", 400);
  }

  return prisma.subject.delete({ where: { id } });
}
