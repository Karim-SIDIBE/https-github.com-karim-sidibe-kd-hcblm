-- CreateEnum
CREATE TYPE "AiAssessmentKind" AS ENUM ('FORMATIVE', 'RUBRIC_SUGGESTION');

-- CreateTable
CREATE TABLE "AiAssessment" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "blockIndex" INTEGER NOT NULL,
    "itemKey" TEXT NOT NULL,
    "kind" "AiAssessmentKind" NOT NULL,
    "feedback" TEXT NOT NULL,
    "criteria" JSONB,
    "suggestedScore" INTEGER,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAssessment_enrollmentId_idx" ON "AiAssessment"("enrollmentId");

-- AddForeignKey
ALTER TABLE "AiAssessment" ADD CONSTRAINT "AiAssessment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
