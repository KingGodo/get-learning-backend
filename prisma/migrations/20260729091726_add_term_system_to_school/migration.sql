-- CreateEnum
CREATE TYPE "TermSystem" AS ENUM ('TERM', 'SEMESTER', 'QUARTER');

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "termSystem" "TermSystem" NOT NULL DEFAULT 'TERM',
ADD COLUMN     "termsPerYear" INTEGER NOT NULL DEFAULT 3;
