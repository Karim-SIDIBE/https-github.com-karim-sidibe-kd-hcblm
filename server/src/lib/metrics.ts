/**
 * metrics.ts — dependency-free Prometheus metrics (text exposition v0.0.4).
 *
 * Kept deliberately light (project convention: no heavy deps): a small in-memory
 * registry of counters + gauges + duration summaries, rendered on demand at
 * `/metrics`. Enough for Prometheus/Grafana dashboards and alerting rules
 * (request rate, error rate, latency, dependency health) without a client lib.
 */

type Labels = Record<string, string>;

const counters = new Map<string, number>();
const gauges = new Map<string, number>();
const durSum = new Map<string, number>();
const durCount = new Map<string, number>();
let inFlight = 0;

/** Escape a label value per the Prometheus text format. */
function esc(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

/** Stable `name{k="v",...}` series key (labels sorted for determinism). */
function series(name: string, labels?: Labels): string {
  if (!labels || Object.keys(labels).length === 0) return name;
  const parts = Object.keys(labels).sort().map((k) => `${k}="${esc(labels[k]!)}"`);
  return `${name}{${parts.join(",")}}`;
}

export function incCounter(name: string, labels?: Labels, by = 1): void {
  const k = series(name, labels);
  counters.set(k, (counters.get(k) ?? 0) + by);
}

export function setGauge(name: string, value: number, labels?: Labels): void {
  gauges.set(series(name, labels), value);
}

/** Record a duration observation (a summary: exposes _sum and _count). */
export function observe(name: string, seconds: number, labels?: Labels): void {
  const k = series(name, labels);
  durSum.set(k, (durSum.get(k) ?? 0) + seconds);
  durCount.set(k, (durCount.get(k) ?? 0) + 1);
}

export function requestStarted(): void { inFlight++; }
export function requestEnded(): void { if (inFlight > 0) inFlight--; }

/** Record one completed HTTP request (bounded route label = the Fastify route). */
export function recordHttp(method: string, route: string, status: number, seconds: number): void {
  incCounter("http_requests_total", { method, route, status: String(status) });
  observe("http_request_duration_seconds", seconds, { method, route });
}

const BUILD_VERSION = process.env.npm_package_version ?? "0.0.0";

/** Reset the registry — test-only. */
export function _reset(): void {
  counters.clear(); gauges.clear(); durSum.clear(); durCount.clear(); inFlight = 0;
}

/** Render the full registry in Prometheus text exposition format. */
export function render(): string {
  const out: string[] = [];

  out.push("# HELP http_requests_total Total HTTP requests by method, route and status.");
  out.push("# TYPE http_requests_total counter");
  for (const [k, v] of counters) out.push(`${k} ${v}`);

  out.push("# HELP http_request_duration_seconds Request duration summary (sum/count) by method and route.");
  out.push("# TYPE http_request_duration_seconds summary");
  for (const [k, v] of durSum) out.push(`${withSuffix(k, "_sum")} ${v}`);
  for (const [k, v] of durCount) out.push(`${withSuffix(k, "_count")} ${v}`);

  out.push("# HELP http_requests_in_flight In-flight HTTP requests.");
  out.push("# TYPE http_requests_in_flight gauge");
  out.push(`http_requests_in_flight ${inFlight}`);

  const mem = process.memoryUsage();
  out.push("# HELP process_resident_memory_bytes Resident memory size in bytes.");
  out.push("# TYPE process_resident_memory_bytes gauge");
  out.push(`process_resident_memory_bytes ${mem.rss}`);
  out.push("# HELP nodejs_heap_used_bytes V8 heap used in bytes.");
  out.push("# TYPE nodejs_heap_used_bytes gauge");
  out.push(`nodejs_heap_used_bytes ${mem.heapUsed}`);
  out.push("# HELP process_uptime_seconds Process uptime in seconds.");
  out.push("# TYPE process_uptime_seconds gauge");
  out.push(`process_uptime_seconds ${Math.round(process.uptime())}`);

  out.push("# HELP kd_build_info Build metadata (always 1).");
  out.push("# TYPE kd_build_info gauge");
  out.push(`${series("kd_build_info", { version: BUILD_VERSION })} 1`);

  for (const [k, v] of gauges) out.push(`${k} ${v}`);

  return out.join("\n") + "\n";
}

/** Insert a suffix before the `{labels}` part of a series key. */
function withSuffix(key: string, suffix: string): string {
  const brace = key.indexOf("{");
  return brace === -1 ? key + suffix : key.slice(0, brace) + suffix + key.slice(brace);
}
