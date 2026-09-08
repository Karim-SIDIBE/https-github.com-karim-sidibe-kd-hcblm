# Protection anti-aspiration et anti-abus des sites DECLICK DIGITAL

Trois couches complémentaires, de la plus simple à la plus puissante :

| Couche | Ce qu'elle arrête | Où elle vit |
|---|---|---|
| 1. `robots.txt` + `X-Robots-Tag` | Les robots polis ; base légale (« l'interdiction était explicite ») | Dépôt (fronts + Caddyfile) |
| 2. fail2ban | Les rafales depuis une IP : aspiration, scan, brute-force | VPS (hôte) |
| 3. Cloudflare | Les botnets, le scraping distribué, les pics ; masque l'IP du VPS | DNS (registrar) |

Rappel de fond : la valeur (cours, vidéos, quiz) est **derrière authentification et
droits d'accès** — un aspirateur n'obtient que la coquille des applications. Les
pages publiques (vitrine, brochure, catalogue) sont du marketing : on rend leur
copie *coûteuse et détectable*, pas impossible (c'est impossible).

---

## 1. robots.txt et en-têtes (déployés avec les fronts)

- `web/public/robots.txt` : indexation permise (l'app a une valeur SEO),
  aspirateurs connus interdits nommément.
- `admin/public/robots.txt` et `entreprise/public/robots.txt` : `Disallow: /`.
- Caddyfile : `X-Robots-Tag "noindex, nofollow"` sur admin et entreprise
  (défense en profondeur — vaut même si un robot ignore robots.txt).
- **Vitrine (`declick.digital`, hébergement externe)** : téléverser le
  `robots.txt` fourni à la racine, à côté d'`index_Declick_Digital.html`.

## 2. fail2ban (VPS)

### Principe

Caddy écrit désormais un **journal d'accès JSON par site** dans
`deploy/caddy-logs/` (monté dans le conteneur en `/var/log/caddy`, rotation
20 Mio × 3). fail2ban, sur l'hôte, lit ces journaux et bannit :

- **caddy-abuse** : ≥ 20 réponses 401/403/429 en 60 s (brute-force, scan,
  martèlement du rate-limit API) → bannissement 1 h ;
- **caddy-flood** : ≥ 400 requêtes en 60 s, tous statuts (motif de
  l'aspiration : des centaines de GET séquentiels) → bannissement 1 h ;
- **sshd** : 5 échecs SSH en 10 min → 1 h.

**Piège Docker évité** : les ports publiés par Docker contournent la chaîne
`INPUT` — les jails Caddy bannissent donc dans **`DOCKER-USER`**, seule chaîne
traversée avant les règles de Docker.

### Installation (une fois, sur le VPS)

```bash
apt-get update && apt-get install -y fail2ban
mkdir -p ~/kd-hcblm/deploy/caddy-logs
cd ~/kd-hcblm && docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --force-recreate caddy
cp ~/kd-hcblm/deploy/fail2ban/filter.d/caddy-*.conf /etc/fail2ban/filter.d/
cp ~/kd-hcblm/deploy/fail2ban/jail.d/kd-hcblm.local /etc/fail2ban/jail.d/
systemctl enable --now fail2ban
systemctl restart fail2ban
```

### Vérification et exploitation

```bash
fail2ban-client status                    # les 3 jails doivent apparaître
fail2ban-client status caddy-flood        # IP bannies de la jail
tail -n 3 ~/kd-hcblm/deploy/caddy-logs/app.access.log   # le journal se remplit
fail2ban-client set caddy-flood unbanip 1.2.3.4         # débannir une IP
```

Faux positif possible : un bureau entier derrière une même IP (NAT) qui utilise
intensément la plateforme peut approcher le seuil de `caddy-flood`. Symptôme :
« le site ne répond plus » pour tout le bureau pendant 1 h. Remède : débannir,
puis monter `maxretry` (600, 800…) dans `/etc/fail2ban/jail.d/kd-hcblm.local`
et `systemctl restart fail2ban`.

## 3. Cloudflare (guide pas-à-pas)

Le levier le plus fort : filtre les botnets **avant** le VPS, masque son IP,
absorbe les pics. Offre gratuite suffisante.

### Mise en place

1. **Compte** : créer un compte sur cloudflare.com → « Add a site » →
   `declick.digital` → plan **Free**.
2. **DNS** : Cloudflare scanne les enregistrements existants. Vérifier la liste
   (A `185.98.136.230`) : `declick.digital` (apex), `www`, `app`, `api`,
   `admin`, `entreprise`. Activer le **nuage orange** (Proxied) sur chacun.
3. **Chez le registrar** : remplacer les serveurs de noms (NS) du domaine par
   les deux serveurs Cloudflare affichés. Propagation : quelques minutes à
   quelques heures. Rien à changer sur le VPS.
4. **SSL/TLS** → mode **Full (strict)** — Caddy garde ses certificats
   Let's Encrypt, Cloudflare chiffre jusqu'au VPS. Ne JAMAIS utiliser
   « Flexible » (casserait les redirections).
5. **Security** :
   - **Bots** → *Bot Fight Mode* : **ON** (bloque HTTrack, wget et les
     scrapers identifiés) ;
   - **Settings** → *Security Level* : Medium ; *Browser Integrity Check* :
     ON ;
   - **WAF → Rate limiting rules** (1 règle incluse en Free) : par exemple
     « toutes les URI, > 120 requêtes / 10 s par IP → Block 1 h » — le
     pendant edge de `caddy-flood`.
6. **Scrape Shield** : *Email Address Obfuscation* ON ; *Hotlink Protection*
   ON (les images de la vitrine ne seront plus affichables depuis un site
   tiers).
7. **Speed** → désactiver *Rocket Loader* (peut interférer avec les SPA).

### Points de vigilance après bascule

- **Webhooks CinetPay** : ils traversent Cloudflare normalement (simple POST
  HTTPS vers `api.declick.digital`). Vérifier un paiement de test après la
  bascule.
- **IP réelle des clients** : derrière Cloudflare, Caddy voit les IP de
  Cloudflare. Conséquences :
  - le rate-limit par IP de l'API compterait tout Cloudflare comme un seul
    client → ajouter les plages Cloudflare aux proxys de confiance de Caddy
    (`trusted_proxies`) pour restaurer l'IP réelle, ou s'appuyer sur le
    rate-limiting Cloudflare ;
  - **désactiver les jails `caddy-abuse` et `caddy-flood`** (`enabled = false`)
    sous peine de bannir les IP de Cloudflare — leur rôle est repris par la
    règle de rate-limiting Cloudflare. `sshd` reste actif (SSH ne passe pas
    par Cloudflare).
- **Renouvellement Let's Encrypt** : le défi HTTP de Caddy traverse le proxy
  Cloudflare. Si un renouvellement échouait (visible dans
  `docker compose logs caddy`), passer temporairement l'enregistrement
  concerné en nuage gris, laisser Caddy renouveler, puis repasser en orange.

### Ordre recommandé

fail2ban d'abord (protège dès maintenant), Cloudflare quand vous êtes prêt à
toucher aux DNS — puis basculer la responsabilité du filtrage de volume vers
Cloudflare comme décrit ci-dessus.

## 4. Ce qui reste hors de portée technique

Un abonné **payant** peut enregistrer son écran ou télécharger ce à quoi il a
droit — aucune technique ne l'empêche. Les réponses sont la traçabilité
(filigrane par utilisateur, envisageable plus tard), les CGU (reproduction
interdite — déjà en place) et l'action sur signalement (droit d'auteur,
RCCM à l'appui).
