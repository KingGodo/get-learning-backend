CREATE TABLE "StudentProfileRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "guardianName" TEXT NOT NULL,
    "guardianPhone" TEXT NOT NULL,
    "guardianEmail" TEXT,
    "emergencyContact" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "StudentProfileRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentProfileRequest_schoolId_status_idx" ON "StudentProfileRequest"("schoolId", "status");
CREATE INDEX "StudentProfileRequest_studentUserId_status_idx" ON "StudentProfileRequest"("studentUserId", "status");

ALTER TABLE "StudentProfileRequest" ADD CONSTRAINT "StudentProfileRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentProfileRequest" ADD CONSTRAINT "StudentProfileRequest_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
