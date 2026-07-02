# Lot 2 sécurité — durcissement Moyen / Bas

- **Statut :** ✅ Fait (vérifié : typecheck 5 workspaces · 154 tests · smokes HTTP + DB réelle)
- **Date :** 2026-07-02
- **Branche :** `claude/lot1-securite-setup-ogaib0`
- **Prolonge :** `lot1-securite-remediation.md` (ferme le reliquat Moyen/Bas de la revue).

## Findings & correctifs

| # | Gravité | Finding | Type | Vérifié |
|---|---------|---------|------|---------|
| **M1** | Moyen | **`trustProxy` absent** : derrière Caddy, `req.ip` = IP du proxy → rate-limit par IP inefficace + audit faussé. | edit | boot OK, `trustProxy` câblé |
| **M2** | Moyen | **Antivirus fail-open par défaut** : clamd injoignable ⇒ upload accepté. Passé en **fail-closed** par défaut. | edit | clamd injoignable → 422 (défaut) ; `AV_FAIL_CLOSED=false` → 201 |
| **—** | Moyen | **Bug de parsing booléen** (`z.coerce.boolean()` mappe la chaîne `"false"` sur `true`) : `PASSWORD_BREACH_CHECK=false` / `AV_FAIL_CLOSED=false` / `TRUST_PROXY=false` étaient inopérants. Corrigé (transform enum). | edit | override `AV_FAIL_CLOSED=false` désormais effectif |
| **M3** | Moyen | **`FIELD_ENCRYPTION_KEY` optionnel** → secrets TOTP en clair si absent en prod. Boot **hard-fail** en production sans clé. | edit | prod sans clé → exit 1 |
| **M4** | Moyen | **OTP reset/vérif brute-forçable** (6 chiffres, aucun cap par compte). Compteur d'échecs par code + invalidation au bout de 5, et invalidation des codes précédents à chaque réémission. | edit + migration | 5 essais → code invalidé ; réémission → nouveau code OK |
| **M5** | Moyen | **`GET /users/:id`** exposait e-mail/rôle de tout utilisateur à tout compte authentifié. Restreint au titulaire ou au staff (`user:manage`). | edit | client → 403 (autre), 200 (self) ; staff → 200 |
| **M6** | Bas | **Codes de secours 2FA 40-bit** non salés. Portés à **64-bit** (16 hex, format lisible). | edit | typecheck ; format vérifié |
| **M7** | Bas | **Zip-bomb à l'import SCORM** : décompression non bornée. Caps (nb d'entrées, taille/entrée, total décompressé) avant extraction. | edit | caps en place |
| **M8** | Moyen | **XSS stocké via média servi inline** (SVG/HTML). Servi en `Content-Disposition: attachment` + `application/octet-stream`. | edit | SVG → attachment + octet-stream |
| **M9** | Moyen | **Adoption SCIM inter-tenant** : `createUser` upsert par e-mail pouvait rattacher/renommer un compte staff ou d'un autre tenant. Refus (409) sauf apprenant sans mot de passe et non rattaché ailleurs ; plus de renommage global. | edit | e-mail staff/local → 409 ; nouveau → créé |
| **M10** | Bas | **Registre d'appareils sans ownership** : suppression par token seul. Scopée au propriétaire. | edit | suppression par un tiers → removed:0 |
| **M11** | Moyen | **SAML** : `audience:false` (rejeu inter-SP) + pas d'`InResponseTo` (rejeu d'assertion). Audience = entityID SP + `validateInResponseTo: ifPresent`. | edit | typecheck (SAML désactivé sans certs) |

## Notes

- **Fail-closed AV** : le compose passe désormais `AV_FAIL_CLOSED=${AV_FAIL_CLOSED:-true}`. Sur le VPS, clamd est `healthy` ; en cas d'indisponibilité de clamd, les uploads (action d'auteur, `media:manage`) seront bloqués. Mettre `AV_FAIL_CLOSED=false` dans `deploy/.env` pour privilégier la disponibilité.
- **SAML `validateInResponseTo: ifPresent`** : cache d'IDs de requêtes en mémoire (mono-instance). Le flux IdP-initié (sans `InResponseTo`) reste accepté.
- **Migration** : `20260702182020_lot2_otp_attempts` ajoute `VerificationCode.attempts`. Appliquée automatiquement au boot de l'API (`prisma migrate deploy`).

## Reste (non traité, à arbitrer)

- Verrouillage 2FA par compte (au-delà du rate-limit IP) + jeton de défi 2FA à usage unique.
- Sniffing MIME serveur à l'upload média (au-delà de la neutralisation au service).
- Chiffrement au niveau champ des PII non-indexées (téléphone).
