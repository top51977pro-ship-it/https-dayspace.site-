#!/usr/bin/env bash
# Boots a real Paper server with DonutClassic.jar, runs admin commands from the console, restarts once
# (persistence + migrations), and fails on any DonutClassic error in the log.
# Usage: scripts/smoke-test.sh <paper.jar> <DonutClassic.jar> [workdir]
set -euo pipefail
PAPER=$(realpath "$1"); PLUGIN=$(realpath "$2"); DIR=${3:-test-server}
rm -rf "$DIR"; mkdir -p "$DIR/plugins"; cd "$DIR"
cp "$PLUGIN" plugins/DonutClassic.jar
echo "eula=true" > eula.txt
printf 'online-mode=false\nserver-port=25599\nlevel-type=minecraft\\:flat\ngenerate-structures=false\nspawn-protection=0\nview-distance=4\n' > server.properties

run() { # $1 = log file, rest = console commands
  local log=$1; shift
  rm -f in.fifo; mkfifo in.fifo
  (java -Xms512M -Xmx1536M -jar "$PAPER" --nogui < in.fifo > "$log" 2>&1) & local pid=$!
  exec 3>in.fifo
  for i in $(seq 1 300); do grep -q 'Done (' "$log" && break; kill -0 $pid 2>/dev/null || break; sleep 1; done
  grep -q 'Done (' "$log" || { echo "Server did not start"; tail -80 "$log"; exit 1; }
  for c in "$@"; do echo "$c" >&3; sleep 2; done
  echo "stop" >&3
  wait $pid || true
  exec 3>&-
}

run run1.log "plugins" "dc version" "dc status" "dc spawner list" "dc spawner benchmark" "dc setupwizard" \
             "dc keyall common 1" "dc preset feb-2026" "dc preset classic-early" "dc reload" "dc backup"
run run2.log "dc status"

fail=0
for log in run1.log run2.log; do
  echo "===== $log (DonutClassic lines) ====="; grep -E 'DonutClassic|donutclassic' "$log" || true
  grep -q 'DonutClassic enabled' "$log" || { echo "FAIL: plugin not enabled in $log"; fail=1; }
  if grep -nE '(ERROR|SEVERE).*DonutClassic|net\.donutclassic\.[A-Za-z.]+Exception|at net\.donutclassic' "$log"; then echo "FAIL: errors in $log"; fail=1; fi
done
grep -q 'Output per minute' run1.log || { echo "FAIL: benchmark output missing"; fail=1; }
python3 - <<'PY' || fail=1
import sqlite3, sys
c = sqlite3.connect("plugins/DonutClassic/data.db")
v = c.execute("PRAGMA user_version").fetchone()[0]
t = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
need = {"accounts","balances","spawners","ah_listings","orders","mailbox","teams","homes","stats","meta"}
print("schema version", v, "tables", sorted(t))
sys.exit(0 if v >= 1 and need <= t else 1)
PY
ls plugins/DonutClassic/backups/*.db >/dev/null 2>&1 || { echo "FAIL: backup not written"; fail=1; }
[ $fail = 0 ] && echo "SMOKE TEST PASSED" || { echo "SMOKE TEST FAILED"; exit 1; }
