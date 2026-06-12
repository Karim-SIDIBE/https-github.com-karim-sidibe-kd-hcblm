# ADR 0001 — Socle LMS : construire (custom) ou acheter (Moodle) ?

- **Statut :** Proposé (en exploration — aucune décision engagée)
- **Date :** 2026-06-12
- **Branche :** `feat/moodle-exploration` (documentation seule, aucun code existant modifié)
- **Décideur :** Karim SIDIBE
- **Contexte produit :** KOMPETENCES DECLICK — plateforme d'apprentissage KD-HCBLM,
  apprenants sur **Android bas de gamme, 3G, hors ligne**, marché africain francophone.

---

## 1. Contexte

L'architecture cible visée se décompose en trois couches :

```
Terminaux apprenants (Android bas de gamme · 3G · hors ligne)
        │
  ┌─────┴───────────────────────────────────────────────┐
  │ 1 · Frontend sur mesure (PWA offline-first)          │  ← à garder
  │     micro-sessions · Moment d'Ancrage · badges       │
  ├──────────────────────────────────────────────────────┤
  │ 2 · Couche métier propre (différenciation)           │  ← le cœur de valeur
  │     logique KD-HCBLM · mobile money · WhatsApp/SMS    │
  ├──────────────────────────────────────────────────────┤
  │ 3 · Socle LMS « commodité »                          │  ← OBJET DE CETTE DÉCISION
  │     comptes/rôles · cours/quiz · notes · SCORM/xAPI   │
  └──────────────────────────────────────────────────────┘
```

Principe directeur invoqué : **« acheter la commodité (couche 3), construire le
différenciateur (couches 1 et 2) ».** Le principe est sain. La question : faut-il
remplacer le socle **déjà construit** (`server/`, custom) par un **Moodle headless** ?

### Fait déterminant : la couche 3 existe déjà, et elle est spécifique

`server/` **n'est pas** de la plomberie LMS générique. Il implémente déjà, et de
façon **taillée pour la pédagogie KD-HCBLM** :

- modèle de contenu sous contrat unique (Zod) : 5 blocs fixes, fil rouge
  `{{moment_ancrage}}`, rubrique = 100, seuils par niveau, *publish gate* ;
- moteur d'exécution : gating séquentiel, injection PAM au rendu, badges,
  reprise auto, relances J+3/7/14, score de productivité, 17 dispositifs Pilier 6 ;
- **et déjà les « standards » que Moodle vendrait** : comptes JWT/OIDC, RBAC,
  quiz, notes/suivi, **SCORM, xAPI/LRS, LTI** (modules `interop`, `lti`, `scorm`,
  `export`) ;
- offline-first (bundling, sync, reprise exacte) — **le vrai différenciateur** ;
- durcissement : rotation de clés, rate-limit + lockout, audit log ; **100 tests verts.**

## 2. Moteurs de la décision (déclarés)

| # | Moteur | Présent ? |
|---|--------|-----------|
| D1 | **Charge de maintenance** — réduire ce qu'on maintient soi-même | ✅ |
| D2 | **Confiance / pérennité** du moteur custom (robustesse, auditabilité, bus-factor) | ✅ |
| D3 | **Interopérabilité** avec des systèmes Moodle/SCORM/LTI | ✅ |
| D4 | **Exigence marché/client** (un acheteur impose Moodle) | ❌ **non** |

> L'absence de D4 est **pivot** : rien n'oblige Moodle. La décision est interne et
> doit donc se juger au coût/risque d'ingénierie, pas à une contrainte externe.

## 3. Contraintes non négociables

- **C1 — Offline-first** sur Android bas de gamme / 3G. *Tout* choix de socle doit
  préserver le bundling de contenu + la synchronisation + la reprise hors ligne.
- **C2 — Petite équipe.** Le poids opérationnel (hébergement, montées de version,
  recrutement) compte autant que les lignes de code.
- **C3 — Préserver la couche 1.** Le PWA ne parle qu'à un **contrat d'API** stable.
- **C4 — Ne pas régresser** sur la conformité déjà acquise (Pilier 6, PAM, v2.1).

## 4. Recadrage essentiel

**`server/` EST déjà la couche 2.** Le PWA (couche 1) se moque de ce qu'il y a
derrière le contrat d'API. La vraie question n'est donc pas « PWA + Moodle » mais :
**« qu'est-ce qui vit derrière le contrat d'API — la base Postgres actuelle, ou
Moodle ? »** Or la partie *générique* que Moodle reprendrait est **minoritaire**
dans `server/` ; la majorité (pédagogie + offline) resterait à construire/maintenir
en couche 2 **quel que soit** le socle.

## 5. Options considérées

### Option A — Moodle headless comme socle (couche 3)

Le PWA → couche 2 (adaptateur) → **Moodle** via Web Services (REST) pour comptes,
inscriptions, cours/activités, notes, complétion.

**Avantages**
- Cœur LMS maintenu par une grande communauté ; patchs sécurité, CVE process.
- Crédibilité « Moodle » ; SCORM/LTI/xAPI natifs ; gros vivier de compétences Moodle.
- Périmètre d'audit sécurité réduit aux couches 1-2 (le socle est « hérité »).

**Inconvénients (contre nos contraintes)**
- **Maintenance déplacée, pas réduite** (D1 ✗) : on opère un **monolithe PHP/MySQL**
  (cron, plugins, montées de version majeures douloureuses) **+** un adaptateur
  **+** la glu — pour une petite équipe (C2), c'est souvent **plus** lourd.
- **Inadéquation de modèle** : contrat strict KD-HCBLM ↔ modèle générique Moodle
  (cours/sections/activités) ⇒ couche de traduction complexe et fragile.
- **Offline-first fragilisé** (C1 ✗) : Moodle est pensé *online* ; la couche 2 devrait
  porter tout le bundling/sync contre un système non conçu pour ça.
- **On réécrit quand même** gating, injection PAM, badges, relances, score, 17
  dispositifs (le moteur de complétion Moodle ≠ le nôtre) ⇒ D1/D2 mal servis.
- **Bus-factor déplacé** (D2 partiel) : « Moodle headless + adaptateur » est une
  compétence de niche, pas plus simple à recruter qu'un dev Node/TS.
- Poids opérationnel ↑ sur VPS modeste.

### Option B — Garder le moteur custom + ponts d'interop + plan de dé-risquage (recommandée)

On **ne remplace pas** le socle. On le **consolide** et on **interopère** avec Moodle.

- **Interop (D3)** : renforcer/valider les ponts **SCORM + LTI + xAPI** déjà présents
  → on se branche *sur* Moodle (et d'autres) **sans** en dépendre. Additif, zéro
  réécriture, ne touche pas l'offline.
- **Confiance + maintenance (D2, D1)** : un **plan de propriété/maintenance** —
  doc d'architecture, automatisation des dépendances (Dependabot/CI), audit sécurité
  ciblé, runbooks, sauvegardes/restauration testées. Bien moins cher et risqué qu'une
  migration, et vise précisément la pérennité.

**Avantages** : préserve l'offline-first et la conformité (C1, C4) ; coût/risque
faibles ; livre vite de la valeur (interop) ; cible directement D1/D2/D3.
**Inconvénients** : on continue d'« posséder » le cœur LMS (mais il est déjà bâti et
testé) ; la crédibilité « Moodle » se gagne par l'interop, pas par le label.

### Option C — Hybride / spike avant décision

Garder B comme cap, **mais** réaliser d'abord une **preuve de concept Moodle bornée**
(voir `0002-moodle-poc-plan.md`) pour **mesurer** factuellement A avant tout engagement.
Décision A-vs-B **pilotée par les chiffres** du PoC, pas par l'intuition.

## 6. Décision recommandée

**Option B**, validée par le **spike de l'Option C** si l'on veut des données dures.

Justification : sans exigence marché (D4 absent), une migration Moodle est une
**réécriture lourde et risquée** qui **fragilise l'offline-first** (C1, notre
différenciateur) tout en ne répondant que **partiellement** à D1/D2/D3. Les trois
moteurs déclarés se traitent **mieux** par l'interop + un plan de dé-risquage de
l'existant que par un changement de socle.

> ⚠️ **Ce qui inverserait la recommandation :** l'apparition de **D4** (un client,
> un appel d'offres ou un partenaire **impose** Moodle/SCORM/LTI comme socle, ou un
> besoin de cogestion de contenu *dans* Moodle par des tiers). Dans ce cas, relancer
> l'arbitrage A-vs-B avec ce poids nouveau.

## 7. Conséquences

- **Si B :** ouvrir un chantier « interop & dé-risquage » (ponts standards + plan de
  maintenance), sans toucher au moteur ni à l'offline.
- **Si on veut trancher par les faits d'abord :** exécuter le PoC borné
  (`0002-moodle-poc-plan.md`) ; ses critères « on continue / on arrête » décident.
- Dans tous les cas : `main` et le point de restauration `checkpoint-20260612-…`
  restent intouchés ; cette branche est documentaire.
