# Activer la suggestion automatisée (§8) sur un nouveau parcours — runbook

Procédure éprouvée sur `gestion-du-temps-n1` (août 2026, 8 passages de
calibration avant activation). Suivie à la lettre, elle évite de revivre le
même débogage : chaque incident rencontré a depuis son garde-fou dans la
plateforme, et ce document explique comment lire ce qu'elle affiche.

## Pré-requis (dans l'ordre)

1. **Grille à bandes publiée.** Le Bloc 4 du parcours porte une rubrique dont
   chaque critère a ses 4 bandes descriptives, ses minimums et sa ligne
   « Où chercher la preuve » (gabarit d'annexe v1.1). La calibration est
   refusée d'office sans bandes exploitables.
2. **Au moins 2 évaluateurs humains habilités** sur le parcours (écran
   Évaluation → Habilitations). La suggestion ne remplace jamais l'humain
   (§8.6) : elle n'apparaît qu'après son score.
3. **5 dossiers de référence** notés par le groupe de travail : des livrables
   RÉELS et contrastés (excellent / bon / seuil / remise / hors sujet), avec
   pour chacun les scores par critère arrêtés collectivement. Les scores de
   référence ne sont **jamais** transmis au modèle.
   - Longueur réaliste (≥ 600 caractères) — un texte trop court ne permet ni
     citations ni notation sérieuse.
   - Copier le texte tel quel (apostrophes typographiques, fautes du candidat
     comprises) : la plateforme neutralise la typographie et interdit au
     modèle de corriger le texte, mais le dossier de référence doit rester le
     document authentique.
4. **Clé API configurée** (`ANTHROPIC_API_KEY` dans `deploy/.env`). Sans clé,
   la calibration échoue bruyamment (mode strict) — elle ne mesure jamais le
   repli hors-ligne.

## Passer la calibration

Écran admin → Évaluation → « Suggestion automatisée » → choisir le parcours →
saisir les 5 dossiers (texte + scores de référence) → « Passer la calibration ».

Le verdict par dossier exige :

| Seuil | Règle |
|---|---|
| Écart ≤ 8 pts | total proposé vs total de référence (§8.8) |
| Bandes ≤ 1 | aucun critère ne dévie de plus d'une bande |
| Preuve §8.4 vérifiée | citations littérales ≥ 8 mots retrouvées, ou absence conforme |

La clé de calibration est `(parcours, modèle, version de grille)` : changer
`AI_MODEL`/`AI_GRADING_MODEL` ou republier la grille désactive la suggestion
jusqu'à recalibration (§8.8).

## Lire un échec — table des symptômes

| Symptôme affiché | Cause | Quoi faire |
|---|---|---|
| Erreur 502 `ai_calibration_failed` avec message API | Appel réel en échec (clé invalide, quota, réseau) ; rien n'est enregistré | Lire le message (statut + détail Anthropic), corriger la configuration, relancer |
| Erreur « réponse tronquée » | Budget de tokens dépassé | Ne devrait plus arriver (budgets dimensionnés) ; sinon raccourcir le dossier ou signaler |
| Preuve « échec » + détail `citation:not_found` | La citation diffère du dossier — depuis les correctifs, une vraie divergence de mots (le modèle reformule ou invente) | Lire la citation affichée en entier (200 car.) et la comparer au dossier ; relancer une fois — si récurrent sur le même critère, la ligne « Où chercher la preuve » est peut-être ambiguë |
| Preuve « échec » + `citation:too_short` seul | Aucun extrait ≥ 8 mots valide (les extraits d'appoint courts ne comptent pas) | Vérifier que le dossier contient des passages continus citables pour ce critère |
| Preuve « échec » + `absence:not_low_band` / `where_to_look_missing` | Déclaration d'absence hors bande basse, ou ne reprenant pas la ligne du critère | Généralement transitoire ; si récurrent, préciser « Où chercher la preuve » dans la grille |
| Écart > 8 ou bandes > 1, preuve OK | Divergence de jugement réelle entre le modèle et le groupe de travail | C'est ce que §8.8 mesure. Vérifier d'abord que les scores de référence respectent bien les descripteurs de bandes ; relancer une fois (une part de variance entre passages est normale) ; si récurrent, le modèle n'est pas calibrable sur cette grille en l'état — ne pas chercher à « faire passer » |

Signature disparue mais à connaître : un **75/100 uniforme sur tous les
dossiers** était le repli heuristique silencieux (incident d'origine). Le mode
strict le rend impossible en calibration — si vous le revoyez, c'est un bug à
signaler.

## Ce que la plateforme garantit déjà (ne pas re-déboguer)

- Mode strict : la calibration mesure le modèle réel, jamais le repli ; toute
  erreur API remonte avec sa cause exacte et rien n'est enregistré.
- Sortie structurée (JSON garanti par l'API) sur les modèles qui la
  supportent ; budgets de tokens dimensionnés pour la réflexion du modèle.
- Vérification des citations : typographie (apostrophes, guillemets, tirets)
  et casse neutralisées des deux côtés ; un extrait d'appoint trop court
  n'annule pas un extrait pleinement valide ; tout extrait introuvable ou
  elliptique reste disqualifiant (intégrité §8.4).
- Consignes au modèle : citation en copier-coller strict (fautes du candidat
  comprises, interdiction de corriger) ; attribution par bande avec ancrage
  déterministe du score dans la bande (zéro marge libre).
- Détail des preuves en échec affiché sous le tableau (critère, raison,
  citation en cause) — ne jamais diagnostiquer une pastille rouge à l'aveugle.

## Après l'activation

- La suggestion n'apparaît à l'évaluateur qu'après son propre score (§8.6),
  jamais en recours (§8.7) ; chaque suggestion est journalisée (§8.9) et les
  indicateurs §8.10 (taux de reprise à l'identique des preuves, écarts
  humain/IA) sont dans le même écran : les surveiller le premier mois.
- Recalibrer : à chaque changement de modèle ou de grille (automatique via la
  clé), et au plus tard tous les 12 mois comme pour les évaluateurs humains.
