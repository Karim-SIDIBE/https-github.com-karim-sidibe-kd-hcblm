import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// DECLICK DIGITAL admin console. Talks to the same API as the learner PWA.
const API_URL = process.env.VITE_API_URL?.trim() || "http://localhost:4000/api/v1";

export default defineConfig({
  plugins: [react()],
  define: { __API_URL__: JSON.stringify(API_URL) },
  server: { port: 5174 },
  build: {
    rollupOptions: {
      output: {
        // React in its own chunk: it changes rarely, so returning visitors
        // keep it cached across app deployments.
        manualChunks: { react: ["react", "react-dom"] },
      },
    },
  },
});
