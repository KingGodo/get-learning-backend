CREATE TABLE "TeacherProfileRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "department" TEXT,
    "qualification" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "TeacherProfileRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeacherProfileRequest_schoolId_status_idx" ON "TeacherProfileRequest"("schoolId", "status");
CREATE INDEX "TeacherProfileRequest_teacherUserId_status_idx" ON "TeacherProfileRequest"("teacherUserId", "status");

ALTER TABLE "TeacherProfileRequest" ADD CONSTRAINT "TeacherProfileRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherProfileRequest" ADD CONSTRAINT "TeacherProfileRequest_teacherUserId_fkey" FOREIGN KEY ("teacherUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
