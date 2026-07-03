import { test } from "node:test";
import assert from "node:assert/strict";
import { _reset, incCounter, recordHttp, setGauge, observe, render } from "./metrics.js";

test("render emits Prometheus text format with counters and summaries", () => {
  _reset();
  recordHttp("GET", "/api/v1/health", 200, 0.012);
  recordHttp("GET", "/api/v1/health", 200, 0.008);
  recordHttp("POST", "/api/v1/auth/login", 401, 0.05);
  const out = render();

  // Counter type + aggregated series (two GET /health hits → 2).
  assert.match(out, /# TYPE http_requests_total counter/);
  assert.match(out, /http_requests_total\{method="GET",route="\/api\/v1\/health",status="200"\} 2/);
  assert.match(out, /http_requests_total\{method="POST",route="\/api\/v1\/auth\/login",status="401"\} 1/);

  // Duration summary exposes _sum and _count with sorted labels.
  assert.match(out, /http_request_duration_seconds_count\{method="GET",route="\/api\/v1\/health"\} 2/);
  assert.match(out, /http_request_duration_seconds_sum\{method="GET",route="\/api\/v1\/health"\} 0\.02/);

  // Process + build metrics always present.
  assert.match(out, /process_resident_memory_bytes \d+/);
  assert.match(out, /nodejs_heap_used_bytes \d+/);
  assert.match(out, /kd_build_info\{version="[^"]*"\} 1/);
  assert.match(out, /http_requests_in_flight 0/);
});

test("counters accumulate and gauges overwrite; labels are escaped", () => {
  _reset();
  incCounter("widget_total", { kind: 'a"b' }, 3);
  incCounter("widget_total", { kind: 'a"b' });
  setGauge("temperature", 20, { room: "lab" });
  setGauge("temperature", 25, { room: "lab" });
  observe("op_seconds", 1.5);
  observe("op_seconds", 0.5);
  const out = render();
  assert.match(out, /widget_total\{kind="a\\"b"\} 4/);   // 3 + 1, quote escaped
  assert.match(out, /temperature\{room="lab"\} 25/);      // overwritten
  assert.match(out, /op_seconds_sum 2/);
  assert.match(out, /op_seconds_count 2/);
});
