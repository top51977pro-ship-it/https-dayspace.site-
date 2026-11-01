#!/usr/bin/env bash
# Boots a real Paper server with DonutClassic.jar, runs admin commands from the console, restarts once
# (persistence + migrations), and fails on any DonutClassic error in the log.
# Usage: scripts/smoke-test.sh <paper.jar> <DonutClassic.jar> [workdir]
set -euo pipefail
PAPER=$(realpath "$1"); PLUGIN=$(realpath "$2"); DIR=${3:-test-server}
rm -rf "$DIR"; mkdir -p "$DIR/plugins"; cd "$DIR"
cp "$PLUGIN" plugins/DonutClassic.jar
mkdir -p plugins/DonutClassic/maps
python3 "$(dirname "$PLUGIN")/../scripts/make_test_litematic.py" plugins/DonutClassic/maps/ci-test.litematic
# Also ship the test map INSIDE the jar as a bundled spawn (exercises extract + auto-paste on first start)
mkdir -p bundle/bundled-maps && cp plugins/DonutClassic/maps/ci-test.litematic bundle/bundled-maps/spawn.litematic
(cd bundle && zip -q ../plugins/DonutClassic.jar bundled-maps/spawn.litematic)
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
             "dc keyall common 1" "dc preset feb-2026" "dc preset classic-early" "dc reload" "dc backup" \
             "dc map list" "dc map paste ci-test maptest 0 64 0" "dc map status" "dc map status" "dc map list" "dc border" "dc border world 20000" "ban NoSuchPlayer 1h test" "banlist" "dc antixray" "dc panel"
# Simulate an owner who kept an OLD config.yml (without the newer worlds.bundled section)
python3 - <<'PY'
import re
p = "plugins/DonutClassic/config.yml"
s = open(p).read()
s = re.sub(r"\n  bundled:\n(    .*\n)+", "\n", s)
s = s.replace("auto-paste-bundled: true", "auto-paste-bundled: true")
open(p, "w").write(s)
PY
grep -q "^  bundled:" plugins/DonutClassic/config.yml && echo "WARN: could not strip bundled section"
run run2.log "dc status"

fail=0
for log in run1.log run2.log; do
  echo "===== $log (DonutClassic lines) ====="; grep -E 'DonutClassic|donutclassic' "$log" || true
  grep -q 'DonutClassic enabled' "$log" || { echo "FAIL: plugin not enabled in $log"; fail=1; }
  if grep -nE '(ERROR|SEVERE).*DonutClassic|net\.donutclassic\.[A-Za-z.]+Exception|at net\.donutclassic' "$log"; then echo "FAIL: errors in $log"; fail=1; fi
done
grep -q 'Output per minute' run1.log || { echo "FAIL: benchmark output missing"; fail=1; }
grep -q 'Paste of ci-test finished: 92 blocks, 2 block entities, 2 entities' run1.log || { echo "FAIL: map paste"; grep -i paste run1.log; fail=1; }
for want in 'Extracted bundled map spawn.litematic' 'Auto-pasting bundled map spawn.litematic' 'Paste of spawn finished' 'Spawn set to the middle of spawn' 'Spawn protection set'; do
  grep -q "$want" run1.log || { echo "FAIL: missing '$want'"; fail=1; }
done
grep -q 'pasted: ci-test' run1.log || { echo "FAIL: saved positions not readable before restart"; fail=1; }
grep -q 'Auto-pasting bundled map' run2.log && { echo "FAIL: bundled map pasted twice"; fail=1; }
grep -q 'Added new default settings to config.yml' run2.log || { echo "FAIL: missing settings not added to old config.yml"; fail=1; }
grep -q "^  bundled:" plugins/DonutClassic/config.yml || { echo "FAIL: bundled section not restored"; fail=1; }
grep -q 'Unknown block states: 0' run1.log || { echo "FAIL: unknown block states"; fail=1; }
if grep -E 'skipped:|failed: ' run1.log | grep -iE 'item|entity|block entity'; then echo "FAIL: map element skipped"; fail=1; fi
grep -q 'World border world: 20000 blocks wide' run2.log || { echo "FAIL: border not persisted"; fail=1; }
grep -q 'Loaded void world maptest' run2.log || { echo "FAIL: void world not reloaded on restart"; fail=1; }
python3 - <<'PY' || fail=1
import sqlite3, sys
c = sqlite3.connect("plugins/DonutClassic/data.db")
v = c.execute("PRAGMA user_version").fetchone()[0]
t = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
need = {"accounts","balances","spawners","ah_listings","orders","mailbox","teams","homes","stats","meta"}
print("schema version", v, "tables", sorted(t))
sys.exit(0 if v >= 1 and need <= t else 1)
PY
python3 - <<'PY' || fail=1
import json, sys
for f in ["status", "ah", "orders", "bans", "alerts"]:
    d = json.load(open(f"plugins/DonutClassic/panel/{f}.json"))
    print("panel", f, "ok", list(d.keys()))
PY
grep -q 'anti-xray' run1.log || { echo "FAIL: antixray not configured"; fail=1; }
grep -q 'enabled: true' config/paper-world-defaults.yml 2>/dev/null && echo "paper anti-xray config present"
ls plugins/DonutClassic/backups/*.db >/dev/null 2>&1 || { echo "FAIL: backup not written"; fail=1; }
[ $fail = 0 ] && echo "SMOKE TEST PASSED" || { echo "SMOKE TEST FAILED"; exit 1; }
