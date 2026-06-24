import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// White-label branding (per-deployment). Defaults target the DECLICK DIGITAL
// deployment; SaaS clients override VITE_BRAND_* at build time. See web/.env.example.
const BRAND_NAME = process.env.VITE_BRAND_NAME?.trim() || "DECLICK DIGITAL";
const BRAND_SHORT = process.env.VITE_BRAND_SHORT?.trim() || BRAND_NAME.split(/\s+/)[0] || "DECLICK";
const BRAND_THEME = process.env.VITE_BRAND_THEME?.trim() || "#F36F21";
const BRAND_DESC = process.env.VITE_BRAND_DESC?.trim()
  || "Apprentissage de compétences professionnelles en environnements africains — disponible hors-ligne.";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: BRAND_NAME,
        short_name: BRAND_SHORT,
        description: BRAND_DESC,
        lang: "fr",
        theme_color: BRAND_THEME,
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            // Media (video/captions). NetworkFirst so ONLINE playback always
            // streams from the API (range/seek honoured server-side, never blocked
            // by a stale/partial cache entry), while OFFLINE falls back to whatever
            // the per-element "Rendre disponible hors ligne" action cached.
            // CacheFirst here was a trap: a single opaque/partial response would
            // poison playback indefinitely (the SW never re-hit the network).
            // Only full/range 200/206 are cacheable — never opaque (0).
            urlPattern: ({ request, url }) =>
              request.destination === "video" || request.destination === "track" || /\/media\//.test(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: "klms-media",
              rangeRequests: true,
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [200, 206] },
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // Cache GETs to the API (bundle, etc.) for offline resilience.
            urlPattern: ({ url }) => url.pathname.includes("/api/v1/"),
            handler: "NetworkFirst",
            options: { cacheName: "klms-api", networkTimeoutSeconds: 5, expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
