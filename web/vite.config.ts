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
        theme_color: "#1d4ed8",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        runtimeCaching: [
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
