# ADR 0004 — Référentiel de sécurité « LMS dernière génération »

- **Statut :** Référentiel cible + feuille de route séquencée
- **Date :** 2026-06-13
- **Cadre :** OWASP **ASVS** (cible niveau L2), **RGPD**, et bonnes pratiques
  **spécifiques LMS** (LTI 1.3, SCORM/xAPI, intégrité d'évaluation, données apprenants).
- **Prolonge :** `0003-security-audit-vs-moodle.md`.

Légende : ✅ en place · ⚠️ partiel / à valider · ❌ absent (à construire).

---

## A. Sécurité applicative

| Contrôle | Statut | Action |
|---|---|---|
| En-têtes de sécurité (HSTS, nosniff, Referrer-Policy, CORP…) | ✅ | helmet (LMS-aware) — **Lot 1** |
| Validation d'entrée (toutes routes) | ✅ | Zod |
| Pas de fuite d'erreur (5xx) | ✅ | durci — **Lot 1 précédent** |
| Scan de dépendances (CVE) | ✅ | CI `npm audit` + **Dependabot** — Lot 1 |
| Analyse statique (SAST) | ✅ | **CodeQL** `security-extended` — Lot 1 |
| Détection de secrets commités | ✅ | **gitleaks** en CI — Lot 1bis fait |
| CSP sur les front-ends (Caddy) | ⚠️ | définir une CSP stricte côté PWA/admin (Caddyfile) — Lot 6 |

## B. Authentification

| Contrôle | Statut | Action |
|---|---|---|
| Hash mots de passe mémoire-dur | ✅ | argon2 |
| SSO entreprise (OIDC / SAML / SCIM) | ✅ | déjà présent |
| **MFA / 2FA (TOTP)** | ✅ | RFC 6238, pur Node, codes de secours — **Lot 3 fait** |
| Politique de mot de passe + **vérif. fuite (HIBP k-anonymity)** | ✅ | inscription + reset — **Lot 3 fait** |
| Verrouillage anti-bruteforce | ✅ | lockout |

## C. Autorisation

| Contrôle | Statut | Action |
|---|---|---|
| RBAC + ownership guards | ✅ | `domain/auth/permissions` |
| Isolation multi-tenant (org) | ✅ | scoping par organisation |
| Moindre privilège BD (rôle applicatif ≠ superuser) | ⚠️ | vérifier le rôle Postgres de prod — Lot 5 |

## D. Sessions & jetons

| Contrôle | Statut | Action |
|---|---|---|
| Accès courte durée + refresh | ✅ | refresh tokens |
| **Rotation + détection de réutilisation** du refresh | ✅ | **déjà implémenté** (RFC 9700) — confirmé à l'audit |
| Révocation / gestion des sessions & appareils | ❌ | écran « mes sessions » + révocation — Lot 4 |

## E. Protection des données

| Contrôle | Statut | Action |
|---|---|---|
| Chiffrement en transit (TLS) | ✅ | Caddy (Let's Encrypt) |
| **Chiffrement au repos** (disque/volume BD) | ⚠️ | activer le chiffrement de volume + sauvegardes chiffrées — **Lot 5** |
| **Chiffrement au niveau champ** (PII sensibles) | ❌ | chiffrer e-mail/téléphone/pair au repos — Lot 5 (à arbitrer) |
| Gestion des secrets | ⚠️ | `deploy/.env` → envisager un **secret manager** + rotation — Lot 5 |
| Rotation des clés de signature | ✅ | déjà en place |
| Sauvegardes **+ restauration testée** | ⚠️ | scripts présents ; **tester la restauration** régulièrement — Lot 5 |

## F. Vie privée / RGPD (sensible pour l'éducation)

| Contrôle | Statut | Action |
|---|---|---|
| Résidence des données (auto-hébergé UE/maîtrisé) | ✅ | VPS sous contrôle |
| Export des données (portabilité) | ✅ | module `export` |
| **Droit à l'effacement** (suppression réelle apprenant) | ❌ | flux d'anonymisation/suppression — **Lot 4** |
| **Politique de rétention** (purge automatique) | ❌ | définir durées + purge planifiée — Lot 4 |
| Gestion du consentement | ⚠️ | bannière + registre — Lot 4 |
| Journal d'audit (accès/modifs) | ✅ | audit log |
| Registre des sous-traitants / DPA | ⚠️ | documenter (ex. si IA un jour) — Lot 4 |

## G. Spécifique LMS

| Contrôle | Statut | Action |
|---|---|---|
| **LTI 1.3** : OIDC login, validation JWT (`iss`/`aud`/`nonce`/`exp`), clés JWKS | ⚠️ | **auditer** le module `lti` vs 1.3 — **Lot 7 (interop)** |
| SCORM / xAPI : **parsing XML non fiable** durci | ⚠️ | fast-xml-parser v5 + limites — lié **Lot 2** |
| **Anti-virus à l'upload** (médias / paquets SCORM) | ❌ | scan ClamAV à l'ingestion — Lot 6 |
| Auth LRS xAPI (clés par client) | ⚠️ | valider l'authent. des statements — Lot 7 |
| Intégrité d'évaluation (anti-triche léger) | ⚠️ | hors périmètre sécurité « système » ; à cadrer produit |

## H. Sécurité opérationnelle

| Contrôle | Statut | Action |
|---|---|---|
| CI (typecheck/tests/build) | ✅ | déjà présent |
| Audit deps + SAST en CI | ✅ | **Lot 1** |
| Politique de divulgation | ✅ | **SECURITY.md** — Lot 1 |
| Durcissement conteneur (non-root, rootfs read-only, caps) | ⚠️ | revoir `deploy/Dockerfile`/compose — Lot 6 |
| Supervision / alerting (logs, erreurs, intrusion) | ❌ | brancher logs + alertes — Lot 6 |
| Rate-limit / protection DoS | ⚠️ | rate-limit applicatif ✅ ; envisager WAF/CDN au bord — Lot 6 |

## I. Posture de conformité visée

- **OWASP ASVS L2** comme cible (app web traitant des données personnelles).
- **RGPD** : Lot 4 ferme les manques clés (effacement, rétention, consentement).
- **FERPA** (si clients/établissements US) : à évaluer le moment venu.
- **Accessibilité WCAG** : qualité connexe, à suivre côté front.

---

## Feuille de route séquencée

| Lot | Contenu | Risque | Type |
|---|---|---|---|
| **1** | helmet · SECURITY.md · Dependabot · CodeQL · audit CI · 5xx durci | Faible | ✅ **fait (ce passage + précédent)** |
| **1bis** | gitleaks/secret scanning · garde `CORS_ORIGINS` en prod | Faible | ✅ **fait** |
| **2** | Montée **fastify v5** + fast-xml-parser v5 (ferme les 6 CVE prod + durcit XML) | Moyen | ✅ **fait** |
| **3** | **2FA TOTP** + codes de secours · politique mdp + HIBP (rotation refresh déjà en place) | Moyen | ✅ **fait** |
| **4** | **RGPD** : effacement · rétention/purge · consentement · sessions/révocation | Moyen | Fonctionnalités |
| **5** | Chiffrement au repos (volume + champs) · secrets manager · moindre privilège BD · restauration testée | Moyen-élevé | Infra + code |
| **6** | AV upload (ClamAV) · CSP front (Caddy) · durcissement conteneur · supervision/alerting · WAF | Moyen | Infra + ops |
| **7** | **Interop** : audit LTI 1.3 · auth LRS xAPI · conformité SCORM/xAPI | Faible-moyen | Valeur marché |

> Principe : on avance par **lots vérifiés** (typecheck + 100 tests + smoke HTTP),
> jamais de big-bang. `main` et le point de restauration restent intouchés tant
> qu'un lot n'est pas validé et fusionné via PR.

## Décisions ouvertes (à arbitrer avec toi)

1. **2FA** : TOTP (Google/Microsoft Authenticator) d'abord — OK ? (WebAuthn/passkeys plus tard ?)
2. **Chiffrement au repos** : volume BD chiffré suffisant, ou aussi chiffrement
   **par champ** des PII (plus sûr, plus de complexité applicative) ?
3. **Effacement RGPD** : suppression dure, ou **anonymisation** (préserve les
   statistiques agrégées) ? Recommandation : anonymisation.

## Fait dans ce passage (Lot 1, vérifié : typecheck + 100 tests + boot/headers)

- `@fastify/helmet@11` (compatible Fastify v4) enregistré avec une config
  **consciente des flux LMS** (CSP/frameguard désactivés pour ne pas casser
  LTI-iframe et SAML-HTML ; CORP cross-origin pour les médias). En-têtes vérifiés
  en exécution réelle.
- `SECURITY.md`, `.github/dependabot.yml`, `.github/workflows/codeql.yml`.
- Confirmé au passage : la montée **Fastify v5 (Lot 2)** est la vraie cible — les
  plugins récents l'exigent (helmet v13 voulait Fastify 5.x).
