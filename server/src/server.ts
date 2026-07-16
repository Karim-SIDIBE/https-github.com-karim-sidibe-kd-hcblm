/** Process entry point. */
import cluster from "node:cluster";
import { availableParallelism } from "node:os";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { startJobsScheduler } from "./lib/jobs-scheduler.js";

async function main() {
  const app = await buildApp();

  // Exactly one scheduler per container: in single-process mode it lives with
  // the HTTP server (this process IS the primary); in multi-worker mode the
  // workers skip it — the cluster primary runs it instead (see below).
  const stopJobs = cluster.isPrimary
    ? startJobsScheduler({ info: (m) => app.log.info(m), error: (m) => app.log.error(m) })
    : () => {};

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} reçu — arrêt en cours`);
    stopJobs();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Optional multi-worker mode: fork API_WORKERS processes that share the listening
// socket (Node cluster) to use the vCPUs. Default (1) runs a single process,
// unchanged. Needs REDIS_URL for coherent rate-limit / SAML state across workers.
const workers = Math.min(env.API_WORKERS, availableParallelism());
if (workers > 1 && cluster.isPrimary) {
  let shuttingDown = false;
  for (let i = 0; i < workers; i++) cluster.fork();
  // The otherwise-idle primary hosts the job scheduler (queues + daily jobs) —
  // one instance per container, no duplicate sends across workers.
  startJobsScheduler();
  cluster.on("exit", (worker, code, signal) => {
    if (shuttingDown) return;
    console.error(`worker ${worker.process.pid} arrêté (${signal || code}) — relance`);
    cluster.fork();
  });
  const stop = (sig: NodeJS.Signals) => {
    shuttingDown = true;
    for (const w of Object.values(cluster.workers ?? {})) w?.kill(sig);
    process.exit(0);
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
} else {
  void main();
}
