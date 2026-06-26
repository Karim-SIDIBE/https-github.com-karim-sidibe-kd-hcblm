-- CreateEnum
CREATE TYPE "ReportFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "recipients" TEXT[],
    "frequency" "ReportFrequency" NOT NULL DEFAULT 'WEEKLY',
    "format" TEXT NOT NULL DEFAULT 'xlsx',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportSchedule_courseId_idx" ON "ReportSchedule"("courseId");
