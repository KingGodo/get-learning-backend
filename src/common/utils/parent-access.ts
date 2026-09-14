import { AppError } from "../errors/AppError.js";
import { prisma } from "../../config/prisma.js";

export async function getParentProfile(userId: string) {
  const parent = await prisma.parent.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!parent) {
    throw new AppError("Parent profile not found", 404);
  }
  return parent;
}

export async function getLinkedStudentIds(userId: string): Promise<string[]> {
  const parent = await getParentProfile(userId);
  const links = await prisma.parentStudent.findMany({
    where: { parentId: parent.id },
    select: { studentId: true },
  });
  return links.map((row) => row.studentId);
}

export async function assertParentLinkedToStudent(
  userId: string,
  studentId: string,
) {
  const ids = await getLinkedStudentIds(userId);
  if (!ids.includes(studentId)) {
    throw new AppError("You do not have access to this student", 403);
  }
}
