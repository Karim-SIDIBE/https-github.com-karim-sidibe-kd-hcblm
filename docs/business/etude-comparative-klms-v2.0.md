# Étude comparative — Plateforme K‑LMS face aux LMS de référence

**DECLICK DIGITAL** — Forces, faiblesses et plans d'action pour l'alignement marché  
_Version 2.0 — 2 juillet 2026 · mise à jour après durcissement sécurité (Lots 1 & 2)_  
_Document confidentiel — comité de direction · investisseurs · appels d'offres_


## Synthèse exécutive

La plateforme K‑LMS de DECLICK DIGITAL est une plateforme verticale, opinionée et offline‑first de micro‑apprentissage par compétences, taillée pour les environnements à faible connectivité (3G/2G, Afrique), avec une pédagogie fondée sur la science intégrée par défaut.

Cette version 2.0 de l'étude actualise la précédente (v1.1, 29 juin 2026) sur deux plans. D'abord, le socle de sécurité — déjà présent — a été audité puis durci de bout en bout via deux lots livrés et déployés en production : correction d'une élévation de privilège SSO, isolation multi‑tenant du reporting, antivirus ClamAV réellement câblé, chiffrement au repos rendu obligatoire, protection anti‑rejeu SAML, révocation de sessions et anti‑bruteforce OTP. Ensuite — et c'est l'objet central de cette version — chaque écart fonctionnel encore ouvert reçoit désormais un plan d'action chiffré, séquencé et priorisé pour combler l'écart résiduel avec les meilleurs LMS généralistes.

Conclusion inchangée sur le fond : sur son créneau (hors‑ligne, basse bande passante, pédagogie prouvée, analytics prédictif, crédentialisation vérifiable, conformité, coût), K‑LMS égale ou surpasse les leaders. Les écarts restants ne sont plus des inconnues : ils sont identifiés, chiffrés et planifiés.


## 1. Positionnement

Quatre partis pris fondateurs, inchangés :

- Offline‑first : l'apprentissage fonctionne sans connexion stable, avec synchronisation automatique.
- Pédagogie embarquée : ancrage espacé, micro‑sessions, récupération active, moment d'ancrage — garantis par le modèle.
- Frugalité : conçu pour la basse bande passante (échelle vidéo 240p‑éco/audio) et un hébergement léger.
- Standards & conformité : SCORM/cmi5/xAPI/LTI 1.3, Open Badges 3.0, RGPD, SSO entreprise dès le socle.

## 2. Méthodologie & périmètre

La colonne « Nous » est vérifiée directement sur le code source de production. Les capacités de sécurité ajoutées en juillet 2026 ont été testées de bout en bout (typecheck multi‑workspaces, 154 tests unitaires, essais HTTP + base de données réelle) et déployées. Les colonnes concurrentes reposent sur une connaissance du marché arrêtée mi‑2026 ; les capacités réelles varient selon l'édition et le plan tarifaire.

_Légende : ✅✅ fort et différenciant · ✅ solide / natif · 🟡 partiel ou via extension · ❌ absent · 🆕 renforcé depuis la v1.1._


## 3. Matrice de capacités

| Critère | Nous | Moodle | Canvas | Docebo | 360L |
|---|---|---|---|---|---|
| Offline‑first / très basse bande passante | ✅✅ | 🟡 | ❌ | ❌ | ❌ |
| Vidéo adaptative multi‑débit + audio seul | ✅ | 🟡 | 🟡 | ✅ | 🟡 |
| Pédagogie fondée sur la science intégrée | ✅✅ | ❌ | ❌ | 🟡 | 🟡 |
| Types de questions variés + banque + randomisation | ✅ | ✅✅ | ✅ | ✅ | 🟡 |
| Reporting configurable (CSV/Excel/programmé/vues) | ✅ | 🟡 | 🟡 | ✅ | 🟡 |
| Multilingue UI (FR/EN, extensible) | ✅ | ✅✅ | ✅ | ✅ | ✅ |
| App mobile native (code) + push | ✅ | ✅ | ✅ | ✅ | ✅ |
| Interop SCORM 1.2/2004, cmi5, xAPI, LTI 1.3 | ✅ | ✅ | ✅ | ✅ | 🟡 |
| Open Badges 3.0 (VC) + certificats PDF | ✅✅ | 🟡 | 🟡 | 🟡 | ❌ |
| Analytics prédictif (risque, remédiation) | ✅ | ❌ | 🟡 | ✅ | 🟡 |
| IA (feedback, génération, recherche sém.) | ✅ | 🟡 | 🟡 | ✅ | ✅ |
| Sécurité applicative (2FA, chiffrement, antivirus, audit) | ✅✅ 🆕 | 🟡 | ✅ | ✅ | 🟡 |
| Isolation multi‑tenant vérifiée (anti‑fuite PII) | ✅ 🆕 | 🟡 | ✅ | ✅ | ✅ |
| Anti‑rejeu SSO / SAML durci | ✅ 🆕 | 🟡 | ✅ | ✅ | 🟡 |
| RGPD self‑service (export, effacement) | ✅ | 🟡 | 🟡 | 🟡 | 🟡 |
| SSO entreprise (SAML/OIDC/SCIM) | ✅ | 🟡 | ✅ | ✅ | ✅ |
| Durcissement conteneur / rootless / rootfs RO | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| CSP stricte + en‑têtes de sécurité front | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| Supervision / alerting / observabilité | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| WAF / protection DoS au bord | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| Accessibilité WCAG 2.1 AA | 🟡 | ✅ | ✅ | ✅ | 🟡 |
| Authoring libre / catalogage hétérogène | 🟡 | ✅✅ | ✅ | ✅ | ✅ |
| Proctoring / anti‑triche / plagiat | 🟡 | 🟡 | ✅ | 🟡 | ❌ |
| Écosystème de plugins / marketplace | ❌ | ✅✅ | ✅ | 🟡 | 🟡 |
| Publication sur les app stores | 🟡 | ✅ | ✅ | ✅ | ✅ |
| TCO / auto‑hébergement léger (2 vCPU) | ✅✅ | ✅ | 🟡 | ❌ | ❌ |
| Maturité / échelle éprouvée / communauté | ❌ | ✅✅ | ✅ | ✅ | ✅ |

_Évolution v1.1 → v2.0 : la sécurité applicative passe de ✅ à ✅✅ (audit + remédiation en deux lots), et trois lignes nouvelles matérialisent honnêtement le périmètre de sécurité opérationnelle encore partiel (conteneur, CSP front, observabilité, WAF, accessibilité) — objet des plans d'action ci‑dessous._


## 4. Forces distinctives

| Force | Pourquoi c'est différenciant |
|---|---|
| Offline‑first & basse bande passante | Quasi unique. PWA + échelle 240p‑éco/audio conçue pour le terrain africain, là où la plupart des LMS sont online‑only. |
| Pédagogie embarquée par défaut | Moodle/Canvas sont des coquilles agnostiques ; ici l'ancrage espacé, le micro‑learning et la remédiation adaptative sont garantis par le modèle. |
| Sécurité auditée et durcie (🆕) | Deux lots de remédiation livrés : garde d'élévation de privilège SSO, isolation tenant du reporting, ClamAV réel, chiffrement au repos obligatoire, anti‑rejeu SAML, anti‑bruteforce OTP, révocation de sessions — le tout vérifié et déployé. |
| Crédentialisation à l'état de l'art | Open Badges 3.0 Verifiable Credentials (signés ES256, vérifiables via JWKS) — très peu d'acteurs l'ont — plus SCORM/cmi5/xAPI/LTI 1.3. |
| Analytics prédictif premium | Risque d'abandon, profil de compétences, remédiation cross‑device — des fonctions classe Docebo dans un produit léger et auto‑hébergeable. |
| Conformité RGPD by‑design | Export self‑service, effacement programmé avec restauration, registre de consentement, journal d'audit. |
| TCO imbattable | Tourne sur un VPS 2 vCPU / 4 Go, Docker, sans licence. Docebo/360Learning = SaaS coûteux ; Canvas/Moodle hébergés = infrastructure lourde. |


## 5. Faiblesses résiduelles & plans d'action

Les écarts « évaluations limitées », « reporting peu configurable », « i18n FR‑first » et « pont mobile natif » de la v1.0 restent résolus (P1–P4). Ci‑dessous, chaque écart encore ouvert est assorti d'un plan d'action concret, d'un effort indicatif (jours‑homme) et d'une priorité. Effort = développement + vérification ; hors décisions produit.


**▸ Authoring rigide (modèle 5 blocs)**

- **Impact :** Empêche de cataloguer librement des cours hétérogènes ; frein sur les appels d'offres « LMS généraliste ».
- **Plan d'action :** Introduire des gabarits de cours additionnels préservant les invariants pédagogiques (ancrage, gating, badges) : type « cours libre » à blocs optionnels + éditeur de blocs réordonnables, sans casser la compatibilité du modèle de contenu. Étapes : (1) étendre le schéma Zod avec des blocs optionnels typés ; (2) adapter la validation de publication ; (3) UI d'authoring par gabarit ; (4) migration nulle (rétrocompatibilité garantie).
- **Effort :** 20–35 j/h · **Priorité :** Haute


**▸ Durcissement conteneur (non‑root, rootfs RO, caps)**

- **Impact :** L'API tourne en root dans le conteneur ; surface d'attaque et conformité en retrait des LMS matures.
- **Plan d'action :** Ajouter un utilisateur non‑root au Dockerfile, activer `read_only: true` + `tmpfs` pour les écritures, `cap_drop: ALL`, `no-new-privileges`, et un volume dédié inscriptible pour les médias. Vérifier le boot + uploads.
- **Effort :** 2–4 j/h · **Priorité :** Haute


**▸ CSP stricte + en‑têtes de sécurité front (Caddy)**

- **Impact :** Les fronts (PWA/admin/entreprise) n'émettent pas de Content‑Security‑Policy ; risque XSS/clickjacking résiduel.
- **Plan d'action :** Définir dans le Caddyfile une CSP stricte par front (sources autolistées, nonce pour les scripts), plus Strict‑Transport‑Security, X‑Frame‑Options/frame‑ancestors, Referrer‑Policy, Permissions‑Policy. Tester la non‑régression PWA (service worker, médias).
- **Effort :** 1–2 j/h · **Priorité :** Haute


**▸ Supervision / alerting / observabilité**

- **Impact :** Pas de métriques ni d'alertes centralisées ; détection d'incident et SLA difficiles à tenir.
- **Plan d'action :** Brancher : (1) logs structurés expédiés (Loki/ELK ou service géré) ; (2) endpoint `/metrics` Prometheus + tableau de bord ; (3) alerting sur erreurs 5xx, échecs d'auth, indisponibilité clamd/db ; (4) traçage des erreurs (Sentry‑like). Le journal d'audit applicatif existe déjà et sert de base.
- **Effort :** 5–10 j/h · **Priorité :** Haute


**▸ Publication sur les app stores**

- **Impact :** Absence de l'App Store / Play Store — frein d'adoption grand public.
- **Plan d'action :** Tâche essentiellement côté client (runbook fourni) : comptes Apple Developer (~99 $/an) + Google Play (~25 $), build signé Capacitor, projet Firebase (FCM) + clé APNs, pointer PUSH_WEBHOOK_URL sur la passerelle. Le code natif et le push sont déjà livrés.
- **Effort :** 3–5 j + comptes · **Priorité :** Haute (go‑to‑market)


**▸ Maturité & échelle non éprouvées**

- **Impact :** Produit jeune ; crédibilité « grande échelle » à démontrer pour les grands comptes.
- **Plan d'action :** Programme de preuve : (1) tests de charge k6 (300→3000 apprenants, scénarios offline/sync) ; (2) déploiement de référence documenté + SLA ; (3) pilotes clients instrumentés ; (4) plan de scalabilité horizontale (réplicas API, pool DB). Combiné à l'observabilité ci‑dessus.
- **Effort :** 10–20 j/h · **Priorité :** Haute


**▸ Accessibilité WCAG 2.1 AA**

- **Impact :** Couverture a11y partielle ; obligation fréquente en secteur public et grands appels d'offres.
- **Plan d'action :** Audit WCAG 2.1 AA (axe‑core + revue manuelle lecteur d'écran), puis correctifs : contrastes, ordre de focus, libellés ARIA, navigation clavier complète, sous‑titres/transcriptions vidéo. Intégrer un test a11y en CI.
- **Effort :** 10–20 j/h · **Priorité :** Moyenne‑Haute


**▸ Couverture multilingue (largeur + RTL)**

- **Impact :** FR/EN livrés ; marché cible (Afrique) demande souvent AR, PT, SW, et le support RTL.
- **Plan d'action :** Ajouter des dictionnaires (portugais, arabe, swahili…), activer la bidirectionnalité (RTL) pour l'arabe, et compléter l'extraction i18n des surfaces admin/entreprise. Cadre maison déjà en place — pas de refonte.
- **Effort :** 8–15 j/h par groupe de langues · **Priorité :** Moyenne


**▸ Sécurité opérationnelle avancée (chiffrement PII, secrets, DB, WAF)**

- **Impact :** Reste du référentiel de sécurité « dernière génération » (au‑delà de l'applicatif déjà durci).
- **Plan d'action :** (1) Chiffrement au niveau champ des PII non‑indexées (téléphone) ; (2) secret manager + rotation ; (3) rôle Postgres applicatif à moindre privilège ; (4) restauration de sauvegarde testée régulièrement ; (5) WAF/CDN au bord (Cloudflare) ; (6) verrouillage 2FA par compte + défi 2FA à usage unique.
- **Effort :** 8–15 j/h · **Priorité :** Moyenne


**▸ Proctoring complet absent**

- **Impact :** Limite pour examens à très fort enjeu (certifications surveillées).
- **Plan d'action :** Deux options, selon la demande client : (A) intégration d'un proctoring tiers via LTI 1.3 (Proctorio/Respondus) — rapide, sans réinventer ; (B) proctoring léger natif (mode plein écran verrouillé, détection de perte de focus, capture périodique). Randomisation par apprenant + filigrane vidéo nominatif déjà en place (dissuasion).
- **Effort :** 10–20 j/h (intégration) · **Priorité :** Basse (selon marché)


**▸ Écosystème de plugins / marketplace**

- **Impact :** Moodle = 2000+ extensions ; frein pour les acheteurs qui valorisent l'extensibilité tierce.
- **Plan d'action :** Choix assumé de rester intégré, mais ouvrir l'extensibilité ciblée : API publique documentée (OpenAPI déjà présent), webhooks sortants (déjà livrés), et connecteurs LTI. Positionner « intégrations » plutôt que « marketplace ».
- **Effort :** 15–25 j/h (durcissement API publique) · **Priorité :** Basse


## 6. Livré depuis la v1.1 — durcissement sécurité (Lots 1 & 2)

Deux lots de sécurité ont été conçus à partir d'une revue de code dédiée, vérifiés de bout en bout et déployés en production entre le 29 juin et le 2 juillet 2026 :

| Lot | Contenu | Gravité fermée |
|---|---|---|
| Lot 1 | Élévation de privilège SSO fédéré (LTI/OIDC/SAML) ; fuite de PII inter‑tenant (analytics/rapports/LRS) ; antivirus ClamAV réellement câblé sur l'upload ; révocation de sessions au reset mot de passe / 2FA ; bypass d'authentification `x-user-id` fermé. | 2 Critiques + 4 Hautes |
| Lot 2 | trustProxy (IP client réelle) ; antivirus fail‑closed par défaut ; `FIELD_ENCRYPTION_KEY` requis en production ; anti‑bruteforce OTP ; `GET /users/:id` restreint ; adoption SCIM inter‑tenant bloquée ; ownership du registre d'appareils ; SAML `audience` + anti‑rejeu `InResponseTo` ; XSS stocké média neutralisé ; garde anti zip‑bomb SCORM ; correction d'un bug de parsing booléen qui rendait certaines protections indésactivables. | 11 Moyennes/Basses |

Effet concret : le déploiement du Lot 2 a révélé et corrigé le fait que la production chiffrait « au repos » sans clé — les secrets 2FA étaient donc stockés en clair. Le garde‑fou ajouté force désormais la présence de la clé au démarrage.


## 7. Feuille de route consolidée (proposée)

Séquencement recommandé, du plus rentable/rapide au plus structurant :

| Vague | Contenu | Effort | Priorité |
|---|---|---|---|
| A — Quick wins sécurité/ops | Durcissement conteneur · CSP front · (option) WAF/CDN | 4–10 j/h | Haute |
| B — Crédibilité entreprise | Observabilité/alerting · tests de charge + SLA · restauration testée | 15–30 j/h | Haute |
| C — Go‑to‑market | Publication app stores (client) · accessibilité WCAG 2.1 AA | 13–25 j/h | Haute |
| D — Élargissement produit | Authoring assoupli (gabarits) · multilingue AR/PT/SW + RTL | 28–50 j/h | Moyenne |
| E — Selon demande | Proctoring (intégration LTI) · API publique/intégrations · sécurité op. avancée | 33–60 j/h | Basse‑Moyenne |


## 8. Verdict stratégique

Sur le terrain d'un LMS généraliste, les leaders conservent l'avantage sur la flexibilité d'authoring, l'écosystème de plugins et la maturité éprouvée. Ces écarts sont désormais chiffrés et planifiés (vagues D et E).

Sur son créneau — micro‑apprentissage par compétences, offline‑first, basse bande passante, pédagogie prouvée, analytics prédictif, crédentialisation vérifiable, conformité et coût — la plateforme égale ou surpasse les meilleurs, désormais adossée à une sécurité applicative auditée et durcie. Les priorités immédiates les plus rentables sont opérationnelles (durcissement conteneur, CSP, observabilité) et go‑to‑market (app stores, accessibilité), toutes à faible effort relatif.

Ce n'est pas « un Moodle de plus » : c'est une catégorie taillée pour un marché que les leaders servent mal, et dont les rares faiblesses résiduelles sont aujourd'hui identifiées, costées et séquencées.


## 9. Annexe — capacités techniques vérifiées (juillet 2026)

| Domaine | Capacités confirmées sur le code |
|---|---|
| Sécurité applicative | JWT ES256, OIDC/SAML/SCIM, 2FA TOTP + codes de secours 64 bits, anti‑bruteforce login + OTP, isolation tenant du reporting, garde d'élévation de privilège SSO, anti‑rejeu SAML (audience + InResponseTo), révocation de sessions, journal d'audit, chiffrement au repos (obligatoire en prod), antivirus ClamAV (fail‑closed), SSRF guard sur webhooks, neutralisation XSS média, garde zip‑bomb SCORM. |
| Évaluations | 5 types de questions (correction insensible casse/accents) ; banque réutilisable taguée ; pool aléatoire matérialisé par apprenant (stable, offline). |
| Reporting | CSV, Excel multi‑onglets serveur (Synthèse/Entonnoir/Apprenants/À risque/Compétences), rapports programmés par e‑mail, vues & colonnes configurables. |
| Interopérabilité | Import/exécution SCORM 1.2/2004 et cmi5 ; xAPI entrant/sortant (LRS) ; LTI 1.3 (Tool). |
| Crédentialisation | Open Badges 2.0 + 3.0 (VC‑JWT signés, vérifiables) ; certificats PDF. |
| Analytics | Score de risque d'abandon, cartographie de compétences, remédiation adaptative, réengagement J3/J7/J14. |
| Mobile & distribution | Pont natif Capacitor, push (registre d'appareils + passerelle FCM/APNs), PWA offline‑first, marque blanche multi‑tenant, notifications e‑mail/SMS/WhatsApp/push, sessions live Zoom/Teams. |
| Conformité | RGPD (export, effacement programmé avec restauration), registre de consentement. |


---
_DECLICK DIGITAL — Document confidentiel — © 2026. Capacités « Nous » vérifiées sur le code de production._