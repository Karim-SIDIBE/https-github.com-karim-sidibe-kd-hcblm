-- Socle FACE2FACE v1.3 (avenants n°1 à 3) : critère S5 + mini-projet en
-- condition préalable, famille/variante de scénario tracées, reprise unique
-- (fiches par tentative), récusation de droit.
ALTER TABLE "F2fModule" ADD COLUMN "s5Enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "F2fModule" ADD COLUMN "scenarioFamily" TEXT;

ALTER TABLE "F2fParticipant" ADD COLUMN "recusalAt" TIMESTAMP(3);
ALTER TABLE "F2fParticipant" ADD COLUMN "recusalNote" TEXT;

ALTER TABLE "F2fCertification" ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "F2fCertification" ADD COLUMN "scenarioVariant" TEXT;
DROP INDEX "F2fCertification_participantId_key";
CREATE UNIQUE INDEX "F2fCertification_participantId_attempt_key" ON "F2fCertification"("participantId", "attempt");

CREATE TABLE "F2fMiniProject" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "situation" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "learning" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "F2fMiniProject_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "F2fMiniProject_participantId_key" ON "F2fMiniProject"("participantId");
ALTER TABLE "F2fMiniProject" ADD CONSTRAINT "F2fMiniProject_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "F2fParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
