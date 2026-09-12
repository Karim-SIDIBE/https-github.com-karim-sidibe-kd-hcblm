import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// KOMPETENCES FACE2FACE — front dédié du département présentiel. Même API que
// le reste de la plateforme (le client lit VITE_API_URL au moment du build).

export default defineConfig({
  plugins: [react()],
  server: { port: 5176 },
});
