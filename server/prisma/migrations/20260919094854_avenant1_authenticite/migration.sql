-- Avenant n°1 au socle (objet F) + K-HCBLM v2.3 (A4, A5) :
-- exemption accessibilité, explication du changement de situation, condition
-- préalable d'alignement, et métriques de composition (agrégats seulement).
ALTER TABLE "User" ADD COLUMN "compositionExempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Enrollment" ADD COLUMN "ancrageChangeNote" TEXT;
ALTER TABLE "ProjectSubmission" ADD COLUMN "ancrageAlignedAt" TIMESTAMP(3);
ALTER TABLE "ProjectSubmission" ADD COLUMN "ancrageAlignedBy" TEXT;

CREATE TABLE "CompositionMetric" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "firstInputAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "charsTotal" INTEGER NOT NULL,
    "charsComposed" INTEGER NOT NULL,
    "charsPasted" INTEGER NOT NULL,
    "deleteEvents" INTEGER NOT NULL,
    "retouchesAfterPaste" INTEGER NOT NULL,
    "sessions" INTEGER NOT NULL,
    "depositRate" DOUBLE PRECISION NOT NULL,
    "retouchRate" DOUBLE PRECISION,
    "density" DOUBLE PRECISION NOT NULL,
    "spread" DOUBLE PRECISION,
    "signal" BOOLEAN,
    CONSTRAINT "CompositionMetric_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompositionMetric_enrollmentId_fieldKey_key" ON "CompositionMetric"("enrollmentId", "fieldKey");
CREATE INDEX "CompositionMetric_enrollmentId_idx" ON "CompositionMetric"("enrollmentId");
ALTER TABLE "CompositionMetric" ADD CONSTRAINT "CompositionMetric_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
