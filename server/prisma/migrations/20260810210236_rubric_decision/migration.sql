-- AlterEnum
ALTER TYPE "ProjectStatus" ADD VALUE 'NOT_CERTIFIED';

-- AlterTable
ALTER TABLE "ProjectSubmission" ADD COLUMN     "decision" TEXT,
ADD COLUMN     "gridVersion" TEXT;
