import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole, Gender } from "../src/generated/prisma/client.js";
import { newEmployeeNumber, newSchoolCode, newStudentNumber } from "../src/common/utils/codes.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run the seed");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@learninghub.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";

const SCHOOL_ADMIN_EMAIL =
  process.env.SEED_SCHOOL_ADMIN_EMAIL ?? "schooladmin@demo.local";
const SCHOOL_ADMIN_PASSWORD =
  process.env.SEED_SCHOOL_ADMIN_PASSWORD ?? "SchoolAdmin@12345";

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
          name: "Learning Hub System School",
          code: newSchoolCode(),
          email: "system@learninghub.local",
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
      name: "Learning Hub System School",
      code: newSchoolCode(),
      email: "system@learninghub.local",
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

async function seedDemoSchool() {
  const hashedPassword = await bcrypt.hash(SCHOOL_ADMIN_PASSWORD, 10);

  let school = await prisma.school.findFirst({
    where: { email: "office@demo-high.local" },
  });

  if (!school) {
    school = await prisma.school.create({
      data: {
        name: "Demo High School",
        code: newSchoolCode(),
        email: "office@demo-high.local",
        phoneNumber: "+263711000001",
        address: "1 Education Avenue",
        city: "Harare",
        province: "Harare",
      },
    });
    console.log(`Demo school created: ${school.code}`);
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email: SCHOOL_ADMIN_EMAIL },
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        schoolId: school.id,
        password: hashedPassword,
        role: UserRole.SCHOOL_ADMIN,
        status: "ACTIVE",
        mustChangePassword: false,
      },
    });
    console.log(`School admin upserted: ${SCHOOL_ADMIN_EMAIL}`);
  } else {
    await prisma.user.create({
      data: {
        schoolId: school.id,
        firstName: "School",
        lastName: "Admin",
        email: SCHOOL_ADMIN_EMAIL,
        phoneNumber: "+263711000002",
        password: hashedPassword,
        gender: Gender.PREFER_NOT_TO_SAY,
        role: UserRole.SCHOOL_ADMIN,
        emailVerified: true,
        status: "ACTIVE",
        mustChangePassword: false,
      },
    });
    console.log("School admin created");
    console.log(`  email:    ${SCHOOL_ADMIN_EMAIL}`);
    console.log(`  password: ${SCHOOL_ADMIN_PASSWORD}`);
    console.log(`  school:   ${school.code}`);
  }

  // Sample teacher
  const teacherEmail = "teacher@demo-high.local";
  let teacherUser = await prisma.user.findUnique({
    where: { email: teacherEmail },
    include: { teacher: true },
  });
  if (!teacherUser) {
    const teacherPassword = await bcrypt.hash("Teacher@12345", 10);
    teacherUser = await prisma.user.create({
      data: {
        schoolId: school.id,
        firstName: "Demo",
        lastName: "Teacher",
        email: teacherEmail,
        phoneNumber: "+263711000003",
        password: teacherPassword,
        gender: Gender.FEMALE,
        role: UserRole.TEACHER,
        status: "ACTIVE",
        mustChangePassword: false,
        teacher: {
          create: {
            employeeNumber: newEmployeeNumber(),
            department: "Science",
          },
        },
      },
      include: { teacher: true },
    });
    console.log(`Demo teacher created: ${teacherEmail} / Teacher@12345`);
  }

  // Sample student
  const studentEmail = "student@demo-high.local";
  const existingStudent = await prisma.user.findUnique({
    where: { email: studentEmail },
  });
  if (!existingStudent) {
    const studentPassword = await bcrypt.hash("Student@12345", 10);
    await prisma.user.create({
      data: {
        schoolId: school.id,
        firstName: "Demo",
        lastName: "Student",
        email: studentEmail,
        phoneNumber: "+263711000004",
        password: studentPassword,
        gender: Gender.MALE,
        role: UserRole.STUDENT,
        status: "ACTIVE",
        mustChangePassword: false,
        student: {
          create: {
            studentNumber: newStudentNumber(),
            guardianName: "Parent Guardian",
            guardianPhone: "+263711000005",
            guardianEmail: "parent@demo-high.local",
          },
        },
      },
    });
    console.log(`Demo student created: ${studentEmail} / Student@12345`);
  }

  return school;
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
  const systemSchoolId =
    admin.schoolId ??
    (
      await prisma.school.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    )?.id;
  if (!systemSchoolId) {
    throw new Error("No school available to seed subjects");
  }
  await seedSubjects(systemSchoolId);

  const demoSchool = await seedDemoSchool();
  await seedSubjects(demoSchool.id);

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
