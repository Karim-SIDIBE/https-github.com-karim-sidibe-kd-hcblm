# Déploiement KD-HCBLM — VPS LWS (API) + mutualisé LWS (PWA)

Architecture de production :

- **PWA** (statique) → hébergement **mutualisé LWS**, sur `app.declick.digital`
  (ou la racine `declick.digital`).
- **API** (Fastify + PostgreSQL) → **VPS LWS**, en Docker (API + Postgres + Caddy
  qui gère le HTTPS automatiquement), sur `api.declick.digital`.

---

## 1. DNS (zone `declick.digital`, espace LWS)

| Type | Nom | Valeur |
|------|-----|--------|
| `A` | `api` | **IP publique du VPS** |
| `A`/`CNAME` | `app` (et/ou `@`) | cible de ton **hébergement mutualisé** (IP ou domaine fourni par LWS) |

> Caddy ne pourra obtenir le certificat TLS qu’une fois `api.declick.digital`
> pointant vers le VPS et les ports **80/443** ouverts.

## 2. Préparer le VPS (Ubuntu/Debian)

```bash
# Docker + Compose (script officiel)
curl -fsSL https://get.docker.com | sh

# Récupérer le code (ton dépôt)
git clone https://github.com/Karim-SIDIBE/https-github.com-karim-sidibe-kd-hcblm.git kd-hcblm
cd kd-hcblm
```

## 3. Secrets & configuration

```bash
cp deploy/.env.example deploy/.env

# Générer les clés JWT ES256 (copie les 2 lignes AUTH_JWT_* affichées dans deploy/.env)
docker run --rm -v "$PWD":/app -w /app/server node:22-slim sh -c "npm i -g tsx >/dev/null 2>&1; npx tsx scripts/keygen.ts"
# (ou, si Node 22 est installé sur le VPS :  cd server && npm ci && npx tsx scripts/keygen.ts)

nano deploy/.env   # remplir POSTGRES_PASSWORD + les 2 clés ; vérifier les URLs declick.digital
```

## 4. Lancer la stack

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

Au démarrage, le conteneur API exécute automatiquement **`prisma migrate deploy`**
(création du schéma) puis lance le serveur. Caddy obtient le certificat TLS.

**(Première fois) publier le cours canonique + comptes de démonstration :**
```bash
docker compose -f deploy/docker-compose.yml exec api npx tsx prisma/seed.ts
```
> Le seed crée des comptes staff de démo (mots de passe par défaut) — **change-les**
> ou crée tes vrais comptes avant ouverture au public.

## 5. Vérifier

```bash
curl https://api.declick.digital/api/v1/health      # -> {"status":"ok",...}
```
Doc API : `https://api.declick.digital/api/v1/docs` · OpenAPI : `/api/v1/openapi.json`

## 6. Déployer le PWA sur le mutualisé

Sur ta machine (ou en CI), build le PWA **en pointant vers l’API de prod** :

```bash
cd web
VITE_API_URL=https://api.declick.digital/api/v1 npm run build
```

Puis **téléverse tout le contenu de `web/dist/`** dans le dossier racine de
`app.declick.digital` (via le **Gestionnaire de fichiers** cPanel/Plesk ou en **FTP**).

> Le PWA utilise un routage par hash (`#/…`) → **aucune réécriture `.htaccess`
> nécessaire**, il fonctionne sur de l’hébergement statique simple. Assure-toi que
> `index.html`, `sw.js` et `manifest.webmanifest` sont bien à la racine.

## 7. Exploitation

```bash
# logs
docker compose -f deploy/docker-compose.yml logs -f api

# redémarrer / mettre à jour après un git pull
git pull
docker compose -f deploy/docker-compose.yml up -d --build

# sauvegarde de la base (à planifier via cron)
docker compose -f deploy/docker-compose.yml exec -T db \
  pg_dump -U declick kd_hcblm | gzip > backup-$(date +%F).sql.gz
```

### Mise à jour des clés / rotation JWT
Voir `scripts/keygen.ts` : déplace l’ancienne clé publique dans
`AUTH_JWT_PREVIOUS_PUBLIC_KEY_PEM` avant d’injecter la nouvelle paire, puis
`up -d` — les anciens jetons restent validés le temps de la rotation.

---

### Notes
- **Médias** : stockés dans le volume `media` (persistant). Pour de la vidéo à
  l’échelle, fronter par un CDN et renseigner `MEDIA_PUBLIC_BASE_URL`.
- **Sauvegardes** : planifie le `pg_dump` ci-dessus + une copie hors-VPS.
- **Latence Afrique** : un VPS UE (LWS) convient pour un pilote ; pour réduire la
  latence, envisager plus tard un CDN devant le PWA et les médias.
