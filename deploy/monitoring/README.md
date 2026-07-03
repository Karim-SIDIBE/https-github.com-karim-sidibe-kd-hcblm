# Monitoring overlay — Prometheus · Alertmanager · Loki · promtail · Grafana

Stack de supervision clé‑en‑main pour KD‑HCBLM. Elle tourne **à côté** de la stack
applicative (projet compose séparé `kd-monitoring`) et rejoint son réseau pour
scraper `/metrics` et collecter les logs Docker. Tout est **provisionné** : sources
de données et un tableau de bord Grafana sont prêts au démarrage.

Toutes les interfaces écoutent sur **127.0.0.1 uniquement** (rien de public).

## Mise en route (3 étapes)

**1. Activer les métriques côté application** — dans `deploy/.env` (stack principale) :
```
METRICS_ENABLED=true
METRICS_TOKEN=$(openssl rand -base64 32)     # notez la valeur
```
puis redéployez l'app :
```
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
```

**2. Fournir le même token au scraper + le mot de passe Grafana**
```
echo -n "<METRICS_TOKEN identique>" > deploy/monitoring/secrets/metrics_token   # sans newline
cp deploy/monitoring/.env.example deploy/monitoring/.env
# éditez deploy/monitoring/.env → GRAFANA_ADMIN_PASSWORD=<mot de passe fort>
```

**3. Lancer la supervision**
```
docker compose -f deploy/monitoring/docker-compose.monitoring.yml \
  --env-file deploy/monitoring/.env up -d
```

## Accès (via tunnel SSH — rien n'est exposé publiquement)

```
ssh -L 3000:127.0.0.1:3000 -L 9090:127.0.0.1:9090 -L 9093:127.0.0.1:9093 root@<vps>
```
- **Grafana** : http://localhost:3000 (admin / `GRAFANA_ADMIN_PASSWORD`) → dashboard « KD API — vue d'ensemble » déjà présent ; Explore → source **Loki** pour les logs (`{service="api"} | json`).
- **Prometheus** : http://localhost:9090 (cibles : Status → Targets ; `kd-api` doit être `UP`).
- **Alertmanager** : http://localhost:9093.

## Vérifs rapides

```
# Prometheus voit-il l'API ?
curl -s http://localhost:9090/api/v1/targets | grep kd-api
# Les logs arrivent-ils dans Loki ?
curl -s "http://localhost:3100/loki/api/v1/label/service/values"    # depuis le réseau docker
```

## Notifications d'alerte

Par défaut, Alertmanager **n'envoie rien** (receiver vide). Pour être notifié,
décommentez un bloc `slack_configs` / `webhook_configs` / `email_configs` dans
`alertmanager/alertmanager.yml`, puis :
```
docker compose -f deploy/monitoring/docker-compose.monitoring.yml restart alertmanager
```
Règles d'alerte fournies (`prometheus/rules.yml`) : API down, taux 5xx > 2 %,
latence moyenne > 500 ms, RSS > 700 Mo.

## Empreinte ressources

Prometheus ~512 Mo, Loki ~512 Mo, Grafana ~256 Mo, Alertmanager/promtail ~128 Mo.
Sur un VPS 4 Go partagé avec l'app + Postgres + ClamAV, c'est **serré** : réservez
cette stack à un VPS un peu plus dodu, ou hébergez la supervision ailleurs (elle
scrape l'API à distance en pointant `targets: ["<api-host>:4000"]` et en exposant
`/metrics` derrière Caddy avec le token). Voir aussi `docs/ops/observability.md`.

## Arrêt

```
docker compose -f deploy/monitoring/docker-compose.monitoring.yml down          # garde les volumes
docker compose -f deploy/monitoring/docker-compose.monitoring.yml down -v       # purge données
```
