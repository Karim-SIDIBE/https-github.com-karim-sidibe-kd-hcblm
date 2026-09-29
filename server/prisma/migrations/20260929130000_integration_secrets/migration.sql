-- Secrets d'intégration configurés en console (chiffrés au repos par l'application).
CREATE TABLE "IntegrationSecret" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationSecret_pkey" PRIMARY KEY ("key")
);
