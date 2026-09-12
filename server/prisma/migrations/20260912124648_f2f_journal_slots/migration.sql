-- Journal de Bord FACE2FACE en entrées à créneaux : entrée 1..3 par période,
-- ouverte à date fixe après la session (J+7/J+14/J+21). Table vide à date.
ALTER TABLE "F2fJournalEntry" ADD COLUMN "entryIndex" INTEGER NOT NULL;

CREATE UNIQUE INDEX "F2fJournalEntry_participantId_periodIndex_entryIndex_key"
  ON "F2fJournalEntry"("participantId", "periodIndex", "entryIndex");
