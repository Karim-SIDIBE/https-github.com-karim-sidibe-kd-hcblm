# CDN pour les vidéos — DECLICK DIGITAL

Ce guide explique **quand** et **comment** mettre les vidéos derrière un CDN
(réseau de diffusion de contenu) pour décharger le VPS et réduire la latence en
Afrique. La plateforme est déjà **prête** pour le CDN : il suffit, le moment
venu, d'une variable d'environnement et (pour l'option 1) de quelques lignes
DNS — aucun changement de code.

---

## 1. Est-ce nécessaire maintenant ?

**Non, pas au lancement.** Le modèle est *hors-ligne d'abord* : un apprenant
télécharge le parcours une fois, puis consomme les vidéos depuis son appareil.
Le serveur ne sert chaque vidéo qu'**une poignée de fois** (au moment du
téléchargement), pas en streaming continu. Le VPS (100 Go NVMe) tient
largement un pilote.

**Basculez vers un CDN quand l'un de ces seuils est atteint :**

| Déclencheur | Seuil indicatif |
|---|---|
| **Disque** | la bibliothèque vidéo dépasse ~50–60 Go |
| **Bande passante** | beaucoup de téléchargements simultanés (béta → public) |
| **Latence** | les apprenants éloignés se plaignent de lenteurs de chargement |

> Au jour 0, aucune vidéo n'est encore en ligne. Ce document est là pour le jour
> où vous en ajoutez en volume.

---

## 2. Comment ça marche dans le code (déjà en place)

- Tout objet média a une **clé non devinable** : `sources/<uuid>/source.mp4`.
- `storage.publicUrl(key)` renvoie :
  - `https://cdn.declick.digital/<key>` **si** `MEDIA_PUBLIC_BASE_URL` est défini ;
  - sinon le point d'API **authentifié** `/api/v1/media/file/<key>` (défaut actuel).
- La lecture (`/media/:id/playback`), le téléchargement hors-ligne **et** les
  sous-titres utilisent tous `publicUrl`. Donc **dès que `MEDIA_PUBLIC_BASE_URL`
  est renseigné, toutes les URLs vidéo pointent vers le CDN** — sans toucher au
  code.

> ⚠️ **Implication sécurité.** Par défaut les médias sont protégés par jeton
> (auth). Un CDN public ne peut pas porter le jeton de l'apprenant : activer un
> CDN rend donc les fichiers **accessibles via leur URL** (mais les clés sont des
> UUID non énumérables — « security by obscurity »). C'est acceptable pour des
> vidéos pédagogiques. Les données sensibles (certificats, profils) ne sont **pas**
> des médias et restent protégées. Si un jour vous diffusez du contenu vraiment
> confidentiel, passez à des URLs signées (Mux/CloudFront/Bunny token auth).

---

## 3. Deux options

### Option 1 — CDN *pull-zone* devant le VPS  ✅ recommandé pour démarrer

Le plus simple et le moins cher. Le VPS reste la source ; le CDN met en cache et
sert depuis ses points de présence (POP) proches des apprenants. **Aucune
migration de stockage.**

**Recommandation : [BunnyCDN](https://bunny.net)** — facturation à l'usage
(~0,01–0,03 $/Go), POP en Afrique (Johannesburg, Lagos, Nairobi…), pull-zone en
2 minutes. (Cloudflare convient aussi mais sa mise en cache vidéo demande un plan
payant ; BunnyCDN est plus direct pour ce cas.)

**Étapes :**

1. **DNS** (zone `declick.digital`) :
   `media`  `A`  `185.98.136.230`
2. **Caddy** : dé-commentez le bloc `media.declick.digital` dans
   `deploy/Caddyfile` (le volume `media` est déjà monté en lecture seule sur
   `/srv/media`). Puis :
   ```bash
   docker compose -f deploy/docker-compose.yml up -d caddy
   ```
   Vérifiez : `curl -I https://media.declick.digital/` (404 attendu tant qu'aucun
   fichier n'est demandé — c'est normal ; le but est que le TLS soit obtenu).
3. **BunnyCDN** : créez une *Pull Zone*
   - Origin URL : `https://media.declick.digital`
   - notez le hostname fourni (ex. `declick.b-cdn.net`) — ou branchez votre
     propre `cdn.declick.digital` en CNAME dessus.
4. **`deploy/.env`** :
   ```
   MEDIA_PUBLIC_BASE_URL=https://cdn.declick.digital
   ```
   puis redémarrez l'API : `docker compose -f deploy/docker-compose.yml up -d api`
5. **Vérifiez** une vidéo : ouvrez une micro-session côté apprenant → l'URL de la
   vidéo doit commencer par `https://cdn.declick.digital/...` (onglet Réseau).

> Le bloc Caddy renvoie déjà `Cache-Control: public, max-age=2592000, immutable`
> et `Access-Control-Allow-Origin: *`, et `file_server` gère les requêtes *Range*
> (le seek vidéo fonctionne).

### Option 2 — Stockage objet + CDN (R2 / B2 / S3)

Pour de plus gros volumes : on sort les fichiers du VPS vers un stockage objet
(le disque du VPS n'est plus le goulot). **Recommandation : Cloudflare R2**
(compatible S3, **égress gratuit**, CDN Cloudflare intégré).

Le module `server/src/lib/storage/storage.ts` est écrit comme un *drop-in* S3
(`put/sizeOf/read/readRange/remove/publicUrl`). Migrer = écrire un provider S3
derrière cette même interface (via `@aws-sdk/client-s3`), basculer dessus, puis
copier les fichiers existants. C'est plus de travail que l'option 1 ; à réserver
au moment où la bibliothèque devient vraiment volumineuse. (Me le demander le
moment venu — je l'implémente.)

---

## 4. Revenir en arrière

Videz simplement `MEDIA_PUBLIC_BASE_URL` (ou commentez-la) dans `deploy/.env` et
`up -d api` : toutes les URLs repassent par le point d'API authentifié du VPS.
Aucune donnée perdue.

---

## 5. Résumé

- **Maintenant (jour 0, béta) :** ne rien faire. Le VPS suffit.
- **Quand le volume vidéo grimpe :** Option 1 (BunnyCDN pull-zone) — DNS + 1
  bloc Caddy + 1 variable d'env. ~15 min.
- **À grande échelle :** Option 2 (R2 + provider S3) — me solliciter pour le code.
