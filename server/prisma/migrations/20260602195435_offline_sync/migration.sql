-- CreateTable
CREATE TABLE "SyncOperation" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "opId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "clientTs" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncOperation_enrollmentId_idx" ON "SyncOperation"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncOperation_enrollmentId_opId_key" ON "SyncOperation"("enrollmentId", "opId");

-- AddForeignKey
ALTER TABLE "SyncOperation" ADD CONSTRAINT "SyncOperation_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
