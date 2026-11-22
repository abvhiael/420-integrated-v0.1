#!/usr/bin/env bash
# GOV-PRE-08 Step3: actual 15-process accelerated fourtwentyd consensus devnet.
# Production signed quorum and patched node420 execution settlement are not
# established by this local deterministic TCP-bus testing.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
test -n "$RUNNER_TEMP"
go build -o "$RUNNER_TEMP/govpre08-fourtwentyd" ./consensus/cmd/fourtwentyd
go build -o "$RUNNER_TEMP/govpre08-consensus-bus" ./devnet/cmd/devnet-bus
reportdir="$RUNNER_TEMP/govpre08-consensus"
mkdir -p "$reportdir"
"$RUNNER_TEMP/govpre08-consensus-bus" --listen=127.0.0.1:19420 > "$reportdir/bus.log" 2>&1 &
buspid=$!
cleanup() {
  if [ -f "$reportdir/pids" ]; then
    while read -r pid; do kill "$pid" 2>/dev/null || true; done < "$reportdir/pids"
  fi
  kill "$buspid" 2>/dev/null || true
}
trap cleanup EXIT
sleep 1
kill -0 "$buspid"
for phase in original recovered; do
  : > "$reportdir/pids"
  for i in $(seq 0 14); do
    "$RUNNER_TEMP/govpre08-fourtwentyd" --devnet-validator \
      --node-id="$((1000+i))" --seat="$i" --bus=127.0.0.1:19420 \
      --state="$reportdir/seat-$i.json" \
      --engine-state="$reportdir/engine-$i.json" \
      --max-slots=40 --slot-ms=240 \
      > "$reportdir/seat-$i-$phase.log" 2>&1 &
    echo "$!" >> "$reportdir/pids"
  done
  while read -r pid; do wait "$pid"; done < "$reportdir/pids"
  : > "$reportdir/pids"
  python3 - "$reportdir" "$phase" <<'PY'
import json,sys,pathlib
root=pathlib.Path(sys.argv[1])
phase=sys.argv[2]
states=[json.loads((root/f"seat-{i}.json").read_text()) for i in range(15)]
assert all(len(s["active_seats"])==15 for s in states), "missing 15 validator seats"
assert all(s["next_slot"]>=40*(2 if phase=="recovered" else 1) for s in states), "consensus slot restart drift"
certified=[s for s in states if s["latest_qc"]["signers"]>=11]
assert len(certified)>=11, "insufficient actual 11-of-15 quorum certificates"
assert all(s["latest_qc"]["block_root"] and s["latest_qc"]["signers"]<=15
           for s in certified),"bad quorum source"
assert all(s["head"]["Slot"]>=s["safe"]["Slot"]>=s["finalized"]["Slot"]
           for s in states), "invalid head-safe-finality monotonicity"
assert all(s["next_slot"]>s["latest_qc"]["slot"] for s in certified), "nonpersistent certified slot"
report={
  "schema":"GOV_PRE_08_STEP3_FIFTEEN_ACTUAL_CONSENSUS_DEVNET_PROCESSES_V1",
  "phase":phase,"chainIdentity":"SIMULATED_CONSENSUS_DEVNET_NOT_CHAIN_420_EXECUTION",
  "runningValidatorProcesses":15,"quorumThreshold":11,"quorumStates":len(certified),
  "minimumNextSlot":min(s["next_slot"] for s in states),
  "minimumFinalizedSlot":min(s["finalized"]["Slot"] for s in states),
  "persistedStateRecovered":phase=="recovered",
  "realExecutionEngineConnected":False,
  "productionBlsRemoteSignerQualified":False,
  "onChainStakeConsensusRewardSettled":False,
  "productionV4Authorized":False,
}
(root/f"consensus-{phase}.json").write_text(json.dumps(report,sort_keys=True,indent=2)+"\n")
print("GOV_PRE_08_STEP3_15_ACTUAL_DEVNET_VALIDATORS="+phase.upper()+"_PASS",report["quorumStates"])
PY
done
