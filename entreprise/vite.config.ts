import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// DECLICK DIGITAL — enterprise self-service console. Same API as the rest.
const API_URL = process.env.VITE_API_URL?.trim() || "http://localhost:4000/api/v1";

export default defineConfig({
  plugins: [react()],
  define: { __API_URL__: JSON.stringify(API_URL) },
  server: { port: 5175 },
});
