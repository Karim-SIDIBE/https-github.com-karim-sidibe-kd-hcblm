# Plan de preuve de concept — Moodle headless comme socle (Option A)

- **Statut :** Proposé (non démarré)
- **Lié à :** `0001-lms-foundation-build-vs-buy.md`
- **But :** transformer l'arbitrage « custom vs Moodle » en **décision factuelle**,
  pas une intuition. Borné dans le temps, jetable, **sans aucune production**.

> Règle d'or : ce PoC est une **maquette**. Il ne touche ni `main`, ni `server/`,
> ni la base de production. Tout vit sur la branche `feat/moodle-exploration` et
> dans un Moodle jetable (conteneur local).

---

## 1. Objectif mesurable

Répondre, **chiffres à l'appui**, à une seule question :

> « Mettre Moodle headless sous notre contrat d'API réduit-il réellement la
> charge (D1) et le risque (D2) — sans casser l'offline-first (C1) ni la
> conformité KD-HCBLM (C4) — au point de justifier la migration ? »

## 2. Périmètre (volontairement minimal)

On mappe **UN seul** parcours : le canonique **Gestion du Temps N1 (v2.1)**,
limité à **Bloc 0 + Bloc 1**. Pas plus. On ne reconstruit pas la plateforme ;
on teste l'os le plus dur.

**Dans le périmètre :**
1. Monter un **Moodle jetable** (conteneur), activer les **Web Services REST**.
2. Créer via API : 1 utilisateur, 1 cours, l'inscription, et **mapper** Bloc 0/1
   (Moment d'Ancrage, profil, vidéo déclencheur, quiz diagnostique, micro-sessions).
3. Écrire un **adaptateur minimal** (couche 2 d'essai) qui expose **notre contrat
   d'API actuel** pour ces écrans, mais en parlant à Moodle derrière.
4. Brancher le **PWA existant en lecture** sur cet adaptateur (un écran suffit).

**Hors périmètre (explicitement) :** mobile money, WhatsApp/SMS, certification,
les 17 dispositifs au complet, montée en charge, multi-tenant.

## 3. Ce qu'on mesure (les métriques de décision)

| Métrique | Comment | Seuil « bon » |
|---|---|---|
| **M1 — Couverture native** | % des comportements Bloc 0/1 assurés *par Moodle* sans code custom (gating, complétion, notes) | ≥ 60 % |
| **M2 — Reconstruction en couche 2** | Combien de notre moteur doit être **réécrit** par-dessus Moodle (PAM, gating séquentiel exact, score) | « peu » (qualitatif + liste) |
| **M3 — Fidélité offline** | Peut-on bundler le contenu mappé + reprendre hors ligne **sans** régression vs aujourd'hui ? | Oui / Non (bloquant) |
| **M4 — Effort d'intégration** | Temps réel passé sur le mapping + adaptateur (jours-homme) | ≤ le timebox |
| **M5 — Poids opérationnel** | RAM/CPU du conteneur Moodle, étapes d'install/upgrade, dépendances | Comparé au stack actuel |
| **M6 — Fidélité du modèle** | Le contrat KD-HCBLM (5 blocs, `{{moment_ancrage}}`, rubrique=100) survit-il au mapping Moodle ? | Sans perte |

## 4. Critères « ON CONTINUE / ON ARRÊTE » (décidés à l'avance)

**On ARRÊTE (Moodle écarté) si l'un de ces points est vrai :**
- ❌ **M3 = Non** : l'offline-first régresse ou devient nettement plus complexe.
- ❌ **M1 < 50 %** : Moodle ne couvre même pas la moitié du générique → faible gain.
- ❌ **M2 = « on réécrit l'essentiel du moteur quand même »** → D1/D2 non servis.
- ❌ **M5** : poids opérationnel jugé incompatible avec une petite équipe / VPS modeste.

**On CONTINUE (PoC étendu, puis décision A) seulement si :**
- ✅ M3 = Oui **et** M1 ≥ 60 % **et** M2 = « surcouche raisonnable » **et** M6 sans perte.

> En clair : **l'offline (M3) est éliminatoire.** S'il casse, la discussion s'arrête là.

## 5. Étapes & timebox

**Timebox total : 3 à 5 jours-homme.** Au-delà, on arrête et on tranche avec ce qu'on a.

1. **J1** — Moodle jetable en conteneur + Web Services activés + premiers appels
   (créer user/cours/inscription par API). *Sortie : M5 préliminaire.*
2. **J2** — Mapper Bloc 0 (Moment d'Ancrage, profil, vidéo, quiz déclencheur) sur
   des activités Moodle. *Sortie : M1, M6.*
3. **J3** — Mapper Bloc 1 (quiz diagnostique + micro-sessions) + tenter le **gating
   séquentiel** et la **complétion**. *Sortie : M1, M2.*
4. **J4** — Adaptateur minimal exposant notre contrat d'API ; brancher **un écran**
   du PWA. *Sortie : M4.*
5. **J5** — Test **offline** (bundle + reprise) sur l'écran mappé. *Sortie : M3
   (éliminatoire) ; rédaction du verdict.*

## 6. Livrable du PoC

Un court **rapport de verdict** (à ajouter ici en `0003-moodle-poc-results.md`) :
le tableau M1–M6 rempli, la décision *continue/arrête* tranchée par §4, et — si
arrêt — la bascule explicite vers l'Option B (interop + dé-risquage).

## 7. Risques du PoC lui-même

- **Install Moodle chronophage** → si J1 déborde, c'est déjà un signal M5 négatif.
- **Biais d'optimisme** → s'en tenir aux seuils §4 décidés *avant*, ne pas les
  déplacer en cours de route.
- **Périmètre qui enfle** → refuser tout ajout hors §2 ; le but est de tester l'os
  le plus dur, pas de bâtir un produit.

## 8. Ce que ce PoC ne décide PAS

Il ne dit rien sur l'**IA locale / RGPD** (sujet orthogonal, voir discussions
antérieures) ni sur le mobile money / WhatsApp. Il tranche **uniquement** le choix
de socle de la couche 3.
