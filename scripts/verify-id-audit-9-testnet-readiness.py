#!/usr/bin/env python3
import json
import pathlib
import sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
MANIFEST=ROOT/"developer-hub/manifests/testnet.json"
RUNNER=ROOT/"420-indexer/scripts/qualify-identity-testnet.mjs"
MODULE=ROOT/"420-indexer/src/identity-testnet-qualification.ts"
TEST=ROOT/"420-indexer/test/identity-testnet-qualification.test.ts"
WORKFLOW=ROOT/".github/workflows/identity-live-testnet.yml"
EVIDENCE=ROOT/"docs/audit/ID-AUDIT-9-LIVE-TESTNET-EVIDENCE.json"
ENDPOINTS=ROOT/"testnet/services/endpoints.json"
LAUNCH=ROOT/"testnet/config/launch.json"
PREDEPLOY=ROOT/"contracts/config/predeploy/Identity420-predeploy-state.json"

errors=[]

def fail(msg): errors.append(msg)
def load(path):
    try: return json.loads(path.read_text())
    except Exception as exc:
        fail(f"{path.relative_to(ROOT)} invalid JSON: {exc}")
        return {}

for p in [RUNNER,MODULE,TEST,WORKFLOW,ENDPOINTS,LAUNCH,PREDEPLOY]:
    if not p.exists(): fail(f"missing ID-AUDIT-9 prerequisite: {p.relative_to(ROOT)}")

runner=RUNNER.read_text() if RUNNER.exists() else ""
module=MODULE.read_text() if MODULE.exists() else ""
workflow=WORKFLOW.read_text() if WORKFLOW.exists() else ""

for marker in [
    "provider.getNetwork","provider.getCode","provider.getStorage","systemName","protocolVersion",
    "governanceTimelock","credentialValid","createIdentity420Client",
    "/v1/protocols/events","/v1/resolve","/v1/transactions/",
    "issuerDeactivateTx","issuerReactivateTx","evidenceDraft",
]:
    if marker not in runner: fail(f"live runner missing {marker}")

for marker in [
    "IDENTITY_RUNTIME_HASH_420","validateIdentityOfficialTestnetManifest420",
    "validateIdentityReadEvidence420","validateIdentityLifecycleEvidence420",
    "validateIdentityServiceEvidence420","validateIdentityRecoveryEvidence420",
    "validateIdentityLiveTestnetEvidence420",
]:
    if marker not in module: fail(f"evidence contract missing {marker}")

for marker in [
    "workflow_dispatch","manifest_path","evidence_draft_path",
    "qualify-identity-testnet.mjs","identity-audit-9-live-testnet",
]:
    if marker not in workflow: fail(f"live workflow missing {marker}")

predeploy=load(PREDEPLOY)
if str(predeploy.get("address","")).lower()!="0x0000000000000000000000000000000000000436":
    fail("Identity predeploy address drift")
if str(predeploy.get("runtimeCodeHash","")).lower()!="0xda0fcd565d7aea6590b3e0ec468f7b99af50138b62527e770ca367a57e6cfd86":
    fail("Identity retained runtime hash drift")

launch=load(LAUNCH)
endpoints=load(ENDPOINTS)

if MANIFEST.exists():
    manifest=load(MANIFEST)
    if manifest.get("network",{}).get("environment")!="testnet":
        fail("official testnet manifest exists but environment is not testnet")
    rpc=manifest.get("rpc",{}).get("http",[])
    if not rpc or any(not isinstance(v,str) or not v.startswith("https://") or "REPLACE_" in v or "PLACEHOLDER" in v for v in rpc):
        fail("official testnet manifest RPC is absent/insecure/placeholder")
    services=manifest.get("services",{})
    for name in ("indexer","search","explorer"):
        value=services.get(name)
        if not isinstance(value,str) or not value.startswith("https://") or "REPLACE_" in value or "PLACEHOLDER" in value:
            fail(f"official testnet manifest {name} endpoint absent/insecure/placeholder")
    identity=manifest.get("contracts",{}).get("Identity420",{}).get("address","")
    if str(identity).lower()!="0x0000000000000000000000000000000000000436":
        fail("official testnet manifest Identity420 address mismatch")
    if not EVIDENCE.exists():
        fail("official testnet manifest exists but ID-AUDIT-9 live evidence is not retained")
    else:
        evidence=load(EVIDENCE)
        if evidence.get("status")!="PASS" or evidence.get("phase")!="ID-AUDIT-9":
            fail("retained ID-AUDIT-9 evidence is not PASS")
        if evidence.get("manifestPath")=="developer-hub/manifests/local.example.json":
            fail("retained live evidence references local example manifest")
else:
    if EVIDENCE.exists():
        fail("live ID-AUDIT-9 evidence exists without an official testnet manifest")
    chain=launch.get("chain_id",{})
    if chain.get("status")=="FROZEN":
        fail("launch metadata claims frozen chain ID while official testnet manifest is absent")
    raw=json.dumps(endpoints)
    if "PLACEHOLDER" not in raw and "REPLACE_WITH_" not in raw and "REPLACE" not in raw:
        fail("public endpoints appear resolved but official testnet manifest is absent")

if errors:
    for e in errors: print("ERROR:",e,file=sys.stderr)
    raise SystemExit(1)

if MANIFEST.exists():
    print("ID_AUDIT_9_READINESS=LIVE_EVIDENCE_RETAINED")
else:
    print("ID_AUDIT_9_READINESS=BLOCKED_OFFICIAL_TESTNET_MANIFEST")
    print("liveQualificationComplete=false")
print("runner=420-indexer/scripts/qualify-identity-testnet.mjs")
print("workflow=.github/workflows/identity-live-testnet.yml")
