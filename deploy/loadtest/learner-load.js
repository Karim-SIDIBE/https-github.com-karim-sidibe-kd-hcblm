// k6 load test — KD-HCBLM API (Vague B, "crédibilité entreprise").
//
// Baseline (no secrets): exercises the public health + readiness endpoints under
// a staged ramp so you can characterise latency/throughput and prove the stack
// holds the target concurrency on the 2 vCPU / 4 Go VPS.
//
// Authenticated flow (optional): if BEARER is provided, it also drives a realistic
// learner path (catalog → course read). Seed a test user and pass its access token.
//
// Run:
//   k6 run -e BASE=https://api.declick.digital/api/v1 deploy/loadtest/learner-load.js
//   k6 run -e BASE=... -e BEARER=<access_token> -e PEAK=1000 deploy/loadtest/learner-load.js
//
// Tune the peak with -e PEAK=<vus> (default 300; raise to 1000/3000 to stress).
import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate } from "k6/metrics";

const BASE = __ENV.BASE || "http://localhost:4000/api/v1";
const BEARER = __ENV.BEARER || "";
const PEAK = parseInt(__ENV.PEAK || "300", 10);

const errors = new Rate("app_errors");

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: Math.ceil(PEAK * 0.3) },  // warm up
        { duration: "3m", target: PEAK },                    // sustained peak
        { duration: "1m", target: 0 },                       // ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // Enterprise-credibility targets — fail the run if breached.
    http_req_failed: ["rate<0.01"],                 // < 1% transport errors
    http_req_duration: ["p(95)<500", "p(99)<1500"], // p95 < 500ms, p99 < 1.5s
    app_errors: ["rate<0.01"],
  },
};

export default function () {
  group("health", () => {
    const r = http.get(`${BASE}/health`);
    check(r, { "health 200": (res) => res.status === 200 }) || errors.add(1);
  });

  group("readiness", () => {
    const r = http.get(`${BASE}/health/ready`);
    check(r, { "ready 200": (res) => res.status === 200 }) || errors.add(1);
  });

  if (BEARER) {
    const headers = { Authorization: `Bearer ${BEARER}` };
    group("catalog", () => {
      const r = http.get(`${BASE}/catalog`, { headers });
      check(r, { "catalog 200": (res) => res.status === 200 }) || errors.add(1);
      // Follow into the first course, if any (realistic resume path).
      try {
        const data = r.json("data");
        if (Array.isArray(data) && data.length) {
          const id = data[0].id;
          const c = http.get(`${BASE}/courses/${id}`, { headers });
          check(c, { "course 200": (res) => res.status === 200 }) || errors.add(1);
        }
      } catch (_e) { /* non-JSON / empty */ }
    });
  }

  sleep(Math.random() * 2 + 1); // 1–3s think time per virtual learner
}
