// Generic, parametrized k6 scenario. Configured entirely via env vars so one
// file covers every workload profile — no per-profile duplication.
//
// Required env:
//   BASE_URL   e.g. http://localhost:3000
//   STAGES     JSON array, e.g. [{"duration":"30s","target":10},{"duration":"1m","target":50}]
//   ENDPOINTS  JSON array of {method, path, weight, body?} — see
//              templates/perf.config.example.json for the shape.
// Optional env:
//   WORKLOAD          label only, echoed into tags for reporting (read-heavy|balanced|...)
//   THRESH_P95        ms, default 500
//   THRESH_P99        ms, default 1000
//   THRESH_ERROR_RATE fraction, default 0.01
//   HOTSPOT_IDS       JSON array of path-param values to bias toward (hotspot profile)
//   HEADERS           JSON object of extra headers (e.g. auth token for authenticated load)
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const STAGES = JSON.parse(__ENV.STAGES || '[{"duration":"30s","target":10}]');
const ENDPOINTS = JSON.parse(__ENV.ENDPOINTS || '[{"method":"GET","path":"/health","weight":1}]');
const HEADERS = JSON.parse(__ENV.HEADERS || '{}');
const HOTSPOT_IDS = __ENV.HOTSPOT_IDS ? JSON.parse(__ENV.HOTSPOT_IDS) : null;

const THRESH_P95 = Number(__ENV.THRESH_P95 || 500);
const THRESH_P99 = Number(__ENV.THRESH_P99 || 1000);
const THRESH_ERROR_RATE = Number(__ENV.THRESH_ERROR_RATE || 0.01);

const errorRate = new Rate('perf_errors');
const rateLimited = new Rate('perf_rate_limited');

export const options = {
  stages: STAGES,
  // k6's default summary only computes p(90)/p(95) — p(99) must be requested
  // explicitly or it's silently absent from --summary-export, not just unused.
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    http_req_duration: [`p(95)<${THRESH_P95}`, `p(99)<${THRESH_P99}`],
    perf_errors: [`rate<${THRESH_ERROR_RATE}`],
  },
};

function pickEndpoint() {
  const total = ENDPOINTS.reduce((s, e) => s + (e.weight || 1), 0);
  let r = Math.random() * total;
  for (const e of ENDPOINTS) {
    r -= (e.weight || 1);
    if (r <= 0) return e;
  }
  return ENDPOINTS[ENDPOINTS.length - 1];
}

function resolvePath(path) {
  if (!path.includes(':id')) return path;
  if (HOTSPOT_IDS && HOTSPOT_IDS.length > 0) {
    return path.replace(':id', HOTSPOT_IDS[Math.floor(Math.random() * HOTSPOT_IDS.length)]);
  }
  // uniform-ish fallback: random small int so it doesn't 404 against a fixture range
  return path.replace(':id', String(Math.floor(Math.random() * 1000) + 1));
}

export default function () {
  const endpoint = pickEndpoint();
  const url = `${BASE_URL}${resolvePath(endpoint.path)}`;
  const params = { headers: HEADERS, tags: { name: endpoint.path, workload: __ENV.WORKLOAD || 'unspecified' } };

  let res;
  if (endpoint.method === 'GET' || !endpoint.method) {
    res = http.get(url, params);
  } else {
    const body = endpoint.body ? JSON.stringify(endpoint.body) : '{}';
    params.headers = { ...params.headers, 'Content-Type': 'application/json' };
    res = http.request(endpoint.method, url, body, params);
  }

  const ok = check(res, {
    'status is not 5xx': (r) => r.status < 500,
    'status is not 429 (rate limited)': (r) => r.status !== 429,
    'status is not 0 (timeout/conn error)': (r) => r.status !== 0,
  });
  errorRate.add(!ok);
  // 429 tracked separately from generic errors: a flood of 429s from a
  // single-source load generator usually means the app's anti-abuse rate
  // limiter (per-IP/per-key) tripped, NOT that the app ran out of real
  // capacity. Conflating the two silently turns "we got rate-limited" into
  // a false "breaking point" — see SKILL.md's rate-limiting taxonomy entry.
  rateLimited.add(res.status === 429);

  sleep(Math.random() * 0.5 + 0.1);
}
