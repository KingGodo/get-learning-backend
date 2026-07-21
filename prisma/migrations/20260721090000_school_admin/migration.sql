-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SCHOOL_ADMIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
