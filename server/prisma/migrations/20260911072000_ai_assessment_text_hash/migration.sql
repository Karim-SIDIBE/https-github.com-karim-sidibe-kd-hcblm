-- Empreinte du texte analysé : la réutilisation d'une suggestion exige un
-- dossier STRICTEMENT identique. Les enregistrements historiques (NULL) ne
-- sont plus jamais réutilisés — le prochain appel réanalyse le dossier
-- recomposé en direct (journaux inclus).
ALTER TABLE "AiAssessment" ADD COLUMN "textHash" TEXT;
