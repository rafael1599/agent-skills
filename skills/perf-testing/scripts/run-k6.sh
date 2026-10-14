#!/usr/bin/env bash
# Runs a k6 scenario via Docker (no local k6/npm install needed) and writes
# results into a reproducible per-run directory.
#
# Usage:
#   run-k6.sh <scenario.js> <out_dir> [-e KEY=VALUE ...]
#
# Example:
#   run-k6.sh k6-scenarios/scenario.js tests/perf/read-heavy/2026-09-27T12-00-00 \
#     -e BASE_URL=http://host.docker.internal:3000 \
#     -e STAGES='[{"duration":"30s","target":10},{"duration":"30s","target":50}]' \
#     -e WORKLOAD=read-heavy \
#     -e THRESH_P95=300 -e THRESH_P99=600 -e THRESH_ERROR_RATE=0.01
#
# On Linux, --network=host lets the container reach a service on localhost.
# On macOS/Windows Docker Desktop, use BASE_URL=http://host.docker.internal:<port>
# and drop --network=host (edit NETWORK_ARGS below).
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <scenario.js> <out_dir> [-e KEY=VALUE ...]" >&2
  exit 1
fi

SCENARIO="$1"; shift
OUT_DIR="$1"; shift

if [ ! -f "$SCENARIO" ]; then
  echo "Scenario file not found: $SCENARIO" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
SCENARIO_ABS="$(cd "$(dirname "$SCENARIO")" && pwd)/$(basename "$SCENARIO")"
OUT_ABS="$(cd "$OUT_DIR" && pwd)"

NETWORK_ARGS=(--network=host)
if [ "$(uname -s)" != "Linux" ]; then
  NETWORK_ARGS=()
  echo "Note: non-Linux host — dropping --network=host. Point BASE_URL at host.docker.internal if targeting a local service." >&2
fi

# grafana/k6 runs as a non-root image user by default; without --user the
# container can't write into a bind-mounted host directory it doesn't own,
# and k6 silently fails only the summary-export step (exit code stays 0 for
# the load test itself, so this is easy to miss). Match the host UID/GID.
docker run --rm -i "${NETWORK_ARGS[@]}" \
  --user "$(id -u):$(id -g)" \
  -v "$SCENARIO_ABS":/scenario.js:ro \
  -v "$OUT_ABS":/out \
  "$@" \
  grafana/k6 run \
  --summary-export=/out/summary.json \
  /scenario.js 2>&1 | tee "$OUT_ABS/stdout.log"

if [ ! -s "$OUT_ABS/summary.json" ]; then
  echo "WARNING: $OUT_ABS/summary.json is missing or empty — check $OUT_ABS/stdout.log for a k6 error (e.g. permission denied writing the export)." >&2
  exit 1
fi

echo "Results written to $OUT_ABS/summary.json"
