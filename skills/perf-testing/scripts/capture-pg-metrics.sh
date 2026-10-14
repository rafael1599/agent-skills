#!/usr/bin/env bash
# Snapshots Postgres-side metrics relevant to a load test: connections, locks,
# slow queries, cache hit ratio, and (if the extension exists) pg_stat_statements.
# Use a READ-ONLY connection string — this script never mutates anything.
#
# Usage: capture-pg-metrics.sh <database_url> <out_json>
set -euo pipefail

DB_URL="${1:?database_url required}"
OUT_JSON="${2:?out_json required}"

mkdir -p "$(dirname "$OUT_JSON")"

run_sql() {
  local result
  result="$(psql "$DB_URL" -X -q -t -A -F',' -c "$1" 2>/dev/null)" || { echo "ERROR"; return; }
  [ -z "$result" ] && { echo "N/A"; return; }
  echo "$result"
}

HAS_PG_STAT_STATEMENTS=$(run_sql "SELECT count(*) FROM pg_extension WHERE extname = 'pg_stat_statements';")

CONNECTIONS=$(run_sql "SELECT count(*), max_conn FROM pg_stat_activity, (SELECT setting::int AS max_conn FROM pg_settings WHERE name='max_connections') s GROUP BY max_conn;")

LOCKS=$(run_sql "SELECT count(*) FROM pg_locks WHERE NOT granted;")

CACHE_HIT_RATIO=$(run_sql "SELECT round(sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 4) FROM pg_statio_user_tables;")

DB_SIZE=$(run_sql "SELECT pg_size_pretty(pg_database_size(current_database()));")

if [ "$HAS_PG_STAT_STATEMENTS" = "1" ]; then
  SLOW_QUERIES=$(psql "$DB_URL" -X -q -t -A -F'|' -c \
    "SELECT round(mean_exec_time::numeric,2), calls, round(total_exec_time::numeric,2), left(query,200) \
     FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;" 2>/dev/null | \
    awk -F'|' '{printf "{\"mean_ms\":%s,\"calls\":%s,\"total_ms\":%s,\"query\":\"%s\"},", $1,$2,$3,$4}')
  SLOW_QUERIES="[${SLOW_QUERIES%,}]"
else
  SLOW_QUERIES="\"N/A — pg_stat_statements not installed; enable with CREATE EXTENSION pg_stat_statements to get per-query timing\""
fi

cat > "$OUT_JSON" <<EOF
{
  "captured_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "connections": "${CONNECTIONS}",
  "locks_waiting": "${LOCKS}",
  "cache_hit_ratio": "${CACHE_HIT_RATIO}",
  "db_size": "${DB_SIZE}",
  "slow_queries_top10": ${SLOW_QUERIES}
}
EOF

echo "Postgres metrics written to $OUT_JSON"
