# Fournisseurs de paiement — PayDunya & InTouch (TouchPay)

Runbook d'activation des deux agrégateurs ajoutés en alternative à CinetPay
(habilitation carte bancaire suspendue — mobile money seul). Le socle est
inchangé : le fournisseur **actif** se choisit dans l'admin (Paiements →
fournisseur actif, réglage `payment_provider`, Super Admin), les clés ne font
que **configurer** ; les webhooks de TOUS les fournisseurs restent acceptés en
permanence (une bascule ne perd jamais une notification tardive) ; et la
doctrine de sécurité reste « **le webhook réveille, la vérification règle** » :
aucune notification ne règle une commande à elle seule, c'est toujours la
contre-vérification serveur→fournisseur qui fait foi.

Pour CinetPay : `docs/ops/premier-paiement-reel.md` (toujours valable).

## Vue d'ensemble

| | PayDunya | InTouch (TouchPay) |
|---|---|---|
| Société | Dunya Digital Payment (groupe Peach Payments) | TouchPoint Financial Services |
| Agrément | EDP BCEAO (SN n° EP.SN.001/2025, CI EP.CI.008/2025) | Établissement agréé SN + CI ; **seul agrégateur présent dans la liste des participants PI-SPI au 31/07/2026** |
| Canaux | Carte bancaire + mobile money | Carte bancaire + mobile money |
| Devise | **XOF uniquement** | **XOF uniquement** |
| Intégration | API REST complète — **opérationnelle dès les clés posées** | Widget officiel via page-pont — **EN VEILLE : à finaliser à l'onboarding partenaire** (URL de statut requise) |
| Vérité (statut) | `GET /checkout-invoice/confirm/{token}` | `INTOUCH_STATUS_URL` (portail partenaire) — sans elle, **rien n'est jamais réglé automatiquement** |

Ni l'un ni l'autre ne couvre le XAF (Cameroun) ni l'EUR : pour ces devises,
prévoir Flutterwave (adaptateur déjà en place, plan B) ou le retour de
CinetPay. Un checkout dans une devise non couverte est refusé proprement
(`unsupported_currency`) — poser des prix XOF dans l'écran Tarifs.

## A. PayDunya — activation

### A.0 Pré-requis compte marchand

- Compte business validé (KYC) sur <https://paydunya.com> ; univers déclaré
  « formation professionnelle en ligne ».
- Récupérer dans le back-office (Intégrations → clés API) les **trois clés
  live** : `MASTER KEY`, `PRIVATE KEY` (live), `TOKEN` (live).
- Frais/reversements par canal à consigner pour la comptabilité ; demander
  l'attestation d'agrément EDP pour le dossier de conformité.

### A.1 URL de notification (IPN)

L'API envoie déjà `callback_url` à chaque facture, mais déclarez-la aussi par
défaut dans le back-office :

```
https://api.declick.digital/api/v1/payments/webhooks/paydunya
```

Endpoint public sans auth : l'IPN PayDunya est authentifié par son champ
`data[hash]` (SHA-512 de la MASTER KEY — preuve d'origine). Il ne fait que
**réveiller** la commande : le règlement passe toujours par la
contre-vérification `confirm/{token}`.

### A.2 Variables d'environnement (VPS)

```bash
grep -n "PAYDUNYA" ~/kd-hcblm/deploy/.env
```

```bash
cat >> ~/kd-hcblm/deploy/.env <<'EOF'
PAYDUNYA_MASTER_KEY=<master key>
PAYDUNYA_PRIVATE_KEY=<private key live>
PAYDUNYA_TOKEN=<token live>
EOF
```

(Pour un essai sandbox : clés de test + `PAYDUNYA_BASE_URL=https://app.paydunya.com/sandbox-api/v1`.)

```bash
cd ~/kd-hcblm && docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --force-recreate api
```

Contrôle : admin → **Paiements** → panneau fournisseurs — `paydunya` doit
passer « configuré ».

### A.3 Bascule et paiement d'essai

1. Admin → Paiements → fournisseur actif → **paydunya**. (Nouveaux checkouts
   seulement ; retour arrière instantané vers `manual`.)
2. Produit d'essai à prix minimal (p. ex. 200 F CFA) dans l'écran Tarifs, puis
   achat réel depuis la PWA ou le tunnel invité : redirection vers la page de
   paiement PayDunya → payer.
3. Contrôles, dans l'ordre : commande **PAID** sans intervention staff ;
   `PaymentEvent` traité ; Entitlement créé + inscription ; reçu PDF ;
   réconciliation vide. Si l'IPN tarde : bouton **Re-vérifier** sur la
   commande (interroge `confirm/{token}`).
4. Après l'essai : désactiver le produit d'essai ; remboursement éventuel via
   le back-office PayDunya.

## B. InTouch (TouchPay) — posture actuelle : EN VEILLE

L'adaptateur est **complet côté code** mais volontairement bridé tant que
l'onboarding partenaire n'a pas fourni l'URL de statut : sans
`INTOUCH_STATUS_URL`, une notification laisse la commande en attente et
**aucun droit n'est jamais accordé automatiquement** (le staff peut toujours
constater à la main). C'est le même statut « plan B prêt » que Flutterwave.

### B.1 Ce que fait l'intégration

- Le checkout renvoie une **page-pont** servie par l'API
  (`/api/v1/payments/intouch/bridge/{paymentId}`) qui charge le widget
  officiel TouchPay (`sendPaymentInfos(...)`) avec le montant et le libellé de
  la commande — même famille que les pages HTML SAML/LTI déjà servies.
- La notification arrive sur
  `/api/v1/payments/webhooks/intouch?s=<secret>&order_number=<paymentId>` —
  le secret d'URL est **le nôtre** (`INTOUCH_NOTIFY_SECRET`), vérifié en temps
  constant ; mauvaise valeur ⇒ rejet 401 journalisé.
- La vérité passe par `INTOUCH_STATUS_URL` (gabarit avec `{orderNumber}`,
  basic auth optionnelle via `INTOUCH_STATUS_AUTH=login:motdepasse`).

### B.2 À l'onboarding partenaire (checklist)

1. Contrat/onboarding TouchPoint (SN/CI) → récupérer `agency_code`,
   `secure_code`, `domain_name` du compte marchand.
2. Générer notre secret de notification : `openssl rand -hex 32`.
3. Dans le portail partenaire (Réglages → API) : récupérer l'**URL de
   consultation de statut** d'une transaction, et déclarer l'URL de
   notification ci-dessus (avec `?s=<secret>` — l'API l'ajoute d'elle-même
   aux transactions qu'elle initie).
4. Poser les variables :

```bash
cat >> ~/kd-hcblm/deploy/.env <<'EOF'
INTOUCH_AGENCY_CODE=<agency code>
INTOUCH_SECURE_CODE=<secure code>
INTOUCH_DOMAIN=<domain name>
INTOUCH_NOTIFY_SECRET=<openssl rand -hex 32>
INTOUCH_STATUS_URL=<URL portail avec {orderNumber}>
EOF
```

```bash
cd ~/kd-hcblm && docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --force-recreate api
```

5. Bascule + paiement d'essai : même déroulé qu'en §A.3 (fournisseur actif →
   **intouch** ; l'écran d'achat redirige vers la page-pont).

## C. Conduite d'incident (commune)

| Symptôme | Lecture | Action |
|---|---|---|
| Commande PENDING après paiement | Notification perdue/tardive | **Re-vérifier** sur la commande (confirm PayDunya / status InTouch) ; contrôler l'URL de notification déclarée |
| Rejets `signature_invalid` en série (PayDunya) | MASTER KEY erronée ou tentative de fraude | Comparer la clé back-office vs `deploy/.env` ; les rejets sont journalisés sans bloquer l'événement légitime suivant |
| Rejets 401 en série (InTouch) | `INTOUCH_NOTIFY_SECRET` désynchronisé ou scan | Vérifier le secret déclaré côté portail vs `.env` |
| `unsupported_currency` au checkout | Prix non-XOF avec PayDunya/InTouch actif | Poser un prix XOF, ou basculer vers un fournisseur couvrant la devise |
| Commande InTouch jamais réglée automatiquement | `INTOUCH_STATUS_URL` absente (posture EN VEILLE) | Normal : finaliser §B.2, ou constat manuel staff après contrôle du back-office |
| Doute généralisé | — | Re-basculer `payment_provider` sur `manual` — l'encaissement par virement continue pendant l'investigation |
