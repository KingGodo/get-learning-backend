-- Partial unique indexes keep one class room, one teacher conversation per child,
-- and one headmaster conversation per parent. PostgreSQL unique indexes do not
-- collapse NULL keys, so the teacher and headmaster rules live here.

CREATE TYPE "ChatRoomKind" AS ENUM ('CLASS', 'TEACHER_PARENT', 'HEADMASTER_PARENT');

CREATE TABLE "ChatRoom" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" "ChatRoomKind" NOT NULL,
    "classId" TEXT,
    "teacherId" TEXT,
    "parentId" TEXT,
    "studentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatRoom_classId_key" ON "ChatRoom"("classId");
CREATE INDEX "ChatRoom_schoolId_kind_idx" ON "ChatRoom"("schoolId", "kind");
CREATE INDEX "ChatRoom_teacherId_idx" ON "ChatRoom"("teacherId");
CREATE INDEX "ChatRoom_parentId_idx" ON "ChatRoom"("parentId");
CREATE INDEX "ChatRoom_studentId_idx" ON "ChatRoom"("studentId");
CREATE UNIQUE INDEX "ChatRoom_teacher_parent_student_key" ON "ChatRoom"("teacherId", "parentId", "studentId") WHERE "kind" = 'TEACHER_PARENT';
CREATE UNIQUE INDEX "ChatRoom_headmaster_parent_key" ON "ChatRoom"("parentId") WHERE "kind" = 'HEADMASTER_PARENT';

ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt");

ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
