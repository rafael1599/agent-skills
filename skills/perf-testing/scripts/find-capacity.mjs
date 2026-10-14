#!/usr/bin/env node
// Orchestrates the progressive load staircase, detects the degradation point,
// then refines around it with a tighter step to pin down sustainable capacity.
// No npm dependencies — Node built-ins only.
//
// Usage:
//   node find-capacity.mjs --config tests/perf/perf.config.json --out tests/perf/read-heavy \
//     [--profile read-heavy] [--stage-duration 30s] \
//     [--stages 10,50,100,250,500,1000,1500,2000,2500] [--refine-step 100]
//
// Writes one run directory per stage under <out>/<timestamp>/stage-<vu>/ containing
// summary.json (raw k6 output) and reads it back to decide pass/fail vs the SLO in
// perf.config.json's `slo` block. Prints a final capacity report to stdout and writes
// it to <out>/<timestamp>/result.md.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RUN_K6 = path.join(SKILL_DIR, 'scripts', 'run-k6.sh');
const SCENARIO = path.join(SKILL_DIR, 'k6-scenarios', 'scenario.js');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const configPath = arg('config');
if (!configPath || !fs.existsSync(configPath)) {
  console.error('Missing or not found: --config <perf.config.json>. See templates/perf.config.example.json.');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const outBase = arg('out', 'tests/perf/run');
const profile = arg('profile', config.defaultWorkload || 'balanced');
const stageDuration = arg('stage-duration', '30s');
const stagesArg = arg('stages', '10,50,100,250,500,1000,1500,2000,2500');
const refineStep = Number(arg('refine-step', 100));

const vuList = stagesArg.split(',').map(Number);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(outBase, timestamp);
fs.mkdirSync(runDir, { recursive: true });

const slo = config.slo || { p95_ms: 500, p99_ms: 1000, error_rate: 0.01 };
const isAssumedSlo = !config.slo;

function runStage(vus) {
  const stageDir = path.join(runDir, `stage-${vus}vu`);
  fs.mkdirSync(stageDir, { recursive: true });
  const stages = JSON.stringify([{ duration: stageDuration, target: vus }]);
  const endpoints = JSON.stringify(config.endpoints);
  const headers = JSON.stringify(config.headers || {});
  const hotspotIds = config.hotspotIds ? JSON.stringify(config.hotspotIds) : null;

  const envArgs = [
    '-e', `BASE_URL=${config.baseUrl}`,
    '-e', `STAGES=${stages}`,
    '-e', `ENDPOINTS=${endpoints}`,
    '-e', `HEADERS=${headers}`,
    '-e', `WORKLOAD=${profile}`,
    '-e', `THRESH_P95=${slo.p95_ms}`,
    '-e', `THRESH_P99=${slo.p99_ms}`,
    '-e', `THRESH_ERROR_RATE=${slo.error_rate}`,
  ];
  if (hotspotIds) envArgs.push('-e', `HOTSPOT_IDS=${hotspotIds}`);

  console.log(`\n--- Running stage: ${vus} VU (${stageDuration}) ---`);
  try {
    execFileSync(RUN_K6, [SCENARIO, stageDir, ...envArgs], { stdio: 'inherit' });
  } catch (e) {
    // k6 exits non-zero when thresholds fail — that's an expected signal, not a crash.
  }

  const summaryPath = path.join(stageDir, 'summary.json');
  if (!fs.existsSync(summaryPath)) {
    console.error(`No summary.json produced for stage ${vus}VU — treating as failure (check stdout.log in ${stageDir}).`);
    return { vus, p95: null, p99: null, errorRate: null, pass: false, dir: stageDir };
  }
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  // k6 --summary-export puts stats directly on the metric object (no nested
  // `.values`), and a Rate metric's fraction is `.value`, not `.values.rate`.
  const dur = summary.metrics?.http_req_duration || {};
  const errRate = summary.metrics?.perf_errors?.value ?? null;
  const rateLimitedFrac = summary.metrics?.perf_rate_limited?.value ?? null;
  const p95 = dur['p(95)'] ?? null;
  const p99 = dur['p(99)'] ?? null;
  const pass = p95 !== null && p99 !== null && errRate !== null &&
    p95 < slo.p95_ms && p99 < slo.p99_ms && errRate < slo.error_rate;

  if (rateLimitedFrac !== null && rateLimitedFrac > 0.5) {
    console.warn(
      `⚠️  Stage ${vus}VU: ${(rateLimitedFrac * 100).toFixed(0)}% of requests got 429. This is very likely ` +
      `the target's anti-abuse rate limiter tripping because k6 sends all VUs from one source IP/key, ` +
      `NOT a real capacity ceiling. See SKILL.md 'rate limiting' taxonomy entry before reporting this as a breaking point.`
    );
  }

  return { vus, p95, p99, errorRate: errRate, rateLimited: rateLimitedFrac, pass, dir: stageDir };
}

const results = [];
let degradationAt = null;

for (const vus of vuList) {
  const r = runStage(vus);
  results.push(r);
  console.log(`Stage ${vus}VU: p95=${r.p95?.toFixed?.(1) ?? 'N/A'}ms p99=${r.p99?.toFixed?.(1) ?? 'N/A'}ms err=${r.errorRate ?? 'N/A'} pass=${r.pass}`);
  if (!r.pass) {
    degradationAt = { prev: results[results.length - 2]?.vus ?? 0, at: vus };
    break;
  }
}

// Refine around the degradation window with a tighter step.
if (degradationAt) {
  console.log(`\n--- Degradation detected between ${degradationAt.prev} and ${degradationAt.at} VU. Refining with step ${refineStep} ---`);
  for (let vus = degradationAt.prev + refineStep; vus < degradationAt.at; vus += refineStep) {
    const r = runStage(vus);
    results.push(r);
    console.log(`Refine ${vus}VU: p95=${r.p95?.toFixed?.(1) ?? 'N/A'}ms p99=${r.p99?.toFixed?.(1) ?? 'N/A'}ms err=${r.errorRate ?? 'N/A'} pass=${r.pass}`);
  }
}

const passing = results.filter((r) => r.pass).sort((a, b) => b.vus - a.vus);
const failing = results.filter((r) => !r.pass).sort((a, b) => a.vus - b.vus);
const sustainable = passing[0]?.vus ?? 0;
const breaking = failing[0]?.vus ?? null;

const reportLines = [
  `# Capacity report — ${profile} — ${timestamp}`,
  '',
  `SLO used: p95<${slo.p95_ms}ms, p99<${slo.p99_ms}ms, error_rate<${slo.error_rate}` +
    (isAssumedSlo ? '  **(ASSUMED — not confirmed by project owner)**' : ''),
  '',
  '| VUs | P95 (ms) | P99 (ms) | Error rate | 429 rate | Pass |',
  '|---|---|---|---|---|---|',
  ...results.sort((a, b) => a.vus - b.vus).map((r) =>
    `| ${r.vus} | ${r.p95?.toFixed?.(1) ?? 'N/A'} | ${r.p99?.toFixed?.(1) ?? 'N/A'} | ${r.errorRate ?? 'N/A'} | ${r.rateLimited ?? 'N/A'}${r.rateLimited > 0.5 ? ' ⚠️' : ''} | ${r.pass ? 'PASS' : 'FAIL'} |`
  ),
  '',
  results.some((r) => r.rateLimited > 0.5)
    ? '⚠️ **One or more stages hit a 429 flood (see 429 rate column).** This is very likely the target\'s ' +
      'per-IP/per-key anti-abuse rate limiter tripping because k6 sends all VUs from one source, not a real ' +
      'resource ceiling. Treat any "breaking point" at or above that VU count as unverified until the test ' +
      'is re-run with the rate limiter raised/exempted for the test source, or with multiple simulated source keys.'
    : null,
  results.some((r) => r.rateLimited > 0.5) ? '' : null,
  `**Sustainable capacity**: ~${sustainable} VU (highest passing stage measured).`,
  breaking ? `**Breaking/degradation point**: ~${breaking} VU.` : '**Breaking point**: not reached within tested range — consider testing higher stages.',
  '',
  '_Recovery behavior after load stops was not measured by this script — check host/DB metrics for the post-test window separately if a leak or stuck-degraded state is suspected._',
];

fs.writeFileSync(path.join(runDir, 'result.md'), reportLines.join('\n'));
fs.writeFileSync(path.join(runDir, 'config.json'), JSON.stringify({ config, profile, stageDuration, vuList, slo, isAssumedSlo, timestamp }, null, 2));

console.log('\n' + reportLines.join('\n'));
console.log(`\nFull run artifacts: ${runDir}`);
