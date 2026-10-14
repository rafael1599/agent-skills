Optimization:
<one line — the change applied, at its ladder level (e.g. "LEVEL 3: add Node in-process cache for GET /feed">

Reason:
<the classified bottleneck this targets, from the taxonomy in SKILL.md step 5-6>

Evidence:
<the actual metric readings that motivated this change — CPU%, DB CPU%, P95/P99, hit ratio, etc.
Never "seemed slow" — numbers only, pulled from a real run directory.>

Expected:
<what this change should do to the specific bottleneck metric, not a vague "should be faster">

Before:
<VU sustainable, P95, P99, error rate — from scripts/find-capacity.mjs output, run: <timestamp>>

After:
<same metrics, same scenario/profile, from the retest — run: <timestamp>>

Conclusion:
<did the metric that motivated this change actually move? If not, say so plainly and don't
keep the change on faith — revert or reclassify.>

Next:
<explicit statement: is further escalation justified by a fresh measurement, or does this meet
the SLO and stop here? If proposing the next ladder level, name the metric still failing.>

---
Premortem (required before levels 5-8 or introducing Redis at any level):
"Assume this failed in production — why?"
- <cache inconsistency / stale data / memory exhaustion / cache stampede / dependency outage /
  connection exhaustion / added complexity / invalidation bugs / security leakage / workload
  mismatch — address the ones that actually apply, don't just list all of them>

Failure behavior (once the new dependency is load-bearing):
- Accelerator or dependency? <does the app still work, degraded, if this goes away?>
- Tested: <which failure scenarios from SKILL.md step 7 "Failure testing" were actually run>
