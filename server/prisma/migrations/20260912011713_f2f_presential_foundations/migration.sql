-- CreateEnum
CREATE TYPE "F2fModuleStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "F2fParticipantStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'CERTIFIED', 'NOT_CERTIFIED');

-- CreateTable
CREATE TABLE "F2fModule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "status" "F2fModuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "location" TEXT,
    "trainerId" TEXT,
    "rubric" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "F2fModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "F2fSession" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "durationMin" INTEGER NOT NULL DEFAULT 360,
    "location" TEXT,
    "heldAt" TIMESTAMP(3),

    CONSTRAINT "F2fSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "F2fAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL,
    "note" TEXT,

    CONSTRAINT "F2fAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "F2fParticipant" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "F2fParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "F2fParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "F2fAnchor" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "situation" TEXT NOT NULL,
    "behaviorChange" TEXT NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "F2fAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "F2fJournalEntry" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "periodIndex" INTEGER NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "situation" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "observation" TEXT NOT NULL,
    "learning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "F2fJournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "F2fMission" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "sessionIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "peerName" TEXT,
    "engagedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "F2fMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "F2fCertification" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "scoreTotal" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "feedback" TEXT,
    "evaluatorId" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "F2fCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "F2fCredential" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "achievementType" TEXT NOT NULL,
    "recipientSalt" TEXT NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "assertion" JSONB NOT NULL,
    "vcJwt" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,

    CONSTRAINT "F2fCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "F2fSession_moduleId_index_key" ON "F2fSession"("moduleId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "F2fAttendance_sessionId_participantId_key" ON "F2fAttendance"("sessionId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "F2fParticipant_moduleId_userId_key" ON "F2fParticipant"("moduleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "F2fAnchor_participantId_key" ON "F2fAnchor"("participantId");

-- CreateIndex
CREATE INDEX "F2fJournalEntry_participantId_idx" ON "F2fJournalEntry"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "F2fMission_participantId_sessionIndex_key" ON "F2fMission"("participantId", "sessionIndex");

-- CreateIndex
CREATE UNIQUE INDEX "F2fCertification_participantId_key" ON "F2fCertification"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "F2fCredential_participantId_key" ON "F2fCredential"("participantId");

-- AddForeignKey
ALTER TABLE "F2fModule" ADD CONSTRAINT "F2fModule_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F2fSession" ADD CONSTRAINT "F2fSession_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "F2fModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F2fAttendance" ADD CONSTRAINT "F2fAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "F2fSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F2fAttendance" ADD CONSTRAINT "F2fAttendance_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "F2fParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F2fParticipant" ADD CONSTRAINT "F2fParticipant_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "F2fModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F2fParticipant" ADD CONSTRAINT "F2fParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F2fAnchor" ADD CONSTRAINT "F2fAnchor_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "F2fParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F2fJournalEntry" ADD CONSTRAINT "F2fJournalEntry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "F2fParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F2fMission" ADD CONSTRAINT "F2fMission_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "F2fParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F2fCertification" ADD CONSTRAINT "F2fCertification_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "F2fParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F2fCertification" ADD CONSTRAINT "F2fCertification_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F2fCredential" ADD CONSTRAINT "F2fCredential_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "F2fParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
