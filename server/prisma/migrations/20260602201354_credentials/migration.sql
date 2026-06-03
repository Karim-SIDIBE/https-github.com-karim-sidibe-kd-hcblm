-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "achievementType" TEXT NOT NULL,
    "recipientSalt" TEXT NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "assertion" JSONB NOT NULL,
    "vcJwt" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Credential_badgeId_key" ON "Credential"("badgeId");

-- CreateIndex
CREATE INDEX "Credential_enrollmentId_idx" ON "Credential"("enrollmentId");

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
