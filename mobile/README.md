# `@kd/mobile` — optional native (iOS / Android) wrappers

These [Capacitor](https://capacitorjs.com) wrappers ship the **exact same build
as the PWA** inside a native shell, for the App Store and Google Play.

> **They do not replace the PWA.** The Progressive Web App
> (`app.declick.digital`) remains the primary channel — installable, offline-first,
> instantly updatable, no store review. The native apps are a **reserve option**:
> stand them up only when a client requires a store listing (procurement rules,
> MDM distribution, store discoverability). Because they load `web/dist`, there is
> **no second codebase** to maintain.

## How it works

```
web/  ──build──▶  web/dist/  ──webDir──▶  Capacitor  ──▶  ios/  +  android/
 (one React/Vite PWA)        (one build)                  (thin native shells)
```

`capacitor.config.ts` sets `webDir: "../web/dist"`, so the native apps embed the
PWA's production assets. The app talks to the backend over HTTPS via the
build-time `VITE_API_URL` (see [`.env.example`](./.env.example)) — there is no
dev proxy on a device.

- **App ID**: `digital.declick.app` (env `CAP_APP_ID`) · **Name**: DECLICK DIGITAL
  (env `VITE_BRAND_NAME` — the same var that names the PWA). For a SaaS client
  build, set both to the client's brand. The App ID / bundle identifier is
  **permanent** once published, so finalise it before the first submission.
- The service worker degrades gracefully: it works on Android (`https://localhost`)
  and is a harmless no-op on iOS (WKWebView has no SW). Offline learning data
  lives in IndexedDB either way, so behaviour matches the PWA.

## Prerequisites

| Target  | Needs                                                                 |
|---------|-----------------------------------------------------------------------|
| Both    | Node 22, `npm install` at the repo root                               |
| Android | [Android Studio](https://developer.android.com/studio) + JDK 17 + SDK |
| iOS     | **macOS** + [Xcode](https://developer.apple.com/xcode/) + CocoaPods   |

> iOS can only be **built** on macOS. Android builds on macOS, Linux or Windows.
> This is a platform constraint of Apple's toolchain, not of this project.

## One-time setup

```bash
# from the repo root
npm install                       # installs Capacitor (this workspace included)

cd mobile
cp .env.example .env              # adjust VITE_API_URL / branding if needed

# 1. Build the PWA with the production API + branding from .env
set -a; . ./.env; set +a          # export VITE_API_URL, VITE_BRAND_*, CAP_APP_ID
npm run build:web

# 2. Add the native platforms (generates ./ios and ./android — git-ignored)
npm run add:android               # needs Android SDK
npm run add:ios                   # needs macOS + Xcode

# 3. Copy web assets + native config into the platforms
npm run sync
```

## App icon & splash screen

Drop a 1024×1024 `icon.png` (and optional `splash.png`) into `mobile/resources/`,
then generate every density:

```bash
npm run assets                    # @capacitor/assets → all icon/splash sizes
npm run sync
```

The source logo lives at `web/public/logo-icon.png`; export it to 1024×1024 on a
solid `#F36F21` (or transparent) background for the store icon.

## Day-to-day: ship a new version

Whenever the web app changes, rebuild and re-sync — **no native code edits**:

```bash
cd mobile
set -a; . ./.env; set +a
npm run build:web
npm run sync
npm run open:android      # → Android Studio: Build > Generate Signed Bundle (.aab)
npm run open:ios          # → Xcode: Product > Archive > Distribute (App Store)
```

`npm run run:android` / `npm run run:ios` launch on a connected device/emulator
for quick testing.

## Backend / CORS

The native origins are not `https://app.declick.digital`, so the API must allow
them. Add these to the server's `CORS_ORIGINS` (comma-separated — see
`deploy/.env.example`):

```
CORS_ORIGINS=https://app.declick.digital,capacitor://localhost,https://localhost,http://localhost
```

- iOS sends `Origin: capacitor://localhost`
- Android (with `androidScheme: https`) sends `Origin: https://localhost`

## Store submission checklist

- [ ] App ID / bundle identifier finalised in `capacitor.config.ts` (permanent).
- [ ] Production `VITE_API_URL` baked into the build, and CORS updated server-side.
- [ ] Icons & splash generated (`npm run assets`).
- [ ] Privacy policy URL ready (both stores require one).
- [ ] iOS: Apple Developer account, signing in Xcode, App Store Connect listing.
- [ ] Android: Play Console account, upload key / Play App Signing, `.aab` upload.
- [ ] Version bumped: `version` here + native `versionCode`/`CFBundleVersion`.

## Why the `ios/` and `android/` folders aren't committed

They are **generated** by `npx cap add` and are large + machine-specific.
Regenerate them from this config at any time. If your team later prefers to
commit them (e.g. to pin native tweaks), remove the entries from `.gitignore`.
