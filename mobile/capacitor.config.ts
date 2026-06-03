import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration — OPTIONAL native (iOS/Android) shells around the
 * Declick Digital PWA. These wrappers do NOT replace the PWA: the web app
 * remains the primary channel. They exist only to ship the *same* build to the
 * App Store / Play Store when a client requires a store presence.
 *
 * Zero code divergence: `webDir` points at the PWA's production build
 * (`../web/dist`). Build the web app with the production API URL first
 * (see ../mobile/README.md and .env.example), then `npx cap sync`.
 *
 * White-label: the store name follows VITE_BRAND_NAME (the same var that names
 * the PWA), so a SaaS client build is renamed by config alone. The app ID /
 * bundle identifier is per-client and permanent once published — override it
 * with CAP_APP_ID for a reseller build.
 */
const BRAND_NAME = process.env.VITE_BRAND_NAME?.trim() || "Declick Digital";
const APP_ID = process.env.CAP_APP_ID?.trim() || "digital.declick.app";

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: BRAND_NAME,
  // Reuse the exact PWA build output — single source of truth.
  webDir: "../web/dist",
  server: {
    // Serve Android from https://localhost so the app runs in a secure context
    // (service worker, crypto, etc. behave as on the web). iOS uses
    // capacitor://localhost by default, also a secure context.
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#F36F21",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;
