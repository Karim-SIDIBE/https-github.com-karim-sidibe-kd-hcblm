/** Singleton Prisma client (Prisma 7 : client TypeScript pur + adaptateur pg). */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { isDev } from "../config/env.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });

export const prisma = new PrismaClient({
  adapter,
  log: isDev ? ["warn", "error"] : ["error"],
});
