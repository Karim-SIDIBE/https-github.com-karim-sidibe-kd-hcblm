# Observabilité, alerting & résilience (Vague B)

Runbook opérationnel pour la stack KD‑HCBLM. Objectif : passer de « ça tourne »
à « on **sait** que ça tourne, on est **alerté** sinon, et on peut **restaurer** ».

## 1. Ce que l'API expose

| Endpoint | Usage |
|---|---|
| `GET /health` | Liveness (le process répond). Déjà utilisé par le healthcheck Docker. |
| `GET /health/db` | Vérifie la connexion Postgres. |
| `GET /health/ready` | **Readiness** : `200` si la DB répond (dépendance critique), `503` sinon. Le corps rapporte aussi l'état de clamd (`checks.clamav`) — informatif, ne bloque pas la readiness. |
| `GET /metrics` | Métriques **Prometheus** (texte v0.0.4). Désactivé par défaut. |

### Activer les métriques
Dans `deploy/.env` :
```
METRICS_ENABLED=true
METRICS_TOKEN=<jeton_long_aléatoire>   # openssl rand -base64 32
```
`/metrics` est **top‑level** (pas sous `/api/v1`), servi par le conteneur `api`
sur le port 4000, et exige `Authorization: Bearer $METRICS_TOKEN` si le jeton est
défini. Ne l'exposez pas publiquement via Caddy — scrapez‑le **sur le réseau
Docker interne** (`api:4000/metrics`).

### Métriques clés exposées
- `http_requests_total{method,route,status}` — compteur (le label `route` est le
  motif Fastify, cardinalité bornée).
- `http_request_duration_seconds_{sum,count}{method,route}` — résumé (latence moyenne).
- `http_requests_in_flight` — jauge.
- `process_resident_memory_bytes`, `nodejs_heap_used_bytes`, `process_uptime_seconds`.
- `kd_build_info{version}`.

## 2. Prometheus — scrape

`prometheus.yml` (Prometheus tournant sur le réseau Docker `kd-hcblm_default`) :
```yaml
scrape_configs:
  - job_name: kd-api
    metrics_path: /metrics
    scheme: http
    authorization:
      type: Bearer
      credentials: "${METRICS_TOKEN}"
    static_configs:
      - targets: ["api:4000"]
```

## 3. Alerting (Alertmanager)

Règles minimales à fort ROI (`rules.yml`) :
```yaml
groups:
  - name: kd-api
    rules:
      - alert: ApiDown
        expr: up{job="kd-api"} == 0
        for: 2m
        annotations: { summary: "API KD injoignable (scrape down)" }

      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          / clamp_min(sum(rate(http_requests_total[5m])), 1) > 0.02
        for: 5m
        annotations: { summary: "Taux d'erreurs 5xx > 2% (5 min)" }

      - alert: HighLatency
        expr: |
          sum(rate(http_request_duration_seconds_sum[5m]))
          / clamp_min(sum(rate(http_request_duration_seconds_count[5m])), 1) > 0.5
        for: 10m
        annotations: { summary: "Latence moyenne > 500 ms (10 min)" }

      - alert: HighMemory
        expr: process_resident_memory_bytes > 700e6
        for: 10m
        annotations: { summary: "RSS API > 700 Mo (proche du mem_limit 768m)" }
```
Pour surveiller la **readiness** (DB/clamd) sans Prometheus applicatif, utilisez un
*blackbox exporter* qui interroge `http://api:4000/api/v1/health/ready` et alerte
si le code ≠ 200 (DB down) ; le corps JSON distingue `db` vs `clamav`.

## 4. Logs

L'API émet des logs **JSON structurés** (pino) sur stdout — déjà consommables tels
quels. Pour la centralisation : **promtail** lit les logs Docker et les pousse vers
**Loki**, requêtables dans Grafana. Chaque requête porte un `reqId`, la méthode,
l'URL, le `statusCode`, le `responseTime` et l'IP réelle du client (grâce à
`trustProxy`). Le **journal d'audit** applicatif (auth, accès sensibles) reste en
base et complète les logs d'infra.

Exemple `promtail` (source Docker) : cibler les conteneurs du projet `kd-hcblm`,
label `service` = nom du conteneur ; filtrer `level>=50` (erreurs) pour un flux
d'alerte.

## 5. Grafana — panneaux recommandés
- **Débit** : `sum(rate(http_requests_total[1m]))`.
- **Taux d'erreurs** : 5xx / total (cf. règle ci‑dessus).
- **Latence moyenne** : `rate(_sum[5m]) / rate(_count[5m])`, ventilée par `route`.
- **In‑flight**, **RSS/heap**, **uptime**, **version** (`kd_build_info`).

## 6. Résilience — drill de restauration

Avoir des sauvegardes ne suffit pas ; il faut prouver qu'elles se **restaurent**.
`deploy/verify-restore.sh` restaure le dernier dump dans une base **jetable**,
vérifie le schéma (nb de tables, `User`, `Course`), puis la supprime — **sans
toucher la prod**. À planifier en cron (hebdomadaire) :
```
30 3 * * 1  /root/kd-hcblm/deploy/verify-restore.sh >> /var/log/kd-restore-drill.log 2>&1
```
Chaîne complète : `deploy/backup.sh` (dump quotidien + média + `.env`, rotation,
copie off‑site rclone optionnelle) → `deploy/verify-restore.sh` (drill) →
`deploy/restore.sh` (restauration réelle en cas de sinistre).

## 7. Cibles SLA (proposées)
| Indicateur | Cible |
|---|---|
| Disponibilité API | 99,5 % / mois |
| Latence p95 (hors upload/transcode) | < 500 ms |
| Taux d'erreurs 5xx | < 1 % |
| RPO (perte de données max) | ≤ 24 h (sauvegarde quotidienne) |
| RTO (temps de restauration) | ≤ 1 h (mesuré par le drill) |

## 8. Tests de charge

`deploy/loadtest/learner-load.js` (k6) : rampe échelonnée (0 → pic → 0) sur
`/health` + `/health/ready`, avec seuils (`http_req_failed<1%`,
`p95<500ms`, `p99<1.5s`). Passer `-e BEARER=<token>` pour ajouter un parcours
apprenant authentifié (catalogue → lecture de cours). Ajuster le pic via
`-e PEAK=<vus>` (300 par défaut ; monter à 1000/3000 pour stresser).
```
k6 run -e BASE=https://api.declick.digital/api/v1 -e PEAK=300 deploy/loadtest/learner-load.js
```
> Note capacité : la cible « 300 apprenants actifs » tient sur le VPS 2 vCPU/4 Go.
> Pour viser plus haut, mesurer d'abord (ce test), puis envisager des réplicas API
> + un pool DB dimensionné avant d'annoncer une échelle supérieure.
