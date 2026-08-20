/**
 * prisma.config.ts — configuration du CLI Prisma 7 (qui ne lit plus ni le bloc
 * package.json#prisma ni .env automatiquement). Charge .env s'il existe (les
 * environnements CI/Docker passent DATABASE_URL directement).
 */
import { loadEnvFile } from "node:process";
import { defineConfig } from "prisma/config";

try { loadEnvFile(); } catch { /* pas de .env (CI, image Docker) */ }

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
