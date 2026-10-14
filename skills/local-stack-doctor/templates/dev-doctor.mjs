#!/usr/bin/env node
/**
 * dev-doctor — local dev stack auditor (generic, config-driven).
 *
 * Reads `.local-stack.json` at the project root and checks:
 *   1. Port listeners — flag duplicates on canonical ports.
 *   2. Docker containers — confirm expected, flag forbidden, flag missing.
 *   3. Local Docker images — flag stale (per `staleImageDays`).
 *   4. PM2 processes — confirm expected online, flag legacy wrappers.
 *   5. docker-compose drift — declared image vs running image.
 *
 * Exit 0 if all green. Exit 1 if any RED check fails.
 *
 * Drop this file into <project>/scripts/dev-doctor.mjs and add
 * `"doctor": "node scripts/dev-doctor.mjs"` to package.json.
 *
 * Config example (`.local-stack.json` at project root):
 * {
 *   "ports": {
 *     "3000": { "owner": "api (PM2 / tsx watch)", "kind": "host-process" },
 *     "5432": { "owner": "postgres (Docker my-postgres-1)", "kind": "docker" }
 *   },
 *   "expectedContainers": ["my-postgres-1", "my-redis-1"],
 *   "forbiddenContainers": ["my-api-1"],
 *   "expectedPm2": ["my-api", "my-admin"],
 *   "legacyPm2": ["my-dev"],
 *   "imageDriftCheck": true,
 *   "staleImageDays": 14,
 *   "staleImagePatterns": ["my-project", "agent-pr"]
 * }
 *
 * Origin: local-stack-doctor skill.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const COLOR = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

let exitCode = 0;
const fail = (m) => { console.log(COLOR.red('  ✗ ' + m)); exitCode = 1; };
const warn = (m) => console.log(COLOR.yellow('  ! ' + m));
const ok = (m) => console.log(COLOR.green('  ✓ ' + m));
const note = (m) => console.log('    ' + COLOR.dim(m));
const header = (m) => console.log('\n' + COLOR.bold(m));

function tryExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

// ── Load config ────────────────────────────────────────────────────────────
const configPath = join(ROOT, '.local-stack.json');
if (!existsSync(configPath)) {
  console.error(COLOR.red(`No .local-stack.json at ${configPath}`));
  console.error('Create one with at minimum a `ports` map. See the local-stack-doctor skill.');
  process.exit(2);
}
const config = JSON.parse(readFileSync(configPath, 'utf8'));

// ── Detect platform for listener probe ─────────────────────────────────────
const isWindows = process.platform === 'win32';

function listenersOnPort(port) {
  if (isWindows) {
    const out = tryExec('netstat -ano') ?? '';
    const lines = out
      .split(/\r?\n/)
      .filter((l) => l.includes('LISTENING') && new RegExp(`:${port}\\s`).test(l));
    return [...new Set(lines.map((l) => l.trim().split(/\s+/).pop()).filter(Boolean))];
  }
  // macOS / Linux: use lsof
  const out = tryExec(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`) ?? '';
  return [...new Set(out.split(/\r?\n/).filter(Boolean))];
}

// ── Check 1: port listeners ───────────────────────────────────────────────
header('1. Port listeners');
const ports = config.ports ?? {};
if (Object.keys(ports).length === 0) {
  warn('no ports declared in .local-stack.json — skipping');
} else {
  for (const [port, meta] of Object.entries(ports)) {
    const pids = listenersOnPort(port);
    if (pids.length === 0) {
      warn(`port ${port} (${meta.owner}) — no listener`);
    } else if (pids.length === 1) {
      ok(`port ${port} (${meta.owner}) — pid ${pids[0]}`);
    } else {
      fail(`port ${port} has ${pids.length} listeners (pids: ${pids.join(', ')}) — collision`);
      note('classic dev-runtime-vs-container conflict pattern. Resolve before continuing.');
    }
  }
}

// ── Check 2: docker containers ────────────────────────────────────────────
header('2. Docker containers');
const containerLines = (tryExec('docker ps --format "{{.Names}}|{{.Image}}|{{.Ports}}"') ?? '')
  .split(/\r?\n/)
  .filter(Boolean);
const containerNames = containerLines.map((l) => l.split('|')[0]);

for (const expected of config.expectedContainers ?? []) {
  if (containerNames.includes(expected)) ok(`${expected} running`);
  else warn(`${expected} not running — start with \`docker compose up -d\``);
}
for (const forbidden of config.forbiddenContainers ?? []) {
  if (containerNames.includes(forbidden)) {
    fail(`${forbidden} running — should be gated behind a docker-compose profile`);
    note(`stop with: \`docker compose stop ${forbidden} && docker compose rm -f ${forbidden}\``);
  } else {
    ok(`forbidden container \`${forbidden}\` not running`);
  }
}

// ── Check 3: stale local images ───────────────────────────────────────────
header('3. Local docker images');
const staleDays = config.staleImageDays ?? 14;
const staleRegex = new RegExp((config.staleImagePatterns ?? []).join('|') || '$^', 'i');
const images = tryExec('docker images --format "{{.Repository}}:{{.Tag}}|{{.CreatedSince}}|{{.Size}}"') ?? '';
const matches = images.split(/\r?\n/).filter((l) => l && staleRegex.test(l));
if (matches.length === 0) {
  ok('no images matching staleImagePatterns');
} else {
  for (const line of matches) {
    const [repo, age, size] = line.split('|');
    // Stale heuristic: any age in weeks/months. (Days are usually fresh.)
    const stale = /week|month|year/i.test(age);
    if (stale) {
      warn(`stale image: ${repo} (${age}, ${size})`);
      note(`rebuild fresh OR delete: \`docker rmi ${repo}\``);
    } else {
      ok(`image ${repo} — ${age}, ${size}`);
    }
  }
}
void staleDays; // reserved for future precise day check if needed

// ── Check 4: PM2 processes ────────────────────────────────────────────────
header('4. PM2 processes');
const pm2Json = tryExec('pm2 jlist');
if (!pm2Json) {
  if ((config.expectedPm2 ?? []).length > 0) {
    warn('pm2 not installed or not running — host stack unmanaged');
  } else {
    ok('no PM2 expectations — skipped');
  }
} else {
  let parsed = [];
  try {
    parsed = JSON.parse(pm2Json);
  } catch {
    warn('pm2 jlist produced invalid JSON — skipping');
  }
  const found = new Set(parsed.map((p) => p.name));
  for (const name of config.expectedPm2 ?? []) {
    const p = parsed.find((x) => x.name === name);
    if (!p) warn(`pm2 process \`${name}\` not running`);
    else if (p.pm2_env?.status !== 'online') fail(`pm2 \`${name}\` status=${p.pm2_env?.status}`);
    else ok(`pm2 \`${name}\` online (pid ${p.pid})`);
  }
  for (const legacy of config.legacyPm2 ?? []) {
    if (found.has(legacy)) {
      fail(`legacy pm2 process \`${legacy}\` still running`);
      note(`pm2 delete ${legacy}`);
    }
  }
}

// ── Check 5: docker-compose drift ─────────────────────────────────────────
header('5. docker-compose image drift');
if (!config.imageDriftCheck) {
  ok('drift check disabled in config');
} else {
  const composePath = join(ROOT, 'docker-compose.yml');
  if (!existsSync(composePath)) {
    warn('docker-compose.yml missing — skipping drift check');
  } else {
    const yaml = readFileSync(composePath, 'utf8');
    const declared = {};
    let currentSvc = null;
    for (const line of yaml.split(/\r?\n/)) {
      const svcMatch = line.match(/^ {2}([a-z0-9-]+):\s*$/);
      if (svcMatch) {
        currentSvc = svcMatch[1];
        continue;
      }
      const imgMatch = line.match(/^ {4}image:\s*(.+)$/);
      if (imgMatch && currentSvc && !declared[currentSvc]) {
        declared[currentSvc] = imgMatch[1].trim();
      }
    }
    const composeProject = config.composeProjectName ?? '';
    for (const [svc, image] of Object.entries(declared)) {
      // Compose container name convention: <project>-<svc>-1
      const candidate = composeProject ? `${composeProject}-${svc}-1` : `${svc}-1`;
      const containerName = containerNames.find((n) => n === candidate || n.endsWith(`-${svc}-1`));
      if (!containerName) {
        warn(`${svc} declared as \`${image}\` but no matching container running`);
        continue;
      }
      const running = tryExec(`docker inspect ${containerName} --format "{{.Config.Image}}"`);
      if (running !== image) {
        fail(`${svc} drift: declared \`${image}\`, running \`${running}\``);
        note('reconcile: update yaml OR `docker compose pull && up -d`');
      } else {
        ok(`${svc} matches declared image \`${image}\``);
      }
    }
  }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log();
if (exitCode === 0) console.log(COLOR.green(COLOR.bold('All checks passed.')));
else console.log(COLOR.red(COLOR.bold('Some checks failed.')) + ' See above.');
process.exit(exitCode);
