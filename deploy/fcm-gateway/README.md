# fcm-gateway — exemple de passerelle push (FCM + APNs)

Petit service **exemple** qui relaie les notifications push de l'API KD‑HCBLM vers
**Firebase Cloud Messaging**. FCM délivre aux **Android** directement et aux
**iOS** via APNs (si vous y avez chargé votre clé APNs) — une seule passerelle
couvre les deux plateformes.

```
API KD  ──POST {tokens, subject, body}──▶  fcm-gateway  ──▶  FCM  ──▶  Android / iOS
        (PUSH_WEBHOOK_URL)
```

## 1. Prérequis Firebase (une fois)
1. Créez un projet sur https://console.firebase.google.com.
2. **Android** : ajoutez une app Android (package `digital.declick.app`), téléchargez `google-services.json` et placez‑le dans `mobile/android/app/`.
3. **iOS** (si vous publiez sur l'App Store) : *Project settings → Cloud Messaging → APNs Authentication Key* → chargez votre clé `.p8` (Team ID + Key ID).
4. **Clé de service** : *Project settings → Service accounts → Generate new private key* → vous obtenez un fichier JSON. **Gardez‑le secret.**

## 2. Lancer la passerelle
Variables d'environnement :
| Variable | Rôle |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | le **contenu JSON** de la clé de service (ou utilisez `GOOGLE_APPLICATION_CREDENTIALS=/chemin/key.json`) |
| `GATEWAY_SECRET` | secret partagé exigé dans l'URL (`?key=…`) |
| `BRAND_NAME` | titre par défaut des notifications (optionnel) |
| `PORT` | port d'écoute (défaut 8088) |

En local :
```bash
cd deploy/fcm-gateway && npm install
GATEWAY_SECRET=$(openssl rand -hex 16) \
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
npm start
```

## 3. Intégrer au stack Docker (recommandé)
Ajoutez ce service dans `deploy/docker-compose.yml` (il rejoint le réseau du compose, l'API l'atteint par son nom `fcm-gateway`) :
```yaml
  fcm-gateway:
    build: ./fcm-gateway
    restart: unless-stopped
    mem_limit: 192m
    environment:
      GATEWAY_SECRET: ${PUSH_GATEWAY_SECRET}
      FIREBASE_SERVICE_ACCOUNT: ${FIREBASE_SERVICE_ACCOUNT}
      BRAND_NAME: ${BRAND_NAME:-DECLICK DIGITAL}
    expose:
      - "8088"
```
Puis dans `deploy/.env` :
```
PUSH_GATEWAY_SECRET=<un secret aléatoire>
FIREBASE_SERVICE_ACCOUNT={"type":"service_account", ... }   # le JSON sur UNE ligne
PUSH_WEBHOOK_URL=http://fcm-gateway:8088/push?key=<le même PUSH_GATEWAY_SECRET>
```
Redémarrez : `docker compose up -d --build fcm-gateway api`.

> L'API envoie déjà, pour une notification PUSH, le payload
> `{ id, to, kind, channel, subject, body, tokens: [...] }`. La passerelle utilise
> `tokens` (résolus côté API depuis les appareils enregistrés), `subject` (titre)
> et `body`. Un `route` éventuel devient `data.route` → deep‑link au tap.

## 4. Tester
```bash
# santé
curl -s http://localhost:8088/health
# envoi de test (remplacez le token par un vrai token d'appareil)
curl -s -X POST "http://localhost:8088/push?key=$GATEWAY_SECRET" \
  -H 'content-type: application/json' \
  -d '{"subject":"Test","body":"Bonjour 👋","tokens":["<DEVICE_TOKEN>"]}'
# → {"sent":1,"failed":0}
```

## Notes
- `sendEachForMulticast` gère jusqu'à 500 tokens par appel et renvoie le détail par token ; les tokens invalides sont **loggués** (vous pourrez les purger côté API plus tard).
- Sécurité : la passerelle n'accepte que les requêtes avec le bon `?key=`. Ne l'exposez pas publiquement sans ce secret (ou gardez‑la sur le réseau interne du compose).
- C'est un **exemple** minimal volontairement simple ; en production vous voudrez peut‑être des retries, une file, et la purge automatique des tokens morts.
