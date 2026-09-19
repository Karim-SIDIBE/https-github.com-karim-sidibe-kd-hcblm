-- K-HCBLM v2.3 (A3) / avenant n°1 au socle (objet E) : le certificat de niveau
-- porte une date d'échéance fixée à 3 ans, aux trois niveaux, dans les deux
-- départements. Les badges de bloc n'expirent pas (expiresAt reste NULL).
ALTER TABLE "Credential" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "F2fCredential" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Backfill : titres déjà émis → délivrance + 3 ans (certificats seulement).
UPDATE "Credential" SET "expiresAt" = "issuedAt" + interval '3 years' WHERE "achievementType" = 'CERTIFICATE';
UPDATE "F2fCredential" SET "expiresAt" = "issuedAt" + interval '3 years';
