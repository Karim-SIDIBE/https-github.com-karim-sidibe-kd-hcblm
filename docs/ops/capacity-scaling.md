# Capacité & montée en charge

Combien d'utilisateurs la plateforme tient‑elle, et que faut‑il ajouter à chaque
doublement ? Analyse fondée sur la **configuration réelle** du dépôt (compose +
env), pas sur une intuition.

## Contraintes réelles (config actuelle)

- **1 seul process API** (Fastify, mono‑thread JS) sur **2 vCPU**, `mem_limit` 768 Mo,
  `--max-old-space-size=640`.
- **Pool DB Prisma = 15** (`connection_limit=15`) → au plus **15 requêtes SQL en vol**
  simultanément ; au‑delà, mise en file (`pool_timeout=30s`).
- **Postgres** : `max_connections=50`, `shared_buffers=512MB`, `work_mem=8MB`.
- **Modèle hors‑ligne d'abord** : l'apprenant télécharge puis consomme hors‑ligne ;
  le serveur ne reçoit que de la **synchro d'actions + progression**.
- **Goulot dominant : l'egress média** (bande passante/disque vidéo), pas le CPU/RAM.

## « Simultané » : trois sens, un seul utile

| Sens | Ordre de grandeur | Remarque |
|---|---|---|
| Requêtes réellement en vol (instant t) | ~**15** (pool DB) + statique | Limite dure du pool. |
| **Utilisateurs actifs simultanés** (pointe) | **le chiffre utile** | Chacun n'émet qu'une requête toutes les X s. |
| Comptes inscrits | quasi illimité | Borné par le disque, pas le compute. |

**Formule** : `utilisateurs actifs ≈ débit soutenable (req/s) ÷ requêtes par utilisateur/s`.

Avec un débit soutenable prudent de **~500 req/s** pour la config actuelle :

- **Interactif en ligne** (~1 req / 5 s) → **~2 500 utilisateurs actifs simultanés**.
- **Hors‑ligne d'abord** (le vrai modèle, ~1 req / 20 s) → **~10 000+**.

> ⚠️ **Estimations d'ingénierie, à valider par la mesure.** Lance le test de charge
> livré pour obtenir le vrai chiffre sur la machine cible :
> `k6 run -e BASE=https://api.declick.digital/api/v1 -e PEAK=1000 deploy/loadtest/learner-load.js`

Base retenue pour les doublements : **~2 500 (interactif)** — prudente ; le
hors‑ligne multiplie par ~4.

## Doublements ×1 → ×7 : configuration nécessaire

| Palier | Actifs simultanés | Config à ajouter (incrémental) |
|---|---|---|
| **×1** (actuel) | ~2 500 | 2 vCPU / 4 Go, 1 API, Postgres on‑box (pool 15 / max_conn 50), médias disque. Déjà prévu : médias → **objet + CDN** dès que la vidéothèque grossit. |
| **×2** (~5 000) | | API en **2 workers** (cluster Node) ; `connection_limit` 15→25 ; **CDN média obligatoire**. |
| **×4** (~10 000) | | **4 vCPU / 8 Go** ; Postgres `max_connections` 50→100, `shared_buffers` ~2 Go ; 3–4 workers. |
| **×8** (~20 000) | | **Horizontal** : 2–3 nœuds API **sans état** derrière un LB + **Redis** (rate‑limit partagé + cache SAML `InResponseTo`) ; **PgBouncer** ; DB dédiée 8 vCPU / 16–32 Go. |
| **×16** (~40 000) | | 4–6 nœuds API autoscalés ; **réplicas Postgres en lecture** (analytics/reporting) ; PgBouncer transaction pooling ; CDN multi‑région. |
| **×32** (~80 000) | | Orchestration (K8s / parc de VM + LB managé) ; **workers async** dédiés (notifications/jobs) ; Postgres managé HA + réplicas. |
| **×64** (~160 000) | | **Sharding / Postgres distribué** (Citus ou managé) ; pipeline **analytics/LRS séparé** (entrepôt type ClickHouse) ; autoscaling agressif. |
| **×128** (~320 000) | | Multi‑région (API + DB + CDN) ; cache Redis étendu ; **isolation des charges** (apprenant / admin / LRS) ; SRE + observabilité renforcée. |

## Deux points structurants

1. **Prérequis au passage horizontal (×8+).** L'API est *presque* sans état
   (JWT + refresh en base). Trois éléments sont en **mémoire locale** et doivent
   passer sur **Redis** avant de multiplier les nœuds — sinon ils se dupliquent
   par nœud :
   - le **rate‑limit** (compteur par process → limite effective ×N) ;
   - le **cache SAML `InResponseTo`** (anti‑rejeu, sinon incohérent entre nœuds) ;
   - les **métriques** (`/metrics` est par‑process → Prometheus scrape alors chaque
     nœud séparément).
   Le passage « 2 workers + Redis‑ready » prépare précisément ces points (rate‑limit
   + SAML basculent sur Redis dès que `REDIS_URL` est défini ; sinon in‑memory).

2. **Le média domine avant l'API.** Bien avant de saturer API/DB, c'est la bande
   passante vidéo qui coince. **Objet + CDN** (`MEDIA_PUBLIC_BASE_URL`) découple ce
   coût — c'est le **premier** investissement, dès le ×2.

## Notes de mise à l'échelle applicative

- Le passage **2 workers** exploite les 2 vCPU (Node est mono‑thread par process) —
  gain quasi immédiat. Avec 2 workers, baisser `--max-old-space-size` par worker ou
  relever `mem_limit` de l'API.
- `max_connections=50` avec `connection_limit=15` par instance → ~3 instances API
  (3×15=45) avant de relever `max_connections` **ou** d'introduire **PgBouncer**.
- Voir `docs/ops/observability.md` pour mesurer réellement (latence, débit, erreurs)
  à chaque palier.

## Activer « 2 workers + Redis » (prêt dans le code, opt‑in)

Le code supporte déjà le multi‑worker et l'état partagé Redis, **désactivés par
défaut** (1 process, in‑memory → comportement actuel inchangé). Pour activer :

1. Décommenter le service `redis` dans `deploy/docker-compose.yml`.
2. Dans `deploy/.env` :
   ```
   API_WORKERS=2
   REDIS_URL=redis://redis:6379
   ```
3. Pour tenir 2 workers sous le `mem_limit` de l'`api` (768 Mo), **plafonner le tas
   par worker** — soit ajouter `NODE_OPTIONS=--max-old-space-size=320` au service
   `api`, soit relever son `mem_limit` (~1,2–1,5 Go).
4. `docker compose … up -d` puis vérifier `docker top kd-hcblm-api-1` (2 process node).

Ce qui devient partagé via Redis dès `REDIS_URL` défini : le **rate‑limit** (compté
globalement, plus par worker) et le **cache anti‑rejeu SAML** `InResponseTo`. Sans
Redis mais avec `API_WORKERS>1`, l'API émet un **avertissement au boot** (limite ×N,
SAML par worker).

Limite connue : les **`/metrics` sont par worker** (Prometheus scrape un worker au
hasard sur le port partagé). Pour des métriques exactes en multi‑worker, exposer un
port par worker ou agréger — à traiter au vrai passage horizontal (×8).
