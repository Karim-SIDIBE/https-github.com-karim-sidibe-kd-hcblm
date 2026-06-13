# ADR 0003 — Audit sécurité de l'existant & comparaison face à Moodle

- **Statut :** Constat (audit) + plan de remédiation
- **Date :** 2026-06-12
- **Branche :** `feat/moodle-exploration` (chantier Option B : interop & dé-risquage)
- **Répond à :** « À quel point notre modèle est-il sûr comparé à Moodle, et s'il y
  a un écart, comment y remédier ? »

---

## 1. Verdict en une phrase

Le **design de sécurité de notre serveur est sain et moderne** ; l'écart avec
Moodle **n'est pas dans le code applicatif** mais dans le **processus** (cadence de
mise à jour des dépendances, en-têtes de sécurité, veille CVE). Ces écarts sont
**peu nombreux et concrets** — on les ferme sans adopter Moodle.

## 2. Posture de sécurité actuelle (constaté dans le code)

| Domaine | Mécanisme en place | Évaluation |
|---|---|---|
| Mots de passe | **argon2** (hash mémoire-dur) | ✅ État de l'art (> bcrypt) |
| Jetons | **jose** ES256 (1ʳᵉ partie) + OIDC | ✅ Standard, signé asymétrique |
| Validation d'entrée | **Zod** partout + shape d'erreur uniforme | ✅ Anti-injection applicative |
| Accès BD | **Prisma** (requêtes paramétrées) | ✅ Résistant SQLi par défaut |
| Autorisation | RBAC + *ownership guards* (`domain/auth/permissions`) | ✅ Modèle clair |
| Anti-bruteforce | rate-limit global + cap renforcé sur l'auth + **lockout** | ✅ |
| Uploads | multipart **borné** (`MEDIA_MAX_BYTES`) | ✅ |
| CORS | restreint en prod via `CORS_ORIGINS` | ✅ *(si bien défini en prod)* |
| Traçabilité | **audit log** + rotation de clés | ✅ |
| CSRF | API **Bearer** (pas de cookie ambiant) | ✅ Surface CSRF quasi nulle |
| Qualité | **100 tests** + **CI** (Postgres, migrations, typecheck, build) | ✅ Mûr |
| Standards | modules **interop (SCORM/xAPI), LTI, SCIM, SAML** déjà présents | ✅ |

> Autrement dit, la plupart des « bonnes pratiques » que Moodle vendrait sont
> **déjà là**, avec un stack moderne et sûr par défaut.

## 3. Écarts identifiés (priorisés)

| # | Écart | Gravité | Effort | Statut |
|---|-------|---------|--------|--------|
| G1 | **En-têtes de sécurité absents** (`@fastify/helmet` non installé) : pas de CSP, HSTS applicatif, X-Frame-Options, X-Content-Type-Options, Referrer-Policy | Moyen | Faible | À faire |
| G2 | **6 vulnérabilités prod** (1 modérée, 5 hautes) dans les deps transitives de **fastify v4** (`fast-json-stringify`, `fast-uri`) + **`fast-xml-parser`** (injection XML — pertinent car SCORM/xAPI/SAML parsent du XML non fiable). Correctif = montée **fastify v5** + **fast-xml-parser v5** (changements cassants → migration testée) | Haut (théorique) | Moyen | Planifié |
| G3 | **Fuite d'info sur 5xx** : le handler renvoyait `err.message` brut | Faible | Faible | ✅ **Corrigé** (ce passage) |
| G4 | **CI sans audit de dépendances** : aucune alerte continue sur les CVE | Faible | Faible | ✅ **Corrigé** (ce passage) |
| G5 | **Hygiène de config** : vérifier que `CORS_ORIGINS` est bien défini en prod (sinon CORS reflète toute origine) | Faible | Trivial | À vérifier côté `deploy/.env` |
| G6 | **Process** : pas de veille CVE formalisée ni de politique de divulgation (`SECURITY.md`) | Faible | Faible | À faire |

> ⚠️ Sur G2, la gravité « haute » est **théorique** (deps transitives de
> sérialisation) : l'exploitabilité réelle dépend du chemin. La plus concrète est
> **`fast-xml-parser`** car on ingère du **XML non fiable** (paquets SCORM, SAML).
> À traiter en priorité dans la montée de version.

## 4. Comparaison honnête : notre modèle vs Moodle

| Critère | Notre serveur custom | Moodle |
|---|---|---|
| **Surface d'attaque** | **Petite et bornée** : endpoints maîtrisés, **pas de système de plugins**, pas d'injection de templates serveur | **Très grande** : énorme monolithe PHP **+ écosystème de plugins tiers** (vecteur de risque majeur) |
| **Sûr par défaut** | TypeScript, Prisma (paramétré), Zod, argon2, jose | PHP/MySQL ; sûr si **bien configuré et à jour** |
| **Maturité / « many eyes »** | Petite base, **auditable en une journée**, 100 tests | Code massif, **audité par une large communauté**, pentesté |
| **Processus CVE** | À formaliser (G6) — **c'est l'écart** | **Process formel**, advisories + releases de sécurité régulières |
| **Cible** | Peu visible, **pas une cible de masse** | **Cible populaire** → fortement scanné/attaqué |
| **Cause réelle des brèches** | Deps non patchées (G2) | **Instances non mises à jour** + **plugins vulnérables** (cause n°1 dans la nature) |
| **Qui patche** | **Vous** (bus-factor à gérer) | Communauté pour le cœur ; **vous** pour plugins + l'instance |

**Synthèse :** **aucun des deux n'est intrinsèquement « plus sûr ».** Moodle a un
cœur durci mais une **surface énorme amplifiée par les plugins**, et ses brèches
réelles viennent surtout d'**instances non patchées** ou de **plugins vulnérables**.
Notre modèle a une **surface bien plus petite** et un outillage moderne sûr par
défaut, mais **dépend de nous** pour le patch et la veille. **L'écart n'est donc pas
de design — il est de processus.** En fermant G1, G2, G5, G6, on atteint une posture
**comparable, voire meilleure en surface d'attaque**, qu'un déploiement Moodle
typique — sans en hériter le poids.

## 5. Feuille de route de remédiation

**Lot 1 — rapide, faible risque (recommandé maintenant)**
1. ✅ Durcir la fuite 5xx en prod *(fait)*.
2. ✅ Étape `npm audit` dans la CI *(fait)*.
3. **Installer `@fastify/helmet`** + l'enregistrer (G1) — quelques lignes, à tester.
4. Ajouter un **`SECURITY.md`** (politique de divulgation) + activer **Dependabot**
   (G6) — fichiers seuls, zéro risque.
5. **Vérifier `CORS_ORIGINS`** dans `deploy/.env` (G5).

**Lot 2 — planifié, testé (tâche dédiée)**
6. **Montée fastify v4 → v5** + **fast-xml-parser v5** (G2), avec la suite de 100
   tests + un smoke HTTP comme garde-fou. Migration réelle, à isoler sur sa branche.

**Lot 3 — interop (valeur marché, additif)**
7. Auditer/valider les ponts **SCORM / LTI / xAPI** existants et documenter ce qui
   est conforme vs à compléter — c'est ce qui te donne la crédibilité « Moodle »
   **sans** Moodle.

## 6. Fait dans ce passage

- `server/src/app.ts` : 5xx ne fuit plus `err.message` en production (4xx restent
  informatifs). Vérifié : **typecheck OK, 100 tests verts**.
- `.github/workflows/ci.yml` : ajout d'un job **`audit`** (visibilité CVE continue).
- Documentation seule par ailleurs ; `main` et le point de restauration intouchés.
