#!/usr/bin/env node
// Produces the mandatory evidence block for an optimization: before/after
// capacity numbers pulled from two find-capacity.mjs run directories.
// No npm dependencies.
//
// Usage:
//   node compare-runs.mjs --before tests/perf/read-heavy/<ts1> --after tests/perf/read-heavy/<ts2> \
//     --optimization "Add Node in-process cache" \
//     --reason "CPU bottleneck caused by repeated feed computation" \
//     --evidence "CPU: 91%, DB CPU: 32%, P95: 410ms" \
//     --expected "Reduce repeated application work" \
//     --conclusion "Optimization improved sustainable capacity" \
//     --next "No Redis required at this stage"
import fs from 'node:fs';
import path from 'node:path';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

function loadRun(dir) {
  const resultPath = path.join(dir, 'result.md');
  const configPath = path.join(dir, 'config.json');
  if (!fs.existsSync(configPath)) {
    console.error(`Not a find-capacity.mjs run dir (missing config.json): ${dir}`);
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const resultMd = fs.existsSync(resultPath) ? fs.readFileSync(resultPath, 'utf8') : '';
  const sustainableMatch = resultMd.match(/Sustainable capacity\*\*: ~(\d+) VU/);
  const p95Rows = [...resultMd.matchAll(/\| (\d+) \| ([\d.]+|N\/A) \| ([\d.]+|N\/A) \| ([\d.]+|N\/A) \| (PASS|FAIL) \|/g)];
  const lastPass = [...p95Rows].reverse().find((r) => r[5] === 'PASS');
  return {
    dir,
    sustainableVus: sustainableMatch ? Number(sustainableMatch[1]) : null,
    p95AtSustainable: lastPass ? lastPass[2] : 'N/A',
    p99AtSustainable: lastPass ? lastPass[3] : 'N/A',
    slo: config.slo,
    timestamp: config.timestamp,
  };
}

const beforeDir = arg('before');
const afterDir = arg('after');
if (!beforeDir || !afterDir) {
  console.error('Usage: compare-runs.mjs --before <dir> --after <dir> [--optimization ...] [--reason ...] [--evidence ...] [--expected ...] [--conclusion ...] [--next ...]');
  process.exit(1);
}

const before = loadRun(beforeDir);
const after = loadRun(afterDir);

const block = `
Optimization:
${arg('optimization', '<describe the change>')}

Reason:
${arg('reason', '<the classified bottleneck this targets>')}

Evidence:
${arg('evidence', '<the metric readings that motivated this change>')}

Expected:
${arg('expected', '<what this change should do to the bottleneck>')}

Before:
${before.sustainableVus ?? 'N/A'} VU sustainable, P95: ${before.p95AtSustainable}ms, P99: ${before.p99AtSustainable}ms (run: ${before.timestamp})

After:
${after.sustainableVus ?? 'N/A'} VU sustainable, P95: ${after.p95AtSustainable}ms, P99: ${after.p99AtSustainable}ms (run: ${after.timestamp})

Conclusion:
${arg('conclusion', before.sustainableVus !== null && after.sustainableVus !== null
  ? (after.sustainableVus > before.sustainableVus ? 'Optimization improved sustainable capacity.' : 'No measured improvement — reconsider the classification or revert.')
  : '<insufficient data — one of the runs is missing sustainable-capacity data>')}

Next:
${arg('next', '<state explicitly whether further escalation is justified, and why/why not>')}
`.trim();

console.log(block);

const outFile = arg('out');
if (outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, block + '\n');
  console.log(`\nWritten to ${outFile}`);
}
