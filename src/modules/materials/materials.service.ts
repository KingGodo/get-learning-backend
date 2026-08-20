import { UserRole } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { prisma } from "../../config/prisma.js";
import { uploadFile } from "../storage/storage.service.js";
import type { CreateMaterialsInput } from "./materials.schema.js";

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

async function assertTeacherOwnsClass(teacherId: string, classId: string) {
  const link = await prisma.classTeacher.findFirst({
    where: { classId, teacherId },
  });
  if (link) return;

  const classRoom = await prisma.class.findUnique({
    where: { id: classId },
    select: { subjectId: true },
  });
  if (!classRoom) {
    throw new AppError("Class not found", 404);
  }

  const teachesSubject = await prisma.teacherSubject.findFirst({
    where: { teacherId, subjectId: classRoom.subjectId },
  });
  if (teachesSubject) return;

  throw new AppError("You are not assigned to this class", 403);
}

async function assertClassAccess(
  ctx: AuthContext,
  classId: string,
  classSchoolId: string,
) {
  if (ctx.role === UserRole.SCHOOL_ADMIN) {
    if (!ctx.schoolId || ctx.schoolId !== classSchoolId) {
      throw new AppError("Class not found", 404);
    }
    return;
  }

  if (ctx.role === UserRole.ADMIN) {
    return;
  }

  if (ctx.role === UserRole.TEACHER) {
    const teacher = await getTeacherProfile(ctx.userId);
    await assertTeacherOwnsClass(teacher.id, classId);
    return;
  }

  const student = await getStudentProfile(ctx.userId);
  const enrollment = await prisma.classStudent.findFirst({
    where: { classId, studentId: student.id, status: "ACTIVE" },
  });
  if (!enrollment) {
    throw new AppError("You are not enrolled in this class", 403);
  }
}

async function requireClass(classId: string) {
  const classRoom = await prisma.class.findUnique({ where: { id: classId } });
  if (!classRoom) {
    throw new AppError("Class not found", 404);
  }
  return classRoom;
}

const materialInclude = {
  teacher: {
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  },
} as const;

function titleFromFilename(originalname: string) {
  const base = originalname.replace(/^.*[\\/]/, "").trim();
  const extension = base.includes(".")
    ? base.slice(base.lastIndexOf(".") + 1).toLowerCase()
    : "";
  const withoutExt = base.replace(/\.[^.]+$/, "").trim();

  // Re-uploaded LMS downloads often keep UUID storage names — don't use those as titles.
  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\s*\(\d+\))?$/i;
  if (!withoutExt || uuidLike.test(withoutExt)) {
    if (extension === "pdf") return "PDF document";
    if (extension === "doc" || extension === "docx") return "Word document";
    return "Reading material";
  }

  return withoutExt.slice(0, 200);
}

async function resolveUploaderTeacherId(ctx: AuthContext, classId: string) {
  if (ctx.role === UserRole.TEACHER) {
    const teacher = await getTeacherProfile(ctx.userId);
    await assertTeacherOwnsClass(teacher.id, classId);
    return teacher.id;
  }

  const asTeacher = await prisma.teacher.findUnique({
    where: { userId: ctx.userId },
  });
  if (asTeacher) {
    return asTeacher.id;
  }

  const link = await prisma.classTeacher.findFirst({
    where: { classId },
    orderBy: { assignedAt: "asc" },
  });
  if (!link) {
    throw new AppError(
      "Assign a teacher to this class before uploading materials",
      400,
    );
  }
  return link.teacherId;
}

export async function listMaterials(ctx: AuthContext, classId: string) {
  const classRoom = await requireClass(classId);
  await assertClassAccess(ctx, classId, classRoom.schoolId);

  return prisma.classMaterial.findMany({
    where: { classId },
    include: materialInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function createMaterials(
  ctx: AuthContext,
  classId: string,
  input: CreateMaterialsInput,
  files: Express.Multer.File[],
) {
  if (
    ctx.role !== UserRole.TEACHER &&
    ctx.role !== UserRole.ADMIN &&
    ctx.role !== UserRole.SCHOOL_ADMIN
  ) {
    throw new AppError("Only teachers can upload reading materials", 403);
  }

  const classRoom = await requireClass(classId);
  const teacherId = await resolveUploaderTeacherId(ctx, classId);

  if (!files.length) {
    throw new AppError("Select at least one PDF or Word file", 400);
  }

  const created = [];
  for (const file of files) {
    const attachment = await uploadFile("materials", file);
    const material = await prisma.classMaterial.create({
      data: {
        classId: classRoom.id,
        teacherId,
        title: titleFromFilename(file.originalname),
        description: input.description,
        attachment,
      },
      include: materialInclude,
    });
    created.push(material);
  }

  return created;
}

export async function deleteMaterial(
  ctx: AuthContext,
  classId: string,
  materialId: string,
) {
  if (
    ctx.role !== UserRole.TEACHER &&
    ctx.role !== UserRole.ADMIN &&
    ctx.role !== UserRole.SCHOOL_ADMIN
  ) {
    throw new AppError("Only teachers can remove reading materials", 403);
  }

  const classRoom = await requireClass(classId);
  await assertClassAccess(ctx, classId, classRoom.schoolId);

  const material = await prisma.classMaterial.findFirst({
    where: { id: materialId, classId },
  });
  if (!material) {
    throw new AppError("Material not found", 404);
  }

  await prisma.classMaterial.delete({ where: { id: material.id } });
  return { id: material.id };
}
