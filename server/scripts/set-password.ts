/**
 * set-password.ts — set/reset a user's password (admin maintenance).
 *
 * Usage (on the VPS):
 *   docker compose -f deploy/docker-compose.yml --env-file deploy/.env \
 *     exec api npx tsx scripts/set-password.ts <email>
 *
 * The new password is typed at an interactive prompt (read from stdin) — it is
 * never passed on the command line, so it does NOT leak into shell history or
 * the process list. It is briefly visible on your own screen as you type.
 */
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password.js";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage : npx tsx scripts/set-password.ts <email>");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

  try {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (!exists) {
      console.error(`Utilisateur introuvable : ${email}`);
      process.exitCode = 1;
      return;
    }

    const pwd = await ask(`Nouveau mot de passe pour ${email} : `);
    const confirm = await ask("Confirmez le mot de passe          : ");

    if (pwd !== confirm) {
      console.error("✗ Les deux saisies ne correspondent pas. Aucun changement.");
      process.exitCode = 1;
      return;
    }
    if (pwd.length < 10) {
      console.error("✗ Mot de passe trop court (minimum 10 caractères). Aucun changement.");
      process.exitCode = 1;
      return;
    }

    await prisma.user.update({ where: { email }, data: { passwordHash: await hashPassword(pwd) } });
    console.log(`✓ Mot de passe mis à jour pour ${email}`);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main();
