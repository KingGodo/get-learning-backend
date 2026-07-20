import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole, Gender } from "../src/generated/prisma/client.js";
import { newEmployeeNumber, newSchoolCode } from "../src/common/utils/codes.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run the seed");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@eduplatform.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";

const defaultSubjects = [
  { name: "Mathematics", code: "MATH", description: "Core mathematics" },
  { name: "English", code: "ENG", description: "English language and literature" },
  { name: "Science", code: "SCI", description: "General science" },
  { name: "Geography", code: "GEO", description: "Geography" },
  { name: "History", code: "HIST", description: "History" },
  { name: "ICT", code: "ICT", description: "Information and Communication Technology" },
];

async function seedAdmin() {
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    include: { teacher: true, school: true },
  });

  if (existing) {
    let schoolId = existing.schoolId;

    if (!schoolId) {
      const school = await prisma.school.create({
        data: {
          name: "EduPlatform System School",
          code: newSchoolCode(),
          email: "system@eduplatform.local",
          phoneNumber: "+263700000000",
          address: "System",
          city: "Harare",
          province: "Harare",
        },
      });
      schoolId = school.id;
      await prisma.user.update({
        where: { id: existing.id },
        data: { schoolId, password: hashedPassword, status: "ACTIVE" },
      });
      console.log(`Linked existing admin to school: ${school.code}`);
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: { password: hashedPassword, status: "ACTIVE" },
      });
    }

    if (!existing.teacher) {
      await prisma.teacher.create({
        data: {
          userId: existing.id,
          employeeNumber: newEmployeeNumber(),
          department: "Administration",
          bio: "System administrator",
        },
      });
      console.log("Created teacher profile for existing admin");
    }

    console.log(`System admin upserted: ${ADMIN_EMAIL}`);
    return existing;
  }

  const school = await prisma.school.create({
    data: {
      name: "EduPlatform System School",
      code: newSchoolCode(),
      email: "system@eduplatform.local",
      phoneNumber: "+263700000000",
      address: "System",
      city: "Harare",
      province: "Harare",
    },
  });

  const admin = await prisma.user.create({
    data: {
      schoolId: school.id,
      firstName: "System",
      lastName: "Admin",
      email: ADMIN_EMAIL,
      phoneNumber: "+263700000000",
      password: hashedPassword,
      gender: Gender.PREFER_NOT_TO_SAY,
      role: UserRole.ADMIN,
      emailVerified: true,
      status: "ACTIVE",
    },
  });

  await prisma.teacher.create({
    data: {
      userId: admin.id,
      employeeNumber: newEmployeeNumber(),
      department: "Administration",
      bio: "System administrator",
    },
  });

  console.log("System admin created");
  console.log(`  email:    ${ADMIN_EMAIL}`);
  console.log(`  password: ${ADMIN_PASSWORD}`);
  console.log(`  role:     ${admin.role}`);
  console.log(`  school:   ${school.code}`);

  return admin;
}

async function seedSubjects(schoolId: string) {
  for (const subject of defaultSubjects) {
    await prisma.subject.upsert({
      where: {
        schoolId_code: { schoolId, code: subject.code },
      },
      update: {
        name: subject.name,
        description: subject.description,
      },
      create: { ...subject, schoolId },
    });
  }

  console.log(`Subjects seeded for school: ${defaultSubjects.length}`);
}

async function main() {
  console.log("Seeding database...\n");
  const admin = await seedAdmin();
  const schoolId =
    admin.schoolId ??
    (
      await prisma.school.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    )?.id;
  if (!schoolId) {
    throw new Error("No school available to seed subjects");
  }
  await seedSubjects(schoolId);
  console.log("\nSeed completed.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
