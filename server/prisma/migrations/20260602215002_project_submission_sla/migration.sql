-- CreateEnum
CREATE TYPE "ProjectResult" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('SUBMITTED', 'ASSIGNED', 'PASSED', 'REVISION_REQUESTED');

-- CreateTable
CREATE TABLE "ProjectSubmission" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "blockIndex" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" JSONB,
    "evaluatorId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "scoreTotal" INTEGER,
    "criteria" JSONB,
    "feedback" TEXT,
    "result" "ProjectResult",
    "evaluatedAt" TIMESTAMP(3),
    "revisionStatus" "ProjectStatus" NOT NULL DEFAULT 'SUBMITTED',
    "slaAlertedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSubmission_enrollmentId_key" ON "ProjectSubmission"("enrollmentId");

-- CreateIndex
CREATE INDEX "ProjectSubmission_evaluatorId_idx" ON "ProjectSubmission"("evaluatorId");

-- AddForeignKey
ALTER TABLE "ProjectSubmission" ADD CONSTRAINT "ProjectSubmission_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSubmission" ADD CONSTRAINT "ProjectSubmission_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
