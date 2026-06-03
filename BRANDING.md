# Branding & white-label model

This platform is built once and branded per deployment. Understanding the four
names keeps the configuration straight.

| Name | What it is | Where it lives |
|---|---|---|
| **K-LMS** | The **product** — the generic learning platform (K = Kompetences), sellable to other clients as SaaS. | This codebase. Never shown to learners. |
| **KOMPETENCES AFRICA** | The parent **organisation**. The certifying entity for the in-house deployment. | `VITE_BRAND_ISSUER` / `CREDENTIAL_ISSUER_NAME` |
| **KOMPETENCES DECLICK** | The **department** that operates the in-house instance. Shown as attribution. | `VITE_BRAND_OPERATOR` |
| **DECLICK DIGITAL** | The **public name of the in-house instance** (the app's name). | `VITE_BRAND_NAME` |

So in the reference deployment: **DECLICK DIGITAL** is the platform, *operated by
KOMPETENCES DECLICK* (a department of **KOMPETENCES AFRICA**, which issues the
certificates). The KOMPETENCES DECLICK logo appears in the header purely to show
who operates the platform.

## Two configurations, one codebase

There is **no branch or fork** per client — only configuration. Two reference
presets live in [`deploy/presets/`](./deploy/presets/):

- **[`declick-digital.env.example`](./deploy/presets/declick-digital.env.example)**
  — the in-house KOMPETENCES AFRICA build. This is the canonical deployment.
- **[`saas-client.env.example`](./deploy/presets/saas-client.env.example)**
  — the white-label template (the DECLICK DIGITAL preset with the brand
  parameterised) for reselling K-LMS in SaaS mode.

With **no** env set, the app defaults to the DECLICK DIGITAL brand, so the
in-house build "just works".

## What's configurable (and what changes when you set it)

| Variable | Default | Effect |
|---|---|---|
| `VITE_BRAND_NAME` | `DECLICK DIGITAL` | App name: PWA manifest + tab title + in-app header + native store name |
| `VITE_BRAND_SHORT` | `Declick` | PWA home-screen icon label |
| `VITE_BRAND_OPERATOR` | `KOMPETENCES DECLICK` | "Opéré par …" attribution under the name |
| `VITE_BRAND_ISSUER` | `KOMPETENCES AFRICA` | Certificate / Open-Badge issuer shown to learners |
| `VITE_BRAND_THEME` | `#F36F21` | PWA theme + native status-bar colour |
| `VITE_API_URL` | `http://localhost:4000/api/v1` | Backend endpoint (absolute for native) |
| `CAP_APP_ID` | `digital.declick.app` | Native bundle identifier (permanent once published) |
| `CREDENTIAL_ISSUER_NAME` (server) | `KOMPETENCES AFRICA` | Issuer baked into issued Open Badges |

The brand name renders as a two-tone wordmark: the first word plain, the rest in
the brand-accent colour (e.g. **DECLICK** *DIGITAL*) — works for any client name.

Per-deployment assets (logo, app icon) are swapped, not coded: replace
`web/public/logo-icon.png` and regenerate native icons (`npm -w @kd/mobile run assets`).

## Onboard a new SaaS client

```bash
cp deploy/presets/saas-client.env.example deploy/presets/acme.env   # git-ignored
# fill in every <…> placeholder for the client

# Web (PWA)
set -a; . deploy/presets/acme.env; set +a
npm -w web run build            # web/dist now carries the client's brand

# Server: deploy with the .env section (CREDENTIAL_ISSUER_*, CORS_ORIGINS, …)
# Native apps (optional): same env, then  npm -w @kd/mobile run sync
```

Swap `web/public/logo-icon.png` for the client logo and you have a fully branded
instance — from one codebase.
