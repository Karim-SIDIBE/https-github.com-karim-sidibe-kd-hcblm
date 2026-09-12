-- Journal de Bord FACE2FACE en entrées à créneaux : entrée 1..3 par période,
-- ouverte à date fixe après la session (J+7/J+14/J+21).
-- Backfill défensif : si des entrées libres existent déjà (créées avant ce
-- déploiement), elles sont numérotées par ordre de dépôt dans leur période.
ALTER TABLE "F2fJournalEntry" ADD COLUMN "entryIndex" INTEGER;

UPDATE "F2fJournalEntry" e
SET "entryIndex" = n.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "participantId", "periodIndex" ORDER BY "createdAt", id
  ) AS rn
  FROM "F2fJournalEntry"
) n
WHERE e.id = n.id;

ALTER TABLE "F2fJournalEntry" ALTER COLUMN "entryIndex" SET NOT NULL;

CREATE UNIQUE INDEX "F2fJournalEntry_participantId_periodIndex_entryIndex_key"
  ON "F2fJournalEntry"("participantId", "periodIndex", "entryIndex");
