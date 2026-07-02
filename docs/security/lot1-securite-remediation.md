# Lot 1 sécurité — revue applicative & remédiation

- **Statut :** ✅ Fait (vérifié : typecheck 5 workspaces · 154 tests · smoke HTTP + DB réelle)
- **Date :** 2026-07-02
- **Branche :** `claude/lot1-securite-setup-ogaib0`
- **Cadre :** revue ciblée du serveur (auth/jetons, autorisation/multi-tenant,
  injection/SSRF/parsing, uploads/crypto/secrets) — OWASP ASVS L2, RGPD.
- **Prolonge :** `../architecture/0004-modern-lms-security-baseline.md`.

## Verdict

Les couches cœur (JWT ES256 durci, rotation refresh + détection de réutilisation,
Argon2id, Prisma paramétré, pas de XXE) sont saines. Le risque réel se concentrait
sur (1) la **confiance d'identité fédérée**, (2) l'**absence de scoping tenant**
sur les surfaces de reporting, et (3) l'**antivirus non câblé** sur l'upload média.
Six findings retenus (2 Critiques, 4 Hautes), tous corrigés et vérifiés.

## Findings & correctifs

| # | Gravité | Finding | Type | Vérifié |
|---|---------|---------|------|---------|
| **C1** | Critique | **Élévation de privilège via SSO fédéré** : `federatedLogin` / `principalFromExternal` liaient l'identité au seul claim `email`, sans `email_verified`, adoptant un compte pré-existant (y compris ADMIN). Vecteur le plus net : LTI (`jit:true`, email fourni par la plateforme). | edit | ✓ 5 scénarios (adoption staff/local → `account_conflict`, JIT verified OK, `emailVerified:false` → refus, `jit:false` → `no_account`) |
| **C2** | Critique | **Fuite de PII apprenant inter-tenant** : routes analytics + planification de rapports gardées par le seul `analytics:read` (rôle client, hors staff), requêtes par `courseId`/`enrollmentId` sans filtre d'organisation → nom, e-mail, *Moment d'Ancrage* d'autres tenants ; exfiltration via `recipients[]` arbitraires. | câblage | ✓ ENTERPRISE_CLIENT → 404 (analytics/pam/learners, create schedule) ; SUPER_ADMIN → 200/201 |
| **H1** | Haute | **Antivirus jamais invoqué sur l'upload média** : la route ne faisait qu'un heuristique sur les 256 premiers Ko ; le vrai ClamAV (`scanUpload`) n'était pas atteint même avec `CLAMAV_HOST` défini. | câblage | ✓ EICAR après 256 Ko : 201 (avant) → 422 (après, `CLAMAV_HOST` défini) ; fichier sain → 201 |
| **H2** | Haute | **Statements xAPI LRS non scopés** : `GET /lrs/statements` lisible par tout porteur `analytics:read`, tout apprenant / tout tenant. | câblage | ✓ ENTERPRISE_CLIENT sans `courseId` → 403 ; sur cours d'un autre tenant → 404 ; SUPER_ADMIN → 200 |
| **H3** | Haute | **Sessions non révoquées** au reset de mot de passe / changement 2FA : les familles de refresh tokens antérieures restaient valides jusqu'à 30 j. | câblage | ✓ 2 sessions actives avant reset → 1 après ; ancien refresh token → `token_reuse_detected` |
| **H4** | Haute | **Bypass d'authentification fail-open `x-user-id`** : la trappe dev s'activait pour tout `NODE_ENV != "production"` (défaut `development`) → imposture totale sur staging / env mal configuré. | edit | ✓ `AUTH_DEV_HEADER` non défini → `x-user-id` rejeté (401) ; `=true` + `NODE_ENV=production` → hard-fail au boot |

## Fichiers neufs

- `server/src/lib/security/tenant-scope.ts` — résolveur cours/inscription/cohorte
  → organisation + assertion d'appartenance ; réponses en **404** (pas 403) pour ne
  pas confirmer l'existence d'une ressource d'un autre tenant. Règle : le staff
  plateforme garde la portée complète ; les rôles client (`ENTERPRISE_CLIENT`,
  `ENTERPRISE_ADMIN`, `EMPLOYER`) sont confinés aux cours de leur organisation et
  n'accèdent jamais au jeu de données plateforme (cours `organizationId = null`).
- `server/src/lib/net/ssrf-guard.ts` — `assertPublicUrl` : rejette schémas non
  http(s) et hôtes loopback / link-local (169.254.169.254) / RFC-1918 / ULA, avec
  résolution DNS (anti-rebinding). Câblé dans la livraison webhook sortante
  (durcit le SSRF aveugle « Bas » identifié). Couvert par 7 tests unitaires.

## Périmètre & décisions

- Les rôles client perdent l'accès aux analytics des **cours partagés**
  (`organizationId = null`) : c'est volontaire (ils y liraient la PII de tous les
  apprenants B2C). Un filtrage par inscription org-scopé pourra être ajouté comme
  fonctionnalité ultérieure si un besoin métier émerge.
- La trappe `x-user-id` devient **opt-in strict** (`AUTH_DEV_HEADER=true`) : le dev
  local doit désormais l'activer (fait dans `server/.env.example`).

## Reste à traiter (Moyen/Bas — lots suivants)

SAML `audience:false` + absence d'`InResponseTo` (rejeu d'assertion) · AV
fail-open par défaut (`AV_FAIL_CLOSED`) · `FIELD_ENCRYPTION_KEY` optionnel (secrets
TOTP en clair si absent en prod) · OTP reset brute-forçable (6 chiffres, pas de cap
par compte) · `GET /users/:id` énumération e-mail/rôle · codes de secours 40-bit non
salés · zip-bomb à l'import SCORM · XSS stocké SVG média · adoption SCIM inter-tenant
· registre d'appareils sans ownership.

## Note d'exploitation (sandbox)

Le client Prisma se génère hors-ligne en pointant `PRISMA_QUERY_ENGINE_LIBRARY` /
`PRISMA_SCHEMA_ENGINE_BINARY` sur des moteurs `debian-openssl-3.0.x` téléchargés
manuellement (le downloader Prisma est coupé par la politique d'egress du bac à
sable, mais `binaries.prisma.sh` répond en direct).
