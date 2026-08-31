# Premier paiement réel — runbook d'activation CinetPay

Procédure à dérouler **le jour où le compte marchand CinetPay est ouvert**.
Jusqu'à cette activation, la plateforme encaisse via le fournisseur `manual`
(virement + constat staff) — rien ne presse ni ne casse. La chaîne complète a
été re-vérifiée en E2E consolidé (PAY-5) : cycle manual, sécurité des webhooks
(signature HMAC, idempotence), tunnel invité, réconciliation.

## 0. Pré-requis côté compte marchand (avant toute manipulation technique)

À valider avec CinetPay à l'ouverture du compte :

- **Univers d'encaissement** déclaré (formation professionnelle en ligne) —
  conditionne l'acceptation des transactions.
- **Devises activées** : XOF au minimum ; XAF et EUR si les prix les proposent
  (écran Tarifs). Une devise non activée côté marchand fera échouer
  l'initialisation.
- **Frais et reversements** : taux par canal (Mobile Money, carte), délai de
  reversement, compte de règlement — à consigner pour la comptabilité.
- **Conformité** : agrément/partenariat BCEAO de l'agrégateur et modalités
  PI-SPI (interopérabilité des paiements instantanés) — demander l'attestation,
  la conserver au dossier.
- Récupérer dans le back-office CinetPay : **API KEY**, **SITE ID**,
  **SECRET KEY** (la clé du HMAC des notifications).

## 1. Déclarer l'URL de notification (back-office CinetPay)

L'API envoie déjà `notify_url` à chaque initialisation, mais déclarez-la aussi
comme URL par défaut du back-office :

```
https://api.declick.digital/api/v1/payments/webhooks/cinetpay
```

Endpoint public, sans auth : la sécurité EST la signature `x-token`
(HMAC-SHA256, SECRET KEY) + la contre-vérification `/v2/payment/check` — une
notification seule ne règle jamais une commande.

## 2. Configurer le VPS (variables d'environnement seulement)

Vérifier qu'aucune ligne n'existe déjà (éviter les doublons) :

```bash
grep -n "CINETPAY" ~/kd-hcblm/deploy/.env
```

Ajouter les trois clés (remplacer les valeurs) :

```bash
cat >> ~/kd-hcblm/deploy/.env <<'EOF'
CINETPAY_API_KEY=<api key du back-office>
CINETPAY_SITE_ID=<site id>
CINETPAY_SECRET_KEY=<secret key>
EOF
```

Recréer l'API (pas de rebuild : l'env suffit) :

```bash
cd ~/kd-hcblm && docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --force-recreate api
```

Contrôle : admin → **Paiements** → panneau fournisseurs — `cinetpay` doit
passer « configuré ». (`GET /payments/providers` côté API.)

## 3. Basculer le fournisseur actif

Admin → **Paiements** → fournisseur actif → **cinetpay** (réglage
`payment_provider`, Super Admin). La bascule ne vaut que pour les **nouveaux**
checkouts ; les commandes `manual` en attente restent constatables à la main.
Le retour arrière est instantané (re-basculer sur `manual`).

## 4. Le paiement d'essai (montant réel minimal)

Les montants sont figés par l'écran Tarifs — pour ne pas encaisser un vrai prix
sur un essai :

1. Créer un **produit d'essai** dédié (admin → Tarifs) sur un parcours de test,
   prix minimal accepté par le canal (p. ex. 200 F CFA), actif.
2. Depuis la PWA (compte réel de test, ou tunnel invité avec un e-mail à vous) :
   acheter ce produit → redirection vers la page CinetPay → payer par Mobile
   Money réel.
3. **Contrôles, dans l'ordre** :
   - la commande passe **PAID** sans intervention staff (webhook reçu, signé,
     contre-vérifié) — admin → Paiements ;
   - `PaymentEvent` : un événement `signatureOk` traité (pas de rejet) ;
   - l'**Entitlement** est créé et l'inscription au parcours passe ;
   - le **reçu PDF** se télécharge (montant, référence, mentions légales) ;
   - **réconciliation** vide de nouveautés (aucune commande bloquée, aucun
     paiement réussi non réglé) ; stats à jour.
4. Si le webhook tarde (réseau opérateur) : admin → commande → **Re-vérifier**
   interroge `/v2/payment/check` et applique la vérité du fournisseur — c'est
   le filet officiel, pas un contournement.
5. Après l'essai : désactiver le produit d'essai ; rembourser via le
   back-office CinetPay si nécessaire (le remboursement est un acte
   agrégateur — la plateforme constate le statut, elle ne l'initie pas).

## 5. Conduite d'incident

| Symptôme | Lecture | Action |
|---|---|---|
| Commande reste PENDING après paiement | Webhook perdu ou tardif | « Re-vérifier » sur la commande ; si récurrent, contrôler l'URL de notification déclarée et la joignabilité publique de l'API |
| Événement rejeté `signature_invalid` en série | SECRET KEY erronée (ou tentative de fraude) | Vérifier la clé du back-office vs `deploy/.env` ; les événements rejetés sont journalisés, l'événement légitime suivant n'est pas bloqué |
| `checkout_failed` à l'initialisation | Devise non activée, univers non validé, clés invalides | Contrôler §0 avec CinetPay ; le message API porte le code CinetPay exact |
| Écart montant/devise détecté | Notification incohérente avec la commande figée | Rien n'est réglé automatiquement — trancher via « Re-vérifier », investiguer avant tout constat manuel |
| Doute généralisé | — | Re-basculer le fournisseur actif sur `manual` : l'encaissement continue par virement pendant l'investigation |

## 6. Après le premier paiement réussi

- Renseigner les **mentions légales du reçu** (admin → Paiements) si ce n'est
  fait : raison sociale, adresse, régime fiscal.
- Garder la **réconciliation** dans la routine hebdomadaire (commandes > 24 h,
  paiements réussis non réglés, webhooks rejetés).
- Les prix réels (XOF/XAF/EUR) se gèrent dans l'écran Tarifs — aucune mise en
  production nécessaire pour en changer.
