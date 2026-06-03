import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration — OPTIONAL native (iOS/Android) shells around the
 * Kompetences Declick PWA. These wrappers do NOT replace the PWA: the web app
 * remains the primary channel. They exist only to ship the *same* build to the
 * App Store / Play Store when a client requires a store presence.
 *
 * Zero code divergence: `webDir` points at the PWA's production build
 * (`../web/dist`). Build the web app with the production API URL first
 * (see ../mobile/README.md and .env.example), then `npx cap sync`.
 */
const config: CapacitorConfig = {
  appId: "digital.declick.app",
  appName: "Kompetences Declick",
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
