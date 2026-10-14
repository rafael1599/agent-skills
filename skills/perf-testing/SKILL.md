---
name: perf-testing
description: Performance testing & optimization pipeline — measure first, optimize the smallest layer that the evidence points to, re-test, escalate architecture only when proven necessary. Use when the user asks to analyze/profile/benchmark performance, run load tests, find bottlenecks, decide on caching/Redis/scaling, or "optimize" anything under load. Triggers — "performance", "load test", "bottleneck", "P95/P99", "SLO", "capacity", "stress test", "soak test", "does this need Redis", "why is this slow under load", "benchmark this endpoint".
---

# Performance Testing & Optimization

Reusable across any project. Philosophy, non-negotiable:

> **Measure → Identify bottleneck → Optimize the smallest necessary layer → Re-test → Compare → Escalate architecture only when evidence requires it.**

Never recommend Redis, microservices, Kubernetes, read replicas, CDN, or any new
infrastructure as a *default*. Infrastructure grows only when a measurement proves the
current layer is the ceiling. If the system already meets its SLO: **STOP**. Don't keep
optimizing a system that already works.

## Two modes — pick one explicitly at the start

- **ANALYZE** (default when unsure): inspect code/config, run safe load tests, measure,
  diagnose, propose changes. **Never modifies code, config, schema, or infra.**
- **OPTIMIZE**: everything ANALYZE does, plus applies the smallest effective change
  (code/query/index/cache/config), then re-tests and records before/after evidence.
  Requires the user to have asked for changes to be applied (or to confirm when you
  offer it after an ANALYZE pass) — don't silently upgrade ANALYZE into OPTIMIZE.

State which mode you're in at the start of the response.

## Safety gate — read this before running anything

1. **Detect the target.** If `BASE_URL`/host resolves to a production domain, a DO/AWS/GCP
   prod app URL, or anything that isn't `localhost`/a local docker-compose service/an
   explicitly-labeled staging environment: **stop and say so**. Do not run stress/spike/soak
   tests against it without the user explicitly confirming in this conversation that they
   want a load test against production, right now. Read-only diagnostics (Grafana/Loki
   queries, `EXPLAIN` without `ANALYZE` on a copy, reading `pg_stat_statements`) are fine
   without that confirmation — only *generating load* needs it.
2. Never run destructive tests (data-mutating write storms, DB `DROP`/`TRUNCATE`-adjacent
   scenarios) anywhere without explicit confirmation, prod or not.
3. This session may be running headless/mobile (Cowork) — if a project's own CLAUDE.md
   forbids interactive prompts (`AskUserQuestion`, popups) for agents on that repo, respect
   it: pick the safer default (don't run against prod, don't apply the change) and report
   the question in the transcript instead of blocking on a popup.

## The pipeline

```
BASELINE → DEFINE SLO → LOAD TEST → OBSERVE SYSTEM → IDENTIFY BOTTLENECK →
CLASSIFY BOTTLENECK → APPLY SMALLEST EFFECTIVE OPTIMIZATION → RETEST → COMPARE →
DECIDE WHETHER TO ESCALATE → FINAL REPORT
```

### 1. Baseline
Run the lightest load stage (e.g. 10 VU) against the current code, unmodified. Record
client-side and server-side metrics (see Metrics catalog). This is LEVEL 0 on the ladder —
never skip it, it's the only thing every later comparison is measured against.

### 2. Define SLO
Look for existing SLOs in the project (docs, alerting config, `mcp__grafana__alerting_manage_rules`).
If none exist:
1. Say explicitly: "No SLO found for this project."
2. Propose starting values using `templates/slo.example.json` as a base, adapted to what
   the endpoint actually does (an internal admin CRUD endpoint and a customer-facing quote
   endpoint don't deserve the same P95).
3. Label them clearly as **assumed, not real requirements**: `ASSUMED SLO (not confirmed by project owner)`.
4. Never treat average/mean latency as the headline metric. P95, P99, error rate, and
   sustainable RPS lead; average is at most a footnote.

### 3. Load test — progressive, not single-shot
Use `scripts/find-capacity.mjs` (wraps `scripts/run-k6.sh`, which runs k6 via
`docker run grafana/k6` — no new package installs). Default staircase:
`10, 50, 100, 250, 500, 1000, 1500, 2000, 2500...` VUs, each stage a few minutes, ramping.

Don't just stop at the first failing stage. The script must characterize:
- **sustainable capacity** — highest VU stage that still meets the SLO (or assumed SLO)
- **degradation point** — where P95/P99/error rate starts trending badly but hasn't broken the SLO yet
- **breaking point** — where error rate/timeouts spike or the service stops responding
- **recovery behavior** — after the load stage ends, does latency/error rate return to
  baseline within a reasonable window, or does the system stay degraded (leak, saturated
  pool, retry storm)?

Once a stage shows degradation, refine around it with a tighter step (e.g. degradation
seen between 2500→3000 → retest at 2600, 2700, 2800, 2900) instead of reporting a coarse
range. `find-capacity.mjs` does this refinement automatically — see its `--help`.

**Before trusting a "degradation" or "breaking point" reading, check whether it's actually
a 429 flood.** k6 sends every VU from one machine, so a per-IP/per-key rate limiter on the
target can look exactly like a capacity ceiling while the app itself is idle. Check the
`429 rate` column `find-capacity.mjs` prints — if it's high while server-side CPU/DB/Redis
are calm, that's the rate limiter, not the app. See the taxonomy's "Rate limiting" row.

Pick a **workload profile** per `templates/perf.config.example.json` (read-heavy /
balanced / write-heavy / hotspot / uniform / spike / soak) that matches what you're
actually testing. A result from one profile does not generalize to the others — say so
explicitly if only one profile was run.

### 4. Observe the system
While the load test runs, capture (see `scripts/capture-host-metrics.sh` and
`scripts/capture-pg-metrics.sh`, and read Node's own `/health` or `/metrics` if the
project exposes event-loop-lag/heap — many won't; mark `N/A` and say what
instrumentation would be needed rather than inventing a number):
- Host/process: CPU, RAM, swap, load average, disk I/O, network, process count
- Node.js: event loop latency, heap usage, GC, memory growth trend across the run
  (leak signal = memory that doesn't come back down after load stops)
- Postgres: CPU, memory, active connections vs pool size, query latency, slow query log,
  locks, I/O, `pg_stat_statements` if the extension is enabled, `EXPLAIN ANALYZE` on the
  suspect query
- Cache (if one exists): hit ratio, miss ratio, eviction rate, memory usage, latency,
  staleness, invalidation behavior

If a metric truly isn't obtainable from this environment, write `N/A` and name the missing
instrumentation (e.g. "N/A — no `pg_stat_statements`; enable with `CREATE EXTENSION
pg_stat_statements` to get per-query timing"). Never fabricate a plausible-looking number.

### 5–6. Identify & classify the bottleneck
Match the symptom pattern against the taxonomy below. Classify to the **specific** layer,
not "the backend is slow." Every classification needs the metric that supports it, not a
guess.

| Bottleneck | Signal |
|---|---|
| CPU-bound | Host/process CPU pinned near 100% while DB CPU stays low; RPS plateaus with headroom elsewhere |
| RAM / memory pressure | RSS climbing toward container limit, swap activity, OOM kills |
| Memory leak | Heap/RSS grows monotonically across a soak test and does not return to baseline after load stops |
| Database bottleneck | DB CPU/connections/locks high while app CPU is idle-ish; latency tracks DB latency |
| Slow queries | Specific query in `pg_stat_statements`/slow log dominates total time; confirm with `EXPLAIN ANALYZE` |
| Missing indexes | `EXPLAIN ANALYZE` shows seq scan on a large table for a selective predicate |
| Connection exhaustion | Errors/timeouts correlate with pool-at-max; DB itself isn't overloaded |
| Network bottleneck | Latency high but CPU/DB/memory all idle; check payload size, round trips, DNS |
| Disk I/O | High iowait, disk queue depth; often DB checkpoints or log writes |
| Event-loop pressure (Node) | Event loop lag rises with concurrency even though CPU% looks moderate; sync/blocking code in the hot path |
| Excessive (de)serialization | CPU time concentrated in JSON parse/stringify or ORM hydration for large payloads |
| Excessive logging | I/O or CPU drops significantly when log level is raised for a test run |
| External API latency | Request latency tracks a third-party call's latency, not local resources |
| Cache inefficiency | Low hit ratio, most requests miss and hit the origin anyway |
| Cache stampede | Hit ratio craters at expiry moments; origin gets a burst exactly when a hot key expires |
| Traffic spike handling | System copes with steady load at X but fails a sudden ramp to the same X |
| Sustained/soak degradation | Fine at t=0, degrades over hours — leak, log growth, connection creep, disk fill |
| **Rate limiting (false bottleneck)** | Near-100% of requests fail with `429` while CPU/DB/Redis all stay idle. A load generator sends every VU from one source IP/key, so it trips the target's own anti-abuse rate limiter (per-IP/per-user, often Redis-backed) in seconds — that's the limiter working as designed, not the app running out of capacity. `scripts/find-capacity.mjs` tracks this separately (`perf_rate_limited`) and warns above 50%; never report a rate-limited stage as a "breaking point" without first checking this |

### 7. Apply the smallest effective optimization — the ladder

```
LEVEL 0  Baseline
LEVEL 1  Code / query optimization (fix the N+1, add the index, fix the algorithm)
LEVEL 2  Pagination / batching / payload trimming / compression
LEVEL 3  In-process cache (memory, per-instance)
LEVEL 4  Reverse-proxy cache / NGINX
LEVEL 5  CDN (when the content is actually cacheable at the edge)
LEVEL 6  Redis / shared cache
LEVEL 7  Database scaling (bigger instance, read replica)
LEVEL 8  Horizontal application scaling (multiple instances, needs shared state strategy)
```

Do not skip levels without evidence that every lower level was tried or is inapplicable.
In OPTIMIZE mode, apply exactly one level's worth of change, then go to step 8 (retest) —
don't stack multiple untested changes.

#### Cache analysis gate (run before recommending ANY caching, levels 3–6)
Answer explicitly, per endpoint:
- Is the response public, or does it depend on `Authorization`/cookies/session/tenant?
- Is it personalized per user?
- Could it contain private data if served to the wrong requester?
- How stale can it be (seconds/minutes/hours) before it's wrong in a way that matters?
- What fraction of requests could plausibly share the same cached result?
- What hit ratio would actually be worth the complexity?
- How does it get invalidated, and what happens on expiry (stampede risk)?

**Never cache a personalized or Authorization/cookie-dependent endpoint in a shared
cache.** If the cache key doesn't fully capture what varies the response (tenant id, user
id, locale, auth state), flag it as a data-leak risk, not a performance win — this is the
single most common way a "performance" recommendation turns into a multi-tenant breach in
a codebase like this one (a wrong cache key here is a p0, not a perf nit).

#### The Redis decision — never by user-count, always by workload/architecture
- **Redis unnecessary**: single app instance, in-process/memory cache resolves it, NGINX/CDN
  resolves it, the DB isn't under measured pressure, no shared state is actually needed.
- **Redis useful**: multiple app instances need a shared cache or shared state, distributed
  rate limiting, shared sessions, a read load pattern that justifies a centralized cache.
- **Redis critical**: a concrete architectural dependency requires distributed state that
  can't reasonably be solved another way (e.g. this repo already uses Redis for BullMQ
  queues — that's a real, already-justified use; it does *not* automatically justify using
  it as a shared HTTP cache too, which is a separate decision needing its own evidence).

Never write "the app has X users, therefore it needs Redis." The justification is
workload + architecture + measurement, stated explicitly, not scale alone.

Compare the realistic options when caching is on the table (as many as apply): no cache /
in-process / NGINX / Redis / CDN — on latency, RPS, CPU, RAM, DB load, hit ratio,
complexity, operational cost, and failure behavior. Don't present a more complex option as
better just because it wins on one axis (e.g. raw throughput) if it loses badly on
operational complexity for no measured need.

#### Premortem before any architectural change (levels 5–8, or introducing Redis at any level)
Before applying it, write 3–5 lines: "Assume this failed in production — why?" Consider
cache inconsistency, stale data, memory exhaustion, cache stampede, the new dependency
going down, connection exhaustion, added complexity, invalidation bugs, security leakage
(wrong data to wrong tenant/user), and workload distribution not matching what was tested.

#### Failure testing (once Redis or another new dependency becomes load-bearing)
Test and record whether the system fails completely, degrades, falls back, or recovers
automatically for: dependency unavailable, DB slow/unavailable, cold cache, cache
expiration, cache stampede, app restart, traffic spike, network latency, external API
timeout. Explicitly state whether the cache is being used as an **accelerator** (app keeps
working, degraded, without it) or as a **dependency** (app breaks without it) — prefer
accelerator, flag dependency as a design risk.

### 8–9. Retest & compare
Re-run the *same* scenario/profile/VU staircase used for baseline. Compare like-for-like.
Use `scripts/compare-runs.mjs <before-dir> <after-dir>` to produce the evidence block
(see `templates/optimization-evidence.template.md`) — every optimization needs one of
these, not a "should be faster now."

### 10. Decide whether to escalate
If the SLO (real or assumed) is now met: **STOP**. State it plainly: "SLO met at LEVEL N,
no further optimization needed." Only propose the next ladder level if a fresh measurement
after the current change still shows the SLO unmet, and say which metric is still failing.

### 11. Final report
Structure per project as:
```
tests/perf/<scenario>/<timestamp>/
  config.json       # SLO used, workload profile, VUs/stages, git commit, infra description
  summary.json       # k6 --summary-export output
  host-metrics.csv
  pg-metrics.json
  result.md          # PASS/FAIL vs SLO + narrative
```
`scripts/find-capacity.mjs` writes this layout automatically per run. Never invent a
metric that wasn't actually captured — write `N/A` with the missing-instrumentation note.

## Metrics catalog (reference — see pipeline step 4 for how to capture)

**Client-side**: RPS, throughput, P50/P90/P95/P99, error rate, timeout rate, HTTP status
code breakdown. **Server-side**: CPU, RAM, swap, load average, disk I/O, network, process
count. **Node.js**: event loop latency, CPU profile (only if a bottleneck needs it — this
is expensive, don't run it as routine overhead), heap usage, GC, memory growth. **Postgres**:
CPU, memory, connections, query latency, slow queries, locks, I/O, throughput, query
frequency, `EXPLAIN`/`EXPLAIN ANALYZE`, `pg_stat_statements` when available. **Cache**: hit
ratio, miss ratio, eviction, memory usage, latency, staleness, invalidation behavior.

## Workload profiles

Defined in `templates/perf.config.example.json`, selected via `WORKLOAD` env var to
`k6-scenarios/scenario.js`:
- **read-heavy** 90% GET / 5% POST / 5% mutations
- **balanced** 60% GET / 20% POST / 20% mutations
- **write-heavy** 30% GET / 40% POST / 30% mutations
- **hotspot** most traffic hits a small fixed set of resource IDs
- **uniform** each virtual user requests different, randomized resources
- **spike** load ramps sharply instead of gradually
- **soak** sustained moderate load for hours, watching for drift/leaks

A result from one profile is not evidence about another — if only `read-heavy` was run,
say so and don't generalize the sustainable-RPS number to write-heavy traffic.

## Cost/performance (only when there's data for it)
When you have infra pricing (DO/AWS/etc. instance cost) and a measured sustainable RPS,
compute `sustainable RPS / $` and `$ per million requests`, but always pair the number
with operational complexity in prose — a change that doubles throughput by adding a new
piece of infrastructure is not automatically "better" if nothing required the extra
capacity.

## Setting up a new project for this pipeline (first run)
1. Copy `templates/perf.config.example.json` into that project as `tests/perf/perf.config.json`
   and fill in real endpoints, their read/write classification, and cacheability per the
   cache analysis gate above.
2. Confirm Docker is available (`docker version`) — `run-k6.sh` pulls `grafana/k6` on first use.
3. If the project has Postgres, get a read-only connection string for `capture-pg-metrics.sh`
   (never use a superuser/writer credential for a metrics probe).
4. Check for existing SLOs (alerting rules, docs) before assuming none exist.

## Known limitations
- k6 runs via Docker (`--network=host`, Linux-only for that flag); on macOS/Windows hosts
  targeting a local service, use `http://host.docker.internal:<port>` instead and drop
  `--network=host` in `run-k6.sh`.
- Node/event-loop and heap metrics require the target app to expose them (e.g. a
  `/metrics` or `/health` endpoint with `perf_hooks` data); without that, those rows are
  `N/A` — this skill does not add instrumentation to a project on its own initiative.
- `pg_stat_statements` must already be enabled to get per-query timing; if it isn't, say so
  instead of estimating.
- Distributed/multi-instance failure testing (killing one of several app instances,
  network partition) isn't automated here — it needs infra-specific tooling per project
  (e.g. DO API calls, k8s chaos tooling) and should be designed case by case, flagged as
  out of scope for a generic script.
- This skill never runs a destructive or production load test on its own initiative — see
  the safety gate.
