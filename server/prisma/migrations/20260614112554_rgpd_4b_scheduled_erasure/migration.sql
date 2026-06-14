-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletionMode" TEXT,
ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3);
