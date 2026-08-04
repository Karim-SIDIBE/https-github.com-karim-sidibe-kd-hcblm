import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// DECLICK DIGITAL — enterprise self-service console. Same API as the rest
// (the client reads VITE_API_URL via import.meta.env at build time).

export default defineConfig({
  plugins: [react()],
  server: { port: 5175 },
});
