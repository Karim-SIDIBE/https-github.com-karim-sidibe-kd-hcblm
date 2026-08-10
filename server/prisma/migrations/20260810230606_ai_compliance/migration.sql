-- AlterTable
ALTER TABLE "AiAssessment" ADD COLUMN     "blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "copyFlags" JSONB,
ADD COLUMN     "finalScores" JSONB,
ADD COLUMN     "gridVersion" TEXT;

-- AlterTable
ALTER TABLE "ProjectSubmission" ADD COLUMN     "appealStage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "draftAt" TIMESTAMP(3),
ADD COLUMN     "draftScores" JSONB;

-- CreateTable
CREATE TABLE "AiCalibration" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "gridVersion" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCalibration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiCalibration_courseId_idx" ON "AiCalibration"("courseId");

-- AddForeignKey
ALTER TABLE "AiCalibration" ADD CONSTRAINT "AiCalibration_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
