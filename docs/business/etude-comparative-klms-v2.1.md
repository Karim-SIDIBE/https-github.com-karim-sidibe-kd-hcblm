# Étude comparative — Plateforme K‑LMS face aux LMS de référence

**DECLICK DIGITAL** — Forces, faiblesses et plans d'action pour l'alignement marché  
_Version 2.1 — 7 juillet 2026 · mise à jour après les vagues A (durcissement ops) et B (observabilité), l'antivirus réel en production et la préparation montée en charge_  
_Document confidentiel — comité de direction · investisseurs · appels d'offres_


## Synthèse exécutive

La plateforme K‑LMS de DECLICK DIGITAL est une plateforme verticale, opinionée et offline‑first de micro‑apprentissage par compétences, taillée pour les environnements à faible connectivité (3G/2G, Afrique), avec une pédagogie fondée sur la science intégrée par défaut.

Cette version 2.1 actualise la v2.0 (2 juillet 2026) après l'exécution des deux premières vagues de son plan d'action, toutes deux livrées et déployées en production. Vague A — exploitation durcie : conteneur API non‑root à capacités réduites, Content‑Security‑Policy et en‑têtes de sécurité sur les trois fronts, antivirus ClamAV réel activé en production (éprouvé sur un incident réel : médias volumineux scannés jusqu'à 512 Mo). Vague B — crédibilité entreprise : métriques Prometheus, sonde de disponibilité, tests de charge k6, procédure de restauration de sauvegarde testée, et un overlay de supervision complet (Prometheus/Grafana/Loki/Alertmanager) prêt à activer. S'y ajoute la préparation de la montée en charge : analyse de capacité chiffrée (~2 500 utilisateurs actifs simultanés en usage interactif, ~10 000 en usage offline‑first) et code prêt pour le multi‑processus + état partagé Redis, activables par simple configuration.

Conclusion inchangée sur le fond : sur son créneau (hors‑ligne, basse bande passante, pédagogie prouvée, analytics prédictif, crédentialisation vérifiable, conformité, coût), K‑LMS égale ou surpasse les leaders. Trois des écarts opérationnels identifiés en v2.0 (conteneur, CSP, observabilité) sont désormais fermés ; les priorités restantes sont go‑to‑market (app stores, accessibilité) puis produit (authoring, multilingue).


## 1. Positionnement

Quatre partis pris fondateurs, inchangés :

- Offline‑first : l'apprentissage fonctionne sans connexion stable, avec synchronisation automatique.
- Pédagogie embarquée : ancrage espacé, micro‑sessions, récupération active, moment d'ancrage — garantis par le modèle.
- Frugalité : conçu pour la basse bande passante (échelle vidéo 240p‑éco/audio) et un hébergement léger.
- Standards & conformité : SCORM/cmi5/xAPI/LTI 1.3, Open Badges 3.0, RGPD, SSO entreprise dès le socle.

## 2. Méthodologie & périmètre

La colonne « Nous » est vérifiée directement sur le code source de production. Les capacités ajoutées en juillet 2026 ont été testées de bout en bout (typecheck multi‑workspaces, 156 tests unitaires, essais HTTP + base de données réelle, vérifications sur le serveur de production) et déployées. Les colonnes concurrentes reposent sur une connaissance du marché arrêtée mi‑2026 ; les capacités réelles varient selon l'édition et le plan tarifaire.

_Légende : ✅✅ fort et différenciant · ✅ solide / natif · 🟡 partiel ou via extension · ❌ absent · 🆕 renforcé depuis la v2.0._


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
| Sécurité applicative (2FA, chiffrement, antivirus, audit) | ✅✅ | 🟡 | ✅ | ✅ | 🟡 |
| Isolation multi‑tenant vérifiée (anti‑fuite PII) | ✅ | 🟡 | ✅ | ✅ | ✅ |
| Anti‑rejeu SSO / SAML durci | ✅ | 🟡 | ✅ | ✅ | 🟡 |
| RGPD self‑service (export, effacement) | ✅ | 🟡 | 🟡 | 🟡 | 🟡 |
| SSO entreprise (SAML/OIDC/SCIM) | ✅ | 🟡 | ✅ | ✅ | ✅ |
| Antivirus réel sur les uploads (ClamAV, fail‑closed) | ✅ 🆕 | 🟡 | ✅ | ✅ | 🟡 |
| Durcissement conteneur (non‑root, capacités réduites) | ✅ 🆕 | 🟡 | ✅ | ✅ | ✅ |
| CSP stricte + en‑têtes de sécurité front | ✅ 🆕 | 🟡 | ✅ | ✅ | ✅ |
| Supervision / alerting / observabilité | ✅ 🆕 | 🟡 | ✅ | ✅ | ✅ |
| Scalabilité horizontale préparée (workers + Redis) | ✅ 🆕 | ✅ | ✅ | ✅ | ✅ |
| WAF / protection DoS au bord | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| Accessibilité WCAG 2.1 AA | 🟡 | ✅ | ✅ | ✅ | 🟡 |
| Authoring libre / catalogage hétérogène | 🟡 | ✅✅ | ✅ | ✅ | ✅ |
| Proctoring / anti‑triche / plagiat | 🟡 | 🟡 | ✅ | 🟡 | ❌ |
| Écosystème de plugins / marketplace | ❌ | ✅✅ | ✅ | 🟡 | 🟡 |
| Publication sur les app stores | 🟡 | ✅ | ✅ | ✅ | ✅ |
| TCO / auto‑hébergement léger (2 vCPU) | ✅✅ | ✅ | 🟡 | ❌ | ❌ |
| Maturité / échelle éprouvée / communauté | 🟡 🆕 | ✅✅ | ✅ | ✅ | ✅ |

_Évolution v2.0 → v2.1 : quatre lignes passent de 🟡 à ✅ (durcissement conteneur, CSP front — déployée en mode Report‑Only, bascule en mode bloquant planifiée après la fenêtre d'observation —, observabilité, antivirus réel en production) ; une ligne nouvelle matérialise la scalabilité horizontale préparée ; et « maturité / échelle » passe de ❌ à 🟡 (tests de charge livrés, capacité chiffrée, restauration testée — restent les pilotes clients et références)._


## 4. Forces distinctives

| Force | Pourquoi c'est différenciant |
|---|---|
| Offline‑first & basse bande passante | Quasi unique. PWA + échelle 240p‑éco/audio conçue pour le terrain africain, là où la plupart des LMS sont online‑only. |
| Pédagogie embarquée par défaut | Moodle/Canvas sont des coquilles agnostiques ; ici l'ancrage espacé, le micro‑learning et la remédiation adaptative sont garantis par le modèle. |
| Sécurité auditée et durcie | Deux lots de remédiation livrés (élévation de privilège SSO, isolation tenant, chiffrement obligatoire, anti‑rejeu SAML, anti‑bruteforce OTP, révocation de sessions), complétés en v2.1 par un antivirus ClamAV réel fail‑closed en production, un conteneur non‑root à capacités réduites et une CSP sur les trois fronts. |
| Exploitation mesurable (🆕) | Métriques Prometheus, sonde de disponibilité, tests de charge k6, restauration de sauvegarde testée, overlay Grafana/Loki/Alertmanager prêt : les SLA se prouvent au lieu de se promettre. |
| Montée en charge préparée (🆕) | Capacité chiffrée (~2 500 actifs simultanés interactifs, ~10 000 offline‑first sur le VPS actuel) et passage multi‑workers + Redis activable par configuration — l'échelle ×2 à ×8 est planifiée, pas improvisée. |
| Crédentialisation à l'état de l'art | Open Badges 3.0 Verifiable Credentials (signés ES256, vérifiables via JWKS) — très peu d'acteurs l'ont — plus SCORM/cmi5/xAPI/LTI 1.3. |
| Analytics prédictif premium | Risque d'abandon, profil de compétences, remédiation cross‑device — des fonctions classe Docebo dans un produit léger et auto‑hébergeable. |
| Conformité RGPD by‑design | Export self‑service, effacement programmé avec restauration, registre de consentement, journal d'audit. |
| TCO imbattable | Tourne sur un VPS 2 vCPU / 4 Go, Docker, sans licence. Docebo/360Learning = SaaS coûteux ; Canvas/Moodle hébergés = infrastructure lourde. |


## 5. Faiblesses résiduelles & plans d'action

Les écarts opérationnels de la v2.0 « durcissement conteneur », « CSP front » et « observabilité » sont livrés et déployés (voir §6) et sortent donc de cette liste. Ci‑dessous, chaque écart encore ouvert est assorti d'un plan d'action concret, d'un effort indicatif (jours‑homme) et d'une priorité. Effort = développement + vérification ; hors décisions produit.


**▸ Publication sur les app stores**

- **Impact :** Absence de l'App Store / Play Store — frein d'adoption grand public.
- **Plan d'action :** Tâche essentiellement côté client (runbook fourni) : comptes Apple Developer (~99 $/an) + Google Play (~25 $), build signé Capacitor, projet Firebase (FCM) + clé APNs, pointer PUSH_WEBHOOK_URL sur la passerelle. Le code natif et le push sont déjà livrés.
- **Effort :** 3–5 j + comptes · **Priorité :** Haute (go‑to‑market)


**▸ Accessibilité WCAG 2.1 AA**

- **Impact :** Couverture a11y partielle ; obligation fréquente en secteur public et grands appels d'offres.
- **Plan d'action :** Audit WCAG 2.1 AA (axe‑core + revue manuelle lecteur d'écran), puis correctifs : contrastes, ordre de focus, libellés ARIA, navigation clavier complète, sous‑titres/transcriptions vidéo. Intégrer un test a11y en CI.
- **Effort :** 10–20 j/h · **Priorité :** Haute (prochaine vague)


**▸ Authoring rigide (modèle 5 blocs)**

- **Impact :** Empêche de cataloguer librement des cours hétérogènes ; frein sur les appels d'offres « LMS généraliste ».
- **Plan d'action :** Introduire des gabarits de cours additionnels préservant les invariants pédagogiques (ancrage, gating, badges) : type « cours libre » à blocs optionnels + éditeur de blocs réordonnables, sans casser la compatibilité du modèle de contenu. Étapes : (1) étendre le schéma Zod avec des blocs optionnels typés ; (2) adapter la validation de publication ; (3) UI d'authoring par gabarit ; (4) migration nulle (rétrocompatibilité garantie).
- **Effort :** 20–35 j/h · **Priorité :** Haute


**▸ Maturité & échelle : preuve terrain restante**

- **Impact :** Produit jeune ; crédibilité « grande échelle » à démontrer pour les grands comptes.
- **Plan d'action :** Le socle de preuve est livré : harnais de tests de charge k6, analyse de capacité chiffrée avec paliers ×2 à ×128, restauration de sauvegarde testée, multi‑workers + Redis prêts. Reste le volet commercial : (1) campagne de charge sur l'environnement de production (chiffre mesuré vs estimé) ; (2) déploiement de référence documenté + SLA ; (3) pilotes clients instrumentés.
- **Effort :** 5–10 j/h + pilotes · **Priorité :** Haute


**▸ Couverture multilingue (largeur + RTL)**

- **Impact :** FR/EN livrés ; marché cible (Afrique) demande souvent AR, PT, SW, et le support RTL.
- **Plan d'action :** Ajouter des dictionnaires (portugais, arabe, swahili…), activer la bidirectionnalité (RTL) pour l'arabe, et compléter l'extraction i18n des surfaces admin/entreprise. Cadre maison déjà en place — pas de refonte.
- **Effort :** 8–15 j/h par groupe de langues · **Priorité :** Moyenne


**▸ Sécurité opérationnelle avancée (chiffrement PII, secrets, DB, WAF)**

- **Impact :** Reste du référentiel de sécurité « dernière génération » (au‑delà de l'applicatif déjà durci).
- **Plan d'action :** (1) Chiffrement au niveau champ des PII non‑indexées (téléphone) ; (2) secret manager + rotation ; (3) rôle Postgres applicatif à moindre privilège ; (4) WAF/CDN au bord (Cloudflare) ; (5) verrouillage 2FA par compte + défi 2FA à usage unique. La restauration de sauvegarde testée, prévue ici en v2.0, est livrée (script de drill automatisé).
- **Effort :** 7–13 j/h · **Priorité :** Moyenne


**▸ Proctoring complet absent**

- **Impact :** Limite pour examens à très fort enjeu (certifications surveillées).
- **Plan d'action :** Deux options, selon la demande client : (A) intégration d'un proctoring tiers via LTI 1.3 (Proctorio/Respondus) — rapide, sans réinventer ; (B) proctoring léger natif (mode plein écran verrouillé, détection de perte de focus, capture périodique). Randomisation par apprenant + filigrane vidéo nominatif déjà en place (dissuasion).
- **Effort :** 10–20 j/h (intégration) · **Priorité :** Basse (selon marché)


**▸ Écosystème de plugins / marketplace**

- **Impact :** Moodle = 2000+ extensions ; frein pour les acheteurs qui valorisent l'extensibilité tierce.
- **Plan d'action :** Choix assumé de rester intégré, mais ouvrir l'extensibilité ciblée : API publique documentée (OpenAPI déjà présent), webhooks sortants (déjà livrés), et connecteurs LTI. Positionner « intégrations » plutôt que « marketplace ».
- **Effort :** 15–25 j/h (durcissement API publique) · **Priorité :** Basse


## 6. Livré depuis la v1.1 — sécurité, exploitation, montée en charge

Quatre livraisons ont été conçues à partir de revues de code dédiées, vérifiées de bout en bout et déployées en production entre le 29 juin et le 7 juillet 2026 :

| Lot / vague | Contenu | Portée |
|---|---|---|
| Lot 1 (sécurité) | Élévation de privilège SSO fédéré (LTI/OIDC/SAML) ; fuite de PII inter‑tenant (analytics/rapports/LRS) ; antivirus câblé sur l'upload ; révocation de sessions au reset mot de passe / 2FA ; bypass d'authentification `x-user-id` fermé. | 2 Critiques + 4 Hautes |
| Lot 2 (sécurité) | trustProxy (IP client réelle) ; antivirus fail‑closed par défaut ; `FIELD_ENCRYPTION_KEY` requis en production ; anti‑bruteforce OTP ; `GET /users/:id` restreint ; adoption SCIM inter‑tenant bloquée ; ownership du registre d'appareils ; SAML `audience` + anti‑rejeu `InResponseTo` ; XSS stocké média neutralisé ; garde anti zip‑bomb SCORM ; correction d'un bug de parsing booléen qui rendait certaines protections indésactivables. | 11 Moyennes/Basses |
| Vague A (ops) 🆕 | Conteneur API non‑root (abandon de privilèges au démarrage, toutes capacités Linux retirées sauf le strict nécessaire, no‑new‑privileges) ; Content‑Security‑Policy et en‑têtes de sécurité (HSTS, frame‑ancestors, Referrer‑Policy, Permissions‑Policy) sur les trois fronts via Caddy ; antivirus ClamAV réel activé en production, éprouvé sur incident réel : limites de scan portées à 512 Mo et délai adapté aux gros médias — vidéo de 238 Mo scannée et publiée. | Déployé |
| Vague B (observabilité) 🆕 | Endpoint `/metrics` Prometheus sans dépendance (latences, trafic, erreurs, saturation) protégé par jeton ; sonde `/health/ready` (DB critique, antivirus informatif) ; tests de charge k6 scénarisés (apprenant offline‑first) ; procédure de restauration de sauvegarde automatisée et testée ; runbook d'exploitation ; overlay complet Prometheus/Grafana/Loki/Alertmanager prêt à activer (recommandé avec 8 Go de RAM). | Déployé (overlay en option) |
| Montée en charge 🆕 | Analyse de capacité chiffrée (~2 500 actifs simultanés interactifs, ~10 000 offline‑first ; paliers ×2 à ×128 documentés) ; multi‑processus (cluster Node) et état partagé Redis (rate‑limit global, anti‑rejeu SAML) prêts dans le code, activables par configuration sans changement par défaut. | Livré (opt‑in) |

Effet concret notable : le déploiement du Lot 2 a révélé et corrigé le fait que la production chiffrait « au repos » sans clé — les secrets 2FA étaient donc stockés en clair. Et l'activation de l'antivirus réel a été validée sur un incident de production réel (média volumineux d'abord bloqué, limites ajustées, publication vérifiée) — la chaîne fail‑closed fonctionne comme conçu.


## 7. Feuille de route consolidée (état au 7 juillet 2026)

Séquencement recommandé, du plus rentable/rapide au plus structurant :

| Vague | Contenu | Effort | Statut / priorité |
|---|---|---|---|
| A — Quick wins sécurité/ops | Durcissement conteneur · CSP front | 4–10 j/h | ✅ Livrée (CSP en observation, bascule bloquante planifiée) |
| B — Crédibilité entreprise | Observabilité/alerting · tests de charge · restauration testée | 15–30 j/h | ✅ Livrée (overlay supervision prêt, activation selon RAM) |
| C — Go‑to‑market | Publication app stores (client) · accessibilité WCAG 2.1 AA | 13–25 j/h | Prochaine — Haute |
| D — Élargissement produit | Authoring assoupli (gabarits) · multilingue AR/PT/SW + RTL | 28–50 j/h | Moyenne |
| E — Selon demande | Proctoring (intégration LTI) · API publique/intégrations · sécurité op. avancée (dont WAF/CDN) | 30–55 j/h | Basse‑Moyenne |


## 8. Verdict stratégique

Sur le terrain d'un LMS généraliste, les leaders conservent l'avantage sur la flexibilité d'authoring, l'écosystème de plugins et la maturité éprouvée. Ces écarts restent chiffrés et planifiés (vagues D et E), et l'écart « maturité » se réduit : la charge se mesure, la capacité est chiffrée, la restauration est testée.

Sur son créneau — micro‑apprentissage par compétences, offline‑first, basse bande passante, pédagogie prouvée, analytics prédictif, crédentialisation vérifiable, conformité et coût — la plateforme égale ou surpasse les meilleurs, désormais adossée à une sécurité auditée et durcie et à une exploitation mesurable. Les priorités opérationnelles de la v2.0 sont exécutées ; la priorité bascule sur le go‑to‑market : publication sur les app stores et accessibilité WCAG 2.1 AA (vague C).

Ce n'est pas « un Moodle de plus » : c'est une catégorie taillée pour un marché que les leaders servent mal, et dont les rares faiblesses résiduelles sont aujourd'hui identifiées, costées et séquencées.


## 9. Annexe — capacités techniques vérifiées (juillet 2026)

| Domaine | Capacités confirmées sur le code |
|---|---|
| Sécurité applicative | JWT ES256, OIDC/SAML/SCIM, 2FA TOTP + codes de secours 64 bits, anti‑bruteforce login + OTP, isolation tenant du reporting, garde d'élévation de privilège SSO, anti‑rejeu SAML (audience + InResponseTo, cache partageable Redis), révocation de sessions, journal d'audit, chiffrement au repos (obligatoire en prod), antivirus ClamAV réel fail‑closed (scan jusqu'à 512 Mo), SSRF guard sur webhooks, neutralisation XSS média, garde zip‑bomb SCORM. |
| Exploitation & échelle 🆕 | Conteneur non‑root à capacités réduites ; CSP + en‑têtes de sécurité sur les trois fronts ; métriques Prometheus `/metrics` (jeton) ; sonde `/health/ready` ; tests de charge k6 ; restauration de sauvegarde automatisée testée ; overlay Prometheus/Grafana/Loki/Alertmanager prêt ; multi‑workers (cluster Node) + Redis partagé opt‑in ; analyse de capacité ×1→×128. |
| Évaluations | 5 types de questions (correction insensible casse/accents) ; banque réutilisable taguée ; pool aléatoire matérialisé par apprenant (stable, offline). |
| Reporting | CSV, Excel multi‑onglets serveur (Synthèse/Entonnoir/Apprenants/À risque/Compétences), rapports programmés par e‑mail, vues & colonnes configurables. |
| Interopérabilité | Import/exécution SCORM 1.2/2004 et cmi5 ; xAPI entrant/sortant (LRS) ; LTI 1.3 (Tool). |
| Crédentialisation | Open Badges 2.0 + 3.0 (VC‑JWT signés, vérifiables) ; certificats PDF. |
| Analytics | Score de risque d'abandon, cartographie de compétences, remédiation adaptative, réengagement J3/J7/J14. |
| Mobile & distribution | Pont natif Capacitor, push (registre d'appareils + passerelle FCM/APNs), PWA offline‑first, marque blanche multi‑tenant, notifications e‑mail/SMS/WhatsApp/push, sessions live Zoom/Teams. |
| Conformité | RGPD (export, effacement programmé avec restauration), registre de consentement. |


---
_DECLICK DIGITAL — Document confidentiel — © 2026. Capacités « Nous » vérifiées sur le code de production._