-- CreateTable
CREATE TABLE "EvaluatorAccreditation" (
    "id" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "grantedById" TEXT,
    "notes" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "EvaluatorAccreditation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluatorAccreditation_evaluatorId_courseId_idx" ON "EvaluatorAccreditation"("evaluatorId", "courseId");

-- CreateIndex
CREATE INDEX "EvaluatorAccreditation_courseId_idx" ON "EvaluatorAccreditation"("courseId");

-- AddForeignKey
ALTER TABLE "EvaluatorAccreditation" ADD CONSTRAINT "EvaluatorAccreditation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluatorAccreditation" ADD CONSTRAINT "EvaluatorAccreditation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluatorAccreditation" ADD CONSTRAINT "EvaluatorAccreditation_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
