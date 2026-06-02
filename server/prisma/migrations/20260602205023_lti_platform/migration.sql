-- CreateTable
CREATE TABLE "LtiPlatform" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "issuer" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "deploymentId" TEXT,
    "authLoginUrl" TEXT NOT NULL,
    "jwksUrl" TEXT NOT NULL,
    "tokenUrl" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LtiPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LtiNonce" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "targetLinkUri" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LtiNonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LtiPlatform_issuer_clientId_key" ON "LtiPlatform"("issuer", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "LtiNonce_state_key" ON "LtiNonce"("state");

-- AddForeignKey
ALTER TABLE "LtiNonce" ADD CONSTRAINT "LtiNonce_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "LtiPlatform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
