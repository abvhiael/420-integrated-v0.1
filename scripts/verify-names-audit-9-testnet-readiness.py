#!/usr/bin/env python3
import json
import pathlib
import re
import sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
MANIFEST=ROOT/"developer-hub/manifests/testnet.json"
RUNNER=ROOT/"420-indexer/scripts/qualify-names-testnet.mjs"
MODULE=ROOT/"420-indexer/src/names-testnet-qualification.ts"
TEST=ROOT/"420-indexer/test/names-testnet-qualification.test.ts"
WORKFLOW=ROOT/".github/workflows/names-live-testnet.yml"
EVIDENCE=ROOT/"docs/audit/420NAMES-AUDIT-9-LIVE-TESTNET-EVIDENCE.json"
ENDPOINTS=ROOT/"testnet/services/endpoints.json"
LAUNCH=ROOT/"testnet/config/launch.json"

errors=[]

def fail(msg): errors.append(msg)
def load(path):
    try: return json.loads(path.read_text())
    except Exception as exc:
        fail(f"{path.relative_to(ROOT)} invalid JSON: {exc}")
        return {}

for p in [RUNNER,MODULE,TEST,WORKFLOW,ENDPOINTS,LAUNCH]:
    if not p.exists(): fail(f"missing NAMES-AUDIT-9 prerequisite: {p.relative_to(ROOT)}")

runner=RUNNER.read_text() if RUNNER.exists() else ""
module=MODULE.read_text() if MODULE.exists() else ""
workflow=WORKFLOW.read_text() if WORKFLOW.exists() else ""
for marker in [
    "eth_chainId","getStorage","resolveActive","createNames420Client",
    "NameTransferred","NAMES_TESTNET_OWNER_PRIVATE_KEY",
    "NAMES_TESTNET_RECIPIENT_PRIVATE_KEY","/v1/protocols/events","/v1/resolve"
]:
    if marker not in runner: fail(f"live runner missing {marker}")
for marker in [
    "NAMES_RUNTIME_HASH_420","validateNamesOfficialTestnetManifest420",
    "validateNamesReadEvidence420","validateNamesWorkflowEvidence420",
    "validateNamesServiceEvidence420","validateNamesLiveTestnetEvidence420"
]:
    if marker not in module: fail(f"evidence contract missing {marker}")
for marker in ["workflow_dispatch","manifest_path","search_url","NAMES_TESTNET_OWNER_PRIVATE_KEY","NAMES_TESTNET_RECIPIENT_PRIVATE_KEY","qualify-names-testnet.mjs"]:
    if marker not in workflow: fail(f"live workflow missing {marker}")

launch=load(LAUNCH)
endpoints=load(ENDPOINTS)
if MANIFEST.exists():
    manifest=load(MANIFEST)
    if manifest.get("network",{}).get("environment")!="testnet":
        fail("official testnet manifest exists but environment is not testnet")
    rpc=manifest.get("rpc",{}).get("http",[])
    if not rpc or any(not isinstance(v,str) or not v.startswith("https://") or "REPLACE_" in v for v in rpc):
        fail("official testnet manifest RPC is absent/insecure/placeholder")
    for name in ("Names420","ProtocolRegistry"):
        if name not in manifest.get("contracts",{}): fail(f"official testnet manifest missing {name}")
    if not EVIDENCE.exists():
        fail("official testnet manifest exists but NAMES-AUDIT-9 live evidence is not retained")
    else:
        evidence=load(EVIDENCE)
        if evidence.get("status")!="PASS" or evidence.get("phase")!="NAMES-AUDIT-9":
            fail("retained NAMES-AUDIT-9 evidence is not PASS")
else:
    if EVIDENCE.exists():
        fail("live NAMES-AUDIT-9 evidence exists without an official testnet manifest")
    chain=launch.get("chain_id",{})
    if chain.get("status")=="FROZEN":
        fail("launch metadata claims frozen chain ID while official testnet manifest is absent")
    raw=json.dumps(endpoints)
    if "PLACEHOLDER" not in raw and "REPLACE_WITH_" not in raw:
        fail("public endpoints appear resolved but official testnet manifest is absent")

if errors:
    for e in errors: print("ERROR:",e,file=sys.stderr)
    raise SystemExit(1)

if MANIFEST.exists():
    print("NAMES_AUDIT_9_READINESS=LIVE_EVIDENCE_RETAINED")
else:
    print("NAMES_AUDIT_9_READINESS=BLOCKED_OFFICIAL_TESTNET_MANIFEST")
    print("liveQualificationComplete=false")
print("runner=420-indexer/scripts/qualify-names-testnet.mjs")
print("workflow=.github/workflows/names-live-testnet.yml")
