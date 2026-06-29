# Publier l'app mobile (iOS + Android) — runbook

> L'app native est un **emballage Capacitor autour du même build PWA** (`web/dist`).
> Zéro divergence de code : on construit le front une fois, on le synchronise dans
> les projets natifs, puis on signe et on publie. La PWA reste le canal principal ;
> l'app store n'est utile que si un client l'exige.

Ce qui est **déjà fait** (dans le dépôt) :
- `capacitor.config.ts` (appId `digital.declick.app`, nom = `VITE_BRAND_NAME`, `webDir → ../web/dist`, splash).
- Projet **Android** scaffoldé. Pont natif (bouton retour, liens profonds, barre de statut) câblé dans le front (`web/src/lib/native.ts`) — actif uniquement dans l'app, sans impact sur la PWA.
- Modèles de liens profonds : `web/public/.well-known/apple-app-site-association` et `assetlinks.json`.

Ce qui **doit se faire sur votre machine** (impossible côté serveur) : la construction
signée et la soumission aux stores. Détail ci-dessous.

---

## 0. Prérequis
| Plateforme | Outils | Compte |
|---|---|---|
| **Android** | Android Studio + JDK 17 | Google Play Console (frais **unique ~25 $**) |
| **iOS** | **un Mac** + Xcode 15+ | Apple Developer Program (**~99 $/an**) |

```bash
cd mobile && npm install            # installe la CLI Capacitor + plugins
npx cap doctor                      # vérifie l'environnement
```

## 1. Construire le front (avec l'URL d'API de prod)
```bash
# depuis la racine du repo
VITE_API_URL=https://api.declick.digital/api/v1 npm -w web run build
```
> Marque blanche : ajoutez `VITE_BRAND_NAME="…"` pour renommer l'app (et `CAP_APP_ID="com.client.app"` pour un bundle id revendeur **avant la 1ʳᵉ publication** — il est définitif).

## 2. Synchroniser Capacitor
```bash
cd mobile
npx cap sync android          # copie web/dist + plugins dans Android
# iOS (sur Mac uniquement) :
npx cap add ios               # une seule fois (crée le projet Xcode)
npx cap sync ios
```

## 3. Icônes & écran de démarrage (optionnel mais recommandé)
Placez un logo 1024×1024 dans `mobile/resources/icon.png` (+ `splash.png` 2732×2732), puis :
```bash
npx @capacitor/assets generate --assetPath resources
```

## 4. Android — build signé → Play Store
```bash
npx cap open android          # ouvre Android Studio
```
1. **Créer un keystore** (une fois) : Build → Generate Signed Bundle/APK → *Android App Bundle* → créez la clé (conservez-la précieusement, elle est définitive).
2. Récupérez l'empreinte **SHA‑256** de la clé de signature (Play Console → Configuration → Intégrité de l'app → *App signing*), et reportez‑la dans `web/public/.well-known/assetlinks.json` (puis rebuild + redéploiement web).
3. Générez l'**AAB** signé → uploadez sur **Play Console** → remplissez la fiche (captures, description, politique de confidentialité) → déploiement en test interne puis production.

## 5. iOS — archive → App Store (sur Mac)
```bash
npx cap open ios              # ouvre Xcode
```
1. Cible *App* → **Signing & Capabilities** : sélectionnez votre **Team** (signing automatique).
2. Ajoutez la capacité **Associated Domains** : `applinks:app.declick.digital`.
3. **Product → Archive** → **Distribute App** → App Store Connect.
4. Sur **App Store Connect** : créez l'app (bundle id `digital.declick.app`), remplissez la fiche, soumettez pour revue.

## 6. Liens profonds (universal / app links)
Les fichiers d'association sont servis par Caddy depuis `web/dist` :
- iOS : `https://app.declick.digital/.well-known/apple-app-site-association`
- Android : `https://app.declick.digital/.well-known/assetlinks.json`

À faire :
1. Remplacez `TEAMID` (apple-app-site-association) par votre **Apple Team ID**, et le SHA‑256 (assetlinks.json) par l'empreinte de signature Android.
2. Rebuild + redéployez le front (les fichiers passent dans `web/dist`).
3. **Caddy** : servez le fichier Apple en `application/json` (sans extension). Ajoutez dans `deploy/Caddyfile`, bloc `app.declick.digital` :
   ```
   @aasa path /.well-known/apple-app-site-association
   header @aasa Content-Type application/json
   ```
4. Vérifiez : `curl -I https://app.declick.digital/.well-known/assetlinks.json` (200, JSON).

## 7. Notifications push
Le pont natif est prêt à enregistrer un token, mais l'envoi réel (FCM/APNs)
demande un projet Firebase + clés APNs **et** un module backend de stockage des
tokens. C'est la **brique 2 de P4** (à faire ensuite) — voir l'équipe pour lancer.

## 8. Test de parité hors-ligne
L'app embarque le **même service worker** que la PWA : le hors-ligne, la reprise
vidéo et la synchro fonctionnent à l'identique. Testez en mode avion après un
premier chargement en ligne.

---

### À chaque mise à jour du front
```bash
VITE_API_URL=https://api.declick.digital/api/v1 npm -w web run build
cd mobile && npx cap sync
# puis re-archiver/re-uploader depuis Android Studio / Xcode (bump du versionCode/build)
```
