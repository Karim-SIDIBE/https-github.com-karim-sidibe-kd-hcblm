-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contestedCriteria" JSONB NOT NULL,
    "statement" TEXT NOT NULL,
    "firstEvaluatorId" TEXT,
    "firstScores" JSONB NOT NULL,
    "firstTotal" INTEGER NOT NULL,
    "secondEvaluatorId" TEXT,
    "secondAssignedAt" TIMESTAMP(3),
    "secondScores" JSONB,
    "secondTotal" INTEGER,
    "secondGradedAt" TIMESTAMP(3),
    "gap" INTEGER,
    "thirdEvaluatorId" TEXT,
    "thirdAssignedAt" TIMESTAMP(3),
    "thirdScores" JSONB,
    "thirdTotal" INTEGER,
    "finalScores" JSONB,
    "finalTotal" INTEGER,
    "finalDecision" TEXT,
    "decidedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "step2DueAt" TIMESTAMP(3),
    "step3DueAt" TIMESTAMP(3),
    "step5DueAt" TIMESTAMP(3),

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoubleMarking" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "firstEvaluatorId" TEXT,
    "firstScores" JSONB NOT NULL,
    "firstTotal" INTEGER NOT NULL,
    "secondEvaluatorId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "secondScores" JSONB,
    "secondTotal" INTEGER,
    "gradedAt" TIMESTAMP(3),
    "gap" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'REQUIRED',
    "thirdEvaluatorId" TEXT,
    "thirdTotal" INTEGER,
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoubleMarking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Appeal_enrollmentId_key" ON "Appeal"("enrollmentId");

-- CreateIndex
CREATE INDEX "Appeal_status_idx" ON "Appeal"("status");

-- CreateIndex
CREATE INDEX "DoubleMarking_enrollmentId_idx" ON "DoubleMarking"("enrollmentId");

-- CreateIndex
CREATE INDEX "DoubleMarking_status_idx" ON "DoubleMarking"("status");

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoubleMarking" ADD CONSTRAINT "DoubleMarking_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
