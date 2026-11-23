#!/usr/bin/env bash
set -euo pipefail
test -n "$RUNNER_TEMP" && test -n "$GOV_PRE_08_RPC" && test -n "$INDEXER_PG_URL"
tag="$1"
phase="$2"
[[ "$tag" == a || "$tag" == b ]]
[[ "$phase" == original || "$phase" == recovered ]]
if [ ! -x "$RUNNER_TEMP/govpre08-step3-explorer" ]; then
  go build -o "$RUNNER_TEMP/govpre08-step3-explorer" ./explorer/cmd/explorer420
fi
if [ "$tag" = a ]; then bridgeport=18971; explorerport=18973; wrongport=18975
else bridgeport=18972; explorerport=18974; wrongport=18976; fi
bridge="http://127.0.0.1:$bridgeport"
base="http://127.0.0.1:$explorerport"
wrong="http://127.0.0.1:$wrongport"
export GOV_PRE_08_GO_EXPLORER_BASE="$base"
export GOV_PRE_08_GO_EXPLORER_WRONG="$wrong"
export GOV_PRE_08_GO_EXPLORER_BRIDGE="$bridge"
export GOV_PRE_08_GO_EXPLORER_TAG="$tag"
export GOV_PRE_08_GO_EXPLORER_PHASE="$phase"
node scripts/gov-pre-08/postgres-explorer-compat.mjs \
  --tag "$tag" --rpc "$GOV_PRE_08_RPC" --port "$bridgeport" \
  --graph "$RUNNER_TEMP/govpre08-step3-graph-$tag.json" \
  > "$RUNNER_TEMP/govpre08-step3-bridge-$tag-$phase.log" 2>&1 &
bridgepid=$!
(
  EXPLORER_INDEXER_URL="$bridge" EXPLORER_LISTEN_ADDR="127.0.0.1:$explorerport" \
  EXPLORER_CHAIN_ID=31337 EXPLORER_STALE_AFTER=5m \
  "$RUNNER_TEMP/govpre08-step3-explorer"
) > "$RUNNER_TEMP/govpre08-step3-explorer-$tag-$phase.log" 2>&1 &
explorerpid=$!
(
  EXPLORER_INDEXER_URL="$bridge" EXPLORER_LISTEN_ADDR="127.0.0.1:$wrongport" \
  EXPLORER_CHAIN_ID=420 EXPLORER_STALE_AFTER=5m \
  "$RUNNER_TEMP/govpre08-step3-explorer"
) > "$RUNNER_TEMP/govpre08-step3-explorer-wrong-$tag-$phase.log" 2>&1 &
wrongpid=$!
cleanup() {
  kill "$bridgepid" "$explorerpid" "$wrongpid" 2>/dev/null || true
  wait "$bridgepid" "$explorerpid" "$wrongpid" 2>/dev/null || true
}
trap cleanup EXIT
ready=false
for attempt in $(seq 1 40); do
  if curl -fsS --max-time 2 "$base/v1/ready" \
    > "$RUNNER_TEMP/govpre08-step3-explorer-ready-$tag-$phase.json" 2>/dev/null; then
    ready=true; break
  fi
  if ! kill -0 "$bridgepid" 2>/dev/null || ! kill -0 "$explorerpid" 2>/dev/null; then
    cat "$RUNNER_TEMP/govpre08-step3-bridge-$tag-$phase.log" >&2
    cat "$RUNNER_TEMP/govpre08-step3-explorer-$tag-$phase.log" >&2
    exit 1
  fi
  sleep 1
done
if [ "$ready" != true ]; then
  cat "$RUNNER_TEMP/govpre08-step3-bridge-$tag-$phase.log" >&2
  cat "$RUNNER_TEMP/govpre08-step3-explorer-$tag-$phase.log" >&2
  exit 1
fi
for part in status capabilities; do
  curl -fsS --max-time 3 "$base/v1/$part" > "$RUNNER_TEMP/govpre08-step3-explorer-$part-$tag-$phase.json"
done
curl -fsS --max-time 3 "$base/v1/blocks?limit=5" \
  > "$RUNNER_TEMP/govpre08-step3-explorer-blocks-$tag-$phase.json"
curl -fsS --max-time 3 "$base/" \
  > "$RUNNER_TEMP/govpre08-step3-explorer-html-$tag-$phase.html"
if curl -fsS --max-time 3 "$wrong/v1/ready" >/dev/null 2>&1; then
  echo "Wrong-network 420Explorer incorrectly admitted synthetic chain 31337" >&2
  exit 1
fi
curl -sS --max-time 3 "$wrong/v1/ready" \
  > "$RUNNER_TEMP/govpre08-step3-explorer-wrong-$tag-$phase.json"
python3 - <<'PY'
import json,os,urllib.request
from pathlib import Path
p=Path(os.environ["RUNNER_TEMP"])
tag=os.environ["GOV_PRE_08_GO_EXPLORER_TAG"]
phase=os.environ["GOV_PRE_08_GO_EXPLORER_PHASE"]
base=os.environ["GOV_PRE_08_GO_EXPLORER_BASE"]
def report(s):
    return json.loads((p/f"govpre08-step3-explorer-{s}-{tag}-{phase}.json").read_text())
ready,status,blocks,cap,wrong=[report(s) for s in
    ("ready","status","blocks","capabilities","wrong")]
assert ready["ready"] and ready["status"]["chainId"]==31337
assert status["chainId"]==31337 and status["ready"] and status["finalizedHeight"]==0
assert len(blocks["blocks"])==5 and blocks["meta"]["chainId"]==31337
assert not cap["canonicalAuthority"] and cap["dataSource"]=="420Indexer"
assert not wrong["ready"] and wrong["status"]["wrongChain"]
assert (p/f"govpre08-step3-explorer-html-{tag}-{phase}.html").stat().st_size>200
graph=json.loads((p/f"govpre08-step3-graph-{tag}.json").read_text())
head=status["headHeight"]
def get(route):
    req=urllib.request.Request(base+route)
    with urllib.request.urlopen(req,timeout=5) as resp:
        assert resp.headers["X-420-Canonical-Authority"]=="false"
        return json.load(resp)
# Go Explorer enforces authentic consensus producer provenance for every
# NON-genesis block. Synthetic Anvil has none: the correct result is a denial,
# NOT a manufactured consensus root. Genesis has no producer and is readable.
b=get("/v1/blocks/0")
assert b["block"]["chainId"]==31337 and b["block"]["number"]==0 and b["trace"]==None if "trace" in b else b["block"]["number"]==0
try:
    get(f"/v1/blocks/{head}")
    raise AssertionError("unattributed Anvil block incorrectly presented as certified")
except urllib.error.HTTPError as err:
    body=err.read().decode()
    assert err.code>=400 and "historical producer provenance" in body,body
tx=graph["txReceipts"][0]["tx"]
t=get("/v1/transactions/"+tx)
assert t["transaction"]["hash"].lower()==tx.lower()
assert t["receipt"]["transactionHash"].lower()==tx.lower()
service=graph["serviceDiscoveries"]["TREASURY"]["id"]
sv=get(f"/v1/services/{service}/versions/1")
assert sv["serviceId"].lower()==service.lower() and sv["version"]==1
assert sv["implementation"].lower()==graph["serviceDiscoveries"]["TREASURY"]["address"].lower()
out={
 "schema":"GOV_PRE_08_STEP3_REAL_RUNNING_GO_EXPLORER_POSTGRES_V1",
 "phase":phase,"chainId":31337,"sourceGitHead":graph["sourceGitHead"],
 "graphSourceDigest":graph["deterministicGraphDigestSha256"],
 "realGoExplorerProcess":True,"realPostgresIndexerSource":True,
 "actualExplorerHtmlServed":True,"actualIndexedBlocksAndTransactionRead":True,
 "actualRegistryServiceVersionRecovered":True,
 "nonGenesisWithoutRealConsensusProducerDenied":True,
 "genesisDetailWithNoProducerAllowed":True,
 "wrongChainBlocked":True,"canonicalAuthority":False,
 "syntheticBftFinality":False,"productionDeploymentApproved":False,
 "explorerIndexedHead":head,
 "remainingProductionApiCompatibility":True
}
with (p/f"govpre08-step3-explorer-report-{tag}-{phase}.json").open("x") as f:
    json.dump(out,f,sort_keys=True,indent=2);f.write("\n")
print("GOV_PRE_08_STEP3_REAL_RUNNING_GO_EXPLORER_POSTGRES="+phase.upper()+"_PASS",head)
PY
