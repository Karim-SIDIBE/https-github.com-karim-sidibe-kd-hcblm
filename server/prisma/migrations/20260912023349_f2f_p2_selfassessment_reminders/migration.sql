-- CreateTable
CREATE TABLE "F2fSelfAssessment" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "F2fSelfAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "F2fReminder" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "F2fReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "F2fSelfAssessment_participantId_phase_key" ON "F2fSelfAssessment"("participantId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "F2fReminder_key_key" ON "F2fReminder"("key");

-- AddForeignKey
ALTER TABLE "F2fSelfAssessment" ADD CONSTRAINT "F2fSelfAssessment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "F2fParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
