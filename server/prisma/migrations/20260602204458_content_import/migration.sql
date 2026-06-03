-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('SCORM12', 'SCORM2004', 'CMI5');

-- CreateTable
CREATE TABLE "ImportedPackage" (
    "id" TEXT NOT NULL,
    "type" "ImportType" NOT NULL,
    "title" TEXT NOT NULL,
    "storagePrefix" TEXT NOT NULL,
    "launchHref" TEXT NOT NULL,
    "structure" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScormRegistration" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completion" TEXT,
    "success" TEXT,
    "scoreScaled" DOUBLE PRECISION,
    "scoreRaw" INTEGER,
    "location" TEXT,
    "suspendData" TEXT,
    "totalTimeSeconds" INTEGER,
    "cmi" JSONB,
    "authToken" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScormRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundStatement" (
    "id" TEXT NOT NULL,
    "packageId" TEXT,
    "userId" TEXT,
    "verb" TEXT NOT NULL,
    "statement" JSONB NOT NULL,
    "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundStatement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportedPackage_type_idx" ON "ImportedPackage"("type");

-- CreateIndex
CREATE INDEX "ScormRegistration_userId_idx" ON "ScormRegistration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScormRegistration_packageId_userId_key" ON "ScormRegistration"("packageId", "userId");

-- CreateIndex
CREATE INDEX "InboundStatement_packageId_idx" ON "InboundStatement"("packageId");

-- AddForeignKey
ALTER TABLE "ScormRegistration" ADD CONSTRAINT "ScormRegistration_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ImportedPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundStatement" ADD CONSTRAINT "InboundStatement_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ImportedPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
