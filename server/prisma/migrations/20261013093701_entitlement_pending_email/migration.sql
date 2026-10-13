-- AlterTable
ALTER TABLE "Entitlement" ADD COLUMN     "pendingEmail" TEXT;

-- CreateIndex
CREATE INDEX "Entitlement_pendingEmail_idx" ON "Entitlement"("pendingEmail");
