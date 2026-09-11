-- Révélation des scores de la suggestion (§8.6/§8.10).
ALTER TABLE "AiAssessment" ADD COLUMN "revealedAt" TIMESTAMP(3);

-- Historique : avant l'aide à la preuve (déployée le 10/09/2026 au soir),
-- une suggestion n'était CRÉÉE qu'au moment de son affichage à l'évaluateur
-- (§8.6) — la création valait donc révélation.
UPDATE "AiAssessment"
SET "revealedAt" = "createdAt"
WHERE "kind" = 'RUBRIC_SUGGESTION' AND "createdAt" < '2026-09-10T20:00:00Z';

-- Dossiers liés à une notation finale alors que leurs scores n'avaient JAMAIS
-- été montrés (enregistrements créés par l'aide à la preuve seule) : la
-- concordance §8.10 calculée dessus est un artefact — on la délie. La preuve
-- (copyFlags) reste : les citations, elles, étaient bien visibles.
UPDATE "AiAssessment"
SET "finalScores" = NULL
WHERE "kind" = 'RUBRIC_SUGGESTION' AND "revealedAt" IS NULL AND "finalScores" IS NOT NULL;
