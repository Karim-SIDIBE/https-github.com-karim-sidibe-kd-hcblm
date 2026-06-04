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
```

## 8. Sauvegardes (base + médias + secrets)

Le script **`deploy/backup.sh`** sauvegarde la base (`pg_dump -Fc`), le volume
**médias** et le **`.env`** (mot de passe DB + clés JWT), avec rotation, et une
copie **hors-site** optionnelle via `rclone` (recommandée — survit à la perte
totale du VPS). Variables dans `deploy/.env` : `BACKUP_RETENTION_DAYS`,
`BACKUP_RCLONE_REMOTE`.

```bash
# sauvegarde manuelle
deploy/backup.sh

# planifier (cron quotidien à 02h15) :  crontab -e
15 2 * * *  /home/<user>/kd-hcblm/deploy/backup.sh >> /var/log/kd-backup.log 2>&1
```

> Pour l'hors-site : `apt install rclone` puis `rclone config` (S3/R2/Backblaze/
> Google Drive…), et renseigne `BACKUP_RCLONE_REMOTE` (ex. `r2:declick-backups`).

**Restauration** (destructif — écrase les données en place) :

```bash
deploy/restore.sh deploy/backups/db-AAAAMMJJ-HHMMSS.dump \
                  [deploy/backups/media-AAAAMMJJ-HHMMSS.tgz]
```

> Le pack **BUSINESS/PREMIUM de LWS ne sauvegarde PAS le VPS** (il ne couvre que
> le mutualisé) — d'où ce script. Inutile de souscrire à BUSINESS pour le VPS.

### Mise à jour des clés / rotation JWT
Voir `scripts/keygen.ts` : déplace l’ancienne clé publique dans
`AUTH_JWT_PREVIOUS_PUBLIC_KEY_PEM` avant d’injecter la nouvelle paire, puis
`up -d` — les anciens jetons restent validés le temps de la rotation.

---

## Capacité & dimensionnement (VPS 2 vCore / 4 Go / 100 Go NVMe)

Cible de lancement : **300 apprenants actifs sur 30 jours**. Avec le modèle
**hors-ligne d'abord** (les apprenants *téléchargent* puis consomment hors-ligne ;
le serveur ne reçoit que de la synchro d'actions + de la progression), la
concurrence de pointe réelle est de l'ordre de **quelques dizaines** de requêtes
simultanées — très loin de saturer cette machine.

`docker-compose.yml` est réglé en conséquence (mémoire bornée par conteneur pour
garder de la marge OS) :

| Conteneur | `mem_limit` | Réglages clés |
|---|---|---|
| **db** (Postgres 16) | 1,5 Go | `shared_buffers=512MB`, `effective_cache_size=1024MB`, `max_connections=50`, `work_mem=8MB`, planner NVMe (`random_page_cost=1.1`), `jit=off`, `shm_size=256m` |
| **api** (Fastify) | 768 Mo | `NODE_OPTIONS=--max-old-space-size=640` ; pool Prisma `connection_limit=15` |
| **caddy** | 128 Mo | reverse-proxy + TLS |

Total plafonné ≈ 2,4 Go → il reste ~1,5 Go pour l'OS, Docker et le cache disque.
**Le goulot n'est jamais CPU/RAM mais les médias** (disque + bande passante).

**Quand passer à l'échelle** (au-delà du pilote) :
- **Disque** : si la bibliothèque vidéo dépasse ~50–60 Go, ou
- **Bande passante** : si le streaming simultané augmente,
  → basculer les vidéos vers un **stockage objet + CDN** et renseigner
  `MEDIA_PUBLIC_BASE_URL`. Le reste (API, DB) tient très largement.

### Notes
- **Médias** : stockés dans le volume `media` (persistant). Pour de la vidéo à
  l’échelle, fronter par un CDN et renseigner `MEDIA_PUBLIC_BASE_URL`.
- **Sauvegardes** : `deploy/backup.sh` planifié via cron (voir §8) + copie hors-site.
- **Latence Afrique** : un VPS UE (LWS) convient pour un pilote ; pour réduire la
  latence, envisager plus tard un CDN devant le PWA et les médias.
