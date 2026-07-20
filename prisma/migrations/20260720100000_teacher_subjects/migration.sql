-- Add school scope to subjects and teacher-subject assignments

ALTER TABLE "Subject" ADD COLUMN "schoolId" TEXT;

UPDATE "Subject"
SET "schoolId" = (
  SELECT "id" FROM "School" ORDER BY "createdAt" ASC LIMIT 1
)
WHERE "schoolId" IS NULL;

ALTER TABLE "Subject" ALTER COLUMN "schoolId" SET NOT NULL;

ALTER TABLE "Subject" DROP CONSTRAINT IF EXISTS "Subject_code_key";
DROP INDEX IF EXISTS "Subject_code_key";

CREATE UNIQUE INDEX "Subject_schoolId_code_key" ON "Subject"("schoolId", "code");
CREATE INDEX "Subject_schoolId_idx" ON "Subject"("schoolId");

ALTER TABLE "Subject"
ADD CONSTRAINT "Subject_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TeacherSubject" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherSubject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherSubject_teacherId_subjectId_key" ON "TeacherSubject"("teacherId", "subjectId");
CREATE INDEX "TeacherSubject_subjectId_idx" ON "TeacherSubject"("subjectId");

ALTER TABLE "TeacherSubject"
ADD CONSTRAINT "TeacherSubject_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherSubject"
ADD CONSTRAINT "TeacherSubject_subjectId_fkey"
FOREIGN KEY ("subjectId") REFERENCES "Subject"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
