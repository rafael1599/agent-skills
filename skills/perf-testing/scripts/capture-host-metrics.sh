#!/usr/bin/env bash
# Samples host-level metrics (CPU, RAM, swap, load average, disk I/O) at a fixed
# interval for a given duration, writing CSV. Run this in parallel with run-k6.sh
# (same wall-clock window) to correlate load stages with resource pressure.
#
# Usage: capture-host-metrics.sh <out_csv> <duration_seconds> [interval_seconds]
set -euo pipefail

OUT_CSV="${1:?out_csv required}"
DURATION="${2:?duration_seconds required}"
INTERVAL="${3:-5}"

mkdir -p "$(dirname "$OUT_CSV")"
echo "timestamp,cpu_pct,mem_used_mb,mem_total_mb,swap_used_mb,load1,load5,disk_read_kb_s,disk_write_kb_s" > "$OUT_CSV"

END=$((SECONDS + DURATION))
while [ $SECONDS -lt $END ]; do
  TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  if command -v mpstat >/dev/null 2>&1; then
    CPU=$(mpstat 1 1 | awk '/Average/ {print 100 - $NF}')
  else
    CPU=$(top -bn2 -d 0.2 | grep -m1 "Cpu(s)" | tail -1 | awk -F'id,' '{split($1,a,","); print 100-a[length(a)]}' 2>/dev/null || echo "N/A")
  fi

  read -r MEM_TOTAL MEM_USED SWAP_USED < <(free -m | awk '/^Mem:/{mt=$2; mu=$3} /^Swap:/{su=$3} END{print mt, mu, su}')

  read -r LOAD1 LOAD5 < <(uptime | awk -F'load average:' '{split($2,a,","); gsub(/ /,"",a[1]); gsub(/ /,"",a[2]); print a[1], a[2]}')

  if command -v iostat >/dev/null 2>&1; then
    read -r DISK_READ DISK_WRITE < <(iostat -dk 1 2 2>/dev/null | awk 'NR>0 && /^[a-z]/{r=$3; w=$4} END{print r, w}')
  else
    DISK_READ="N/A"; DISK_WRITE="N/A"
  fi

  echo "$TS,${CPU:-N/A},${MEM_USED:-N/A},${MEM_TOTAL:-N/A},${SWAP_USED:-N/A},${LOAD1:-N/A},${LOAD5:-N/A},${DISK_READ:-N/A},${DISK_WRITE:-N/A}" >> "$OUT_CSV"

  sleep "$INTERVAL"
done

echo "Host metrics written to $OUT_CSV"
echo "Note: iostat/mpstat missing on this host means disk/CPU columns may read N/A — install sysstat for full coverage." >&2
