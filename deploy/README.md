# Déploiement KD-HCBLM — VPS LWS (tout-en-un : API + PWA)

Architecture de production (**tout sur le VPS**, Caddy gère le HTTPS automatique
pour les deux) :

- **PWA** (statique) → servi par **Caddy** sur `app.declick.digital`.
- **API** (Fastify + PostgreSQL) → Docker sur `api.declick.digital`.

---

## 1. DNS (zone `declick.digital`, espace LWS)

| Type | Nom | Valeur |
|------|-----|--------|
| `A` | `api` | `185.98.136.230` (IP du VPS) |
| `A` | `app` | `185.98.136.230` (IP du VPS) |
| `A` | `admin` | `185.98.136.230` (IP du VPS — console d'administration) |

> Caddy n’obtiendra les certificats TLS qu’une fois `api.` **et** `app.declick.digital`
> pointant vers le VPS et les ports **80/443** ouverts (laisser ~quelques minutes
> de propagation DNS). La racine `declick.digital` peut rester sur votre mutualisé
> (site vitrine) — indépendant.

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

# Clé de chiffrement au repos des champs sensibles (secret 2FA) — à générer UNE fois :
openssl rand -base64 32        # copie le résultat dans FIELD_ENCRYPTION_KEY (deploy/.env)

nano deploy/.env   # remplir POSTGRES_PASSWORD + clés JWT + FIELD_ENCRYPTION_KEY ; vérifier les URLs
```

> **Chiffrement au repos.** `FIELD_ENCRYPTION_KEY` chiffre les colonnes sensibles
> (secret TOTP) au niveau applicatif : une fuite de la seule base ne les expose pas.
> Garde la clé **hors base** et **sauvegarde-la** (la perdre rend les secrets 2FA
> illisibles → les utilisateurs devront réactiver la 2FA). Pour le disque lui-même,
> active le **chiffrement de volume** chez LWS (ou LUKS) — défense complémentaire.

> **Antivirus des uploads.** Un service **ClamAV** est désormais inclus dans le
> compose et l'API le cible via `CLAMAV_HOST=clamav` (défini dans le compose) : les
> uploads média / documents / paquets SCORM sont scannés par le vrai moteur (clamd
> INSTREAM). Aucune configuration à faire — au premier démarrage, ClamAV télécharge
> sa base de signatures (~1-2 min) avant de répondre aux scans (voir `start_period`).
> Par défaut (**fail-closed**), si clamd est injoignable l'upload est **bloqué**
> (défaut sûr) ; pour privilégier la disponibilité (upload autorisé si clamd est
> down, l'heuristique EICAR/exécutable s'appliquant quand même), mets
> `AV_FAIL_CLOSED=false` dans `deploy/.env`. Prévoir ~1,5 Go de RAM pour ce conteneur.

> **Durcissement runtime (Vague A).** Le conteneur API démarre en root uniquement
> le temps de corriger les droits du volume média, puis **abandonne les privilèges**
> et tourne en utilisateur non‑root `node` (via `gosu`, voir `deploy/entrypoint.sh`).
> Le compose ajoute `no-new-privileges` et `cap_drop: ALL` (seules `CHOWN` + les
> capabilities `setuid/setgid` de gosu sont réajoutées). **Caddy** émet des en‑têtes
> de sécurité (HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
> `X-Frame-Options`) et une **CSP en mode *Report‑Only*** sur les fronts : elle ne
> bloque rien, elle signale seulement les violations. Une fois vérifié qu'aucune
> violation légitime n'apparaît, renommer `Content-Security-Policy-Report-Only` en
> `Content-Security-Policy` dans `deploy/Caddyfile` pour l'appliquer.
>
> **Déploiement à surveiller + rollback.** Cette vague modifie l'image et l'entrée
> du conteneur. Déployez en gardant les logs ouverts :
> `docker compose -f deploy/docker-compose.yml logs -f api`. Si l'API ne démarre pas
> (droits média, gosu…), rollback immédiat : `git revert <commit> && git push`, puis
> `docker compose ... up -d --build`. Vérifier ensuite que le process tourne non‑root :
> `docker compose ... exec api id` doit afficher `uid=1000(node)`.

> **Observabilité & résilience (Vague B).** L'API expose `/health`, `/health/db`,
> `/health/ready` (readiness DB + état clamd) et, si `METRICS_ENABLED=true`,
> `/metrics` (Prometheus, protégé par `METRICS_TOKEN`, à scraper sur le réseau
> Docker interne). Drill de restauration non‑destructif : `deploy/verify-restore.sh`
> (restaure le dernier dump dans une base jetable et vérifie le schéma). Tests de
> charge : `deploy/loadtest/learner-load.js` (k6). Détails, scrape config, règles
> d'alerte et cibles SLA : `docs/ops/observability.md`.

## 4. Lancer la stack

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

Au démarrage, le conteneur API exécute automatiquement **`prisma migrate deploy`**
(création du schéma) puis lance le serveur. Caddy obtient les certificats TLS pour
`api.` et `app.declick.digital`.

> `app.declick.digital` répondra **404** tant que le PWA n’est pas construit
> (étape 5) — c’est normal ; l’API (étape 6) fonctionne dès maintenant.

**(Première fois) publier le cours canonique + comptes de démonstration :**
```bash
docker compose -f deploy/docker-compose.yml exec api npx tsx prisma/seed.ts
```
> Le seed crée des comptes staff de démo (mots de passe par défaut) — **change-les**
> ou crée tes vrais comptes avant ouverture au public.

## 5. Construire le PWA (servi par Caddy)

Caddy sert `app.declick.digital` depuis `web/dist` (monté en lecture seule). On
construit le PWA **sur le VPS**, sans installer Node (one-off Docker), en pointant
vers l’API de prod :

```bash
docker run --rm -v "$PWD":/app -w /app node:22-slim sh -c \
  "npm ci && VITE_API_URL=https://api.declick.digital/api/v1 npm -w web run build"
```

> Le branding par défaut donne déjà **DECLICK DIGITAL** ; seul `VITE_API_URL` est
> requis. Caddy détecte `web/dist` immédiatement (montage live) — pas besoin de
> redémarrer. À chaque mise à jour du front : relancer cette commande (le service
> worker `autoUpdate` propage la nouvelle version).

## 5 bis. Construire la console d'administration (servie par Caddy)

Caddy sert `admin.declick.digital` depuis `admin/dist`. Même principe :

```bash
docker run --rm -v "$PWD":/app -w /app node:22-slim sh -c \
  "npm ci && VITE_API_URL=https://api.declick.digital/api/v1 npm -w admin run build"
```

> Réservée au personnel (connexion par compte staff). Assurez-vous que
> `CORS_ORIGINS` (dans `deploy/.env`) inclut **`https://admin.declick.digital`**.

## 5 ter. Construire la console entreprise (servie par Caddy)

Caddy sert `entreprise.declick.digital` depuis `entreprise/dist`. C'est l'espace
**self-service** des clients entreprises (un admin d'organisation gère ses
apprenants et ses sièges). Même principe :

```bash
docker run --rm -v "$PWD":/app -w /app node:22-slim sh -c \
  "npm ci && VITE_API_URL=https://api.declick.digital/api/v1 npm -w entreprise run build"
```

> Ajoutez le DNS `entreprise A 185.98.136.230`, et vérifiez que `CORS_ORIGINS`
> inclut **`https://entreprise.declick.digital`**. L'accès est réservé aux
> administrateurs d'organisation (membership OWNER/ADMIN) ; un compte sans rôle
> admin verra un message « réservé aux administrateurs ».

## 6. Vérifier

```bash
curl https://api.declick.digital/api/v1/health      # -> {"status":"ok",...}
curl -I https://app.declick.digital/                # -> 200, l'app DECLICK DIGITAL
curl -I https://admin.declick.digital/              # -> 200, la console d'admin
```
Doc API : `https://api.declick.digital/api/v1/docs` · OpenAPI : `/api/v1/openapi.json`

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

**Purge RGPD (rétention)** — exécute les effacements arrivés à échéance (délai de
grâce écoulé) et purge tokens/journaux d'audit/codes expirés. À planifier
quotidiennement (ou déclencher manuellement depuis *Réglages → Système*) :

```bash
# token d'un compte staff avec la permission job:run, puis :
curl -fsS -X POST https://api.declick.digital/api/v1/jobs/retention/run \
  -H "authorization: Bearer $STAFF_TOKEN" >> /var/log/kd-retention.log 2>&1
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

## Sécurité — changer les mots de passe par défaut

Le seed crée des comptes staff avec un **mot de passe par défaut connu**
(`Declick!Dev2026`). **Avant toute ouverture au public**, changez-les avec le
script interactif (le mot de passe est saisi au clavier, jamais sur la ligne de
commande ni dans l'historique) :

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env \
  exec api npx tsx scripts/set-password.ts admin@kompetences.net
```

Répétez pour chaque compte à conserver (`designer@…`, `reviewer@…`,
`evaluator@…`), ou supprimez ceux que vous n'utilisez pas.

### Notes
- **Médias** : stockés dans le volume `media` (persistant). Pour de la vidéo à
  l’échelle, fronter par un CDN et renseigner `MEDIA_PUBLIC_BASE_URL`.
- **Sauvegardes** : `deploy/backup.sh` planifié via cron (voir §8) + copie hors-site.
- **Latence Afrique** : un VPS UE (LWS) convient pour un pilote ; pour réduire la
  latence, envisager plus tard un CDN devant le PWA et les médias.
