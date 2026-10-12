ALTER TABLE "TeacherProfileRequest" ADD COLUMN "subjectIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
