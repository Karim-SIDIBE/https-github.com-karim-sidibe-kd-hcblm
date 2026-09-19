# Référentiels officiels K-HCBLM

Copies de référence des documents officiels KOMPETENCES DECLICK et
KOMPETENCES FACE2FACE qui gouvernent la plateforme. **La version Word remise
par la direction pédagogique fait foi** ; ces conversions markdown sont
figées ici pour que le code, les revues et les tests renvoient à un texte
versionné dans le dépôt.

| Document | Fichier | Version | Rôle pour la plateforme |
|---|---|---|---|
| Modèle pédagogique officiel **K-HCBLM** | [`modele-k-hcblm-v2.2.md`](./modele-k-hcblm-v2.2.md) | v2.2 (rév. 4) | Le contrat pédagogique : 6 piliers, 5 blocs, typologie des unités (A1/A2), relances, badges, KPI. |
| **Socle commun d'évaluation certifiante** | [`socle-evaluation-certifiante-v1.1.md`](./socle-evaluation-certifiante-v1.1.md) | v1.1 | Bloc 4 : grille 100 pts (seuil 70, tous niveaux), critères S1–S4, minimums et non-compensation, incompatibilités/remise/rotation, encadrement de la suggestion automatisée (§8), calibration (§9), recours (§10). Les règles du socle sont destinées à être **portées par le code** de la plateforme. |
| **Gabarit d'annexe de parcours** | [`gabarit-annexe-parcours-v1.1.md`](./gabarit-annexe-parcours-v1.1.md) | v1.1 | Ce qu'une annexe fixe (critères du domaine, bandes) et les 8 contrôles avant chargement — vocation : règles de la porte de publication. |
| **Annexe Gestion du Temps N1** | [`annexe-gestion-du-temps-n1-v1.1.md`](./annexe-gestion-du-temps-n1-v1.1.md) | v1.1 | L'annexe remplie du parcours canonique (D4.C1–C3) — sert de contenu de référence et de fixture aux lots EVAL. |
| **K-HCBLM v2.3 — amendements A3/A4/A5** | [`k-hcblm-v2.3-amendements-a3-a4-a5.md`](./k-hcblm-v2.3-amendements-a3-a4-a5.md) | v2.3 | Validité 3 ans des certificats, seconde fonction du Moment d'Ancrage (composé dans la plateforme), authenticité du dossier certifiant (conditions préalables + instrumentation). |
| **Avenant n° 1 au socle DECLICK** (= socle **v1.2**) | [`avenant-1-socle-declick.md`](./avenant-1-socle-declick.md) | v1.2 · applicable 01/11/2026 | Bloc domaine 60 pts également répartis aux trois niveaux (N3 : S4 15/8, S1 10/5, S2 10, S3 5), multi-domaines, non-chevauchement + ordre de notation, familles de consignes, validité, **objet F** (authenticité : 4 signaux, observation, cloisonnement) + annexe technique. |
| **Référentiel des compétences** | [`referentiel-kompetences-v3.0.md`](./referentiel-kompetences-v3.0.md) | v3.0 · applicable 01/11/2026 | 13 domaines, 52 compétences (codes) — encodé dans `server/src/domain/referentiel.ts` pour la validation des grilles. |
| **Socle FACE2FACE + K-SPEM — repères** | [`socle-f2f-v1.0-reperes.md`](./socle-f2f-v1.0-reperes.md) | socle v1.0 · K-SPEM v2.1 | Les règles F2F portées par la plateforme : structure des modules (3/4/5 sessions, journal 6/9/12), conditions préalables §8.1, décision §9 (la nature du critère en défaut l'emporte), recours, assistance automatisée désactivée. |
| **Avenant n° 1 au socle FACE2FACE** (= socle **v1.1**) | [`avenant-1-socle-f2f.md`](./avenant-1-socle-f2f.md) | v1.1 · 15/10/2026 | Critère **S5** (15/8, mini-projet en condition préalable), **vérification orale des livrables** (descend d'une bande, verbatim reporté), **trois sources de preuve** + plancher de démonstration C.2, groupement de compétences, multi-domaines, mise en situation outillée. |
| **Avenant n° 2 au socle FACE2FACE** (= socle **v1.2**) | [`avenant-2-socle-f2f.md`](./avenant-2-socle-f2f.md) | v1.2 · 01/11/2026 | **Objet H** : familles de scénarios par annexe de domaine (une par parcours servi), grille commune, **famille et variante tracées sur la fiche de notation**. |
| **Avenant n° 3 au socle FACE2FACE** (= socle **v1.3**) | [`avenant-3-socle-f2f.md`](./avenant-3-socle-f2f.md) | v1.3 · 01/11/2026 | Limites assumées du niveau (I), **reprise : même évaluateur, 60 jours, variante différente, grille vierge, récusation de droit du candidat** (J), **table de bandes K.2 unique** (20/15/12/10 pts — minimum = haut de bande 2) (K), deux évaluateurs par famille (L), mention d'équivalence + validité 3 ans sur la fiche (M). |

## Arbitrages actés (août 2026)

- **Seuil certifiant : 70 points à tous les niveaux** (socle §1). Le seuil
  70/75/80 par niveau reste applicable **uniquement** au quiz final du Bloc 3 —
  aucune règle du socle ne porte sur le Bloc 3.
- **Journal de pratique : jamais de verrou technique** (modèle, Pilier 5). Les
  entrées manquantes sont sanctionnées par la grille (critère S1), pas par un
  blocage de la soumission.
- Bloc 0 : **une micro-session standard unique de 20 minutes** (amendement A1).
- Activité expérientielle longue : **mode continu ou distribué**, somme des
  durées des micro-tâches = durée annoncée (amendement A2).
- Évaluateurs habilités : minimum **2** par parcours ; le module FACE2FACE
  correspondant conditionne la déclaration d'incompatibilité à l'assignation.

## Arbitrages actés — lot FACE2FACE v1.3 (septembre 2026)

- Les grilles des modules F2F sont désormais **construites par la plateforme**
  (`server/src/domain/engine/f2f-rubric.ts`) : critères du domaine repris du
  parcours source + critères du socle F2F (S1/S2 et S4 ou S5 selon le niveau),
  bandes K.2, plancher de démonstration C.2 ; la validation refuse toute autre
  configuration. Les modules déjà créés en production conservent leur grille.
- Décision §9 F2F portée par `decideF2fCertification` : la **nature du critère
  en défaut** (source journal ou livrable) l'emporte sur la fourchette de
  total, conformément au socle — distincte de la décision DECLICK.
- Objets **E, I, L, M** (multi-domaines, limites assumées, deux évaluateurs
  par famille, mentions catalogue) : documentaires à ce stade, pas de portage
  logiciel dans ce lot. Les dépôts N3 du §8.1 v1.0 (dossier de transmission)
  restent hors périmètre.
