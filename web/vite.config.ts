import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Kompetences Declick",
        short_name: "Declick",
        description: "Apprentissage de la gestion du temps en environnements professionnels africains — disponible hors-ligne.",
        lang: "fr",
        theme_color: "#F36F21",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            // Downloaded media (video/captions): serve from cache first, with
            // range-request support so the <video> can seek offline. Populated
            // by the in-app "download session" action into the same cache.
            urlPattern: ({ request, url }) =>
              request.destination === "video" || request.destination === "track" || /\/media\//.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "klms-media",
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200, 206] },
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 60 },
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
