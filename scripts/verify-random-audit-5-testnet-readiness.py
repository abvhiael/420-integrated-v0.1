#!/usr/bin/env python3
import json, pathlib, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
PROTOCOL=ROOT/"config/protocol.json"
CHAIN=ROOT/"testnet/public/metadata/chain.json"
ENDPOINTS=ROOT/"testnet/services/endpoints.json"
BUNDLE=ROOT/"contracts/config/randomness/random-audit-4-deployment-bundle.json"
DESCRIPTOR=ROOT/"420-indexer/descriptors/randomness-v1.json"
RUNNER=ROOT/"scripts/qualify-randomness-testnet.py"
LIVE_WORKFLOW=ROOT/".github/workflows/randomness-live-testnet.yml"
TEMPLATE=ROOT/"docs/audit/RANDOM-AUDIT-5-LIVE-EVIDENCE-DRAFT.example.json"
PASS_EVIDENCE=ROOT/"docs/audit/RANDOM-AUDIT-5-LIVE-TESTNET-EVIDENCE.json"

errors=[]
def fail(x): errors.append(x)
def load(p):
    try: return json.loads(p.read_text())
    except Exception as exc:
        fail(f"{p.relative_to(ROOT)} invalid JSON: {exc}")
        return {}

for p in [PROTOCOL,CHAIN,ENDPOINTS,BUNDLE,DESCRIPTOR,RUNNER,LIVE_WORKFLOW,TEMPLATE]:
    if not p.exists(): fail(f"missing RANDOM-AUDIT-5 prerequisite: {p.relative_to(ROOT)}")

protocol=load(PROTOCOL)
chain=load(CHAIN)
endpoints=load(ENDPOINTS)
bundle=load(BUNDLE)
descriptor=load(DESCRIPTOR)
runner=RUNNER.read_text() if RUNNER.exists() else ""
workflow=LIVE_WORKFLOW.read_text() if LIVE_WORKFLOW.exists() else ""

if bundle.get("step")!="RANDOM-AUDIT-4" or bundle.get("repository_ready") is not True:
    fail("RANDOM-AUDIT-4 deployment bundle not repository-ready")
if bundle.get("live_qualified") is not False:
    fail("RANDOM-AUDIT-4 bundle falsely claims live qualification")
if descriptor.get("schema")!="420-randomness-release-descriptor-v1":
    fail("Randomness Indexer descriptor missing or invalid")

for marker in [
    "eth_chainId","eth_getBlockByNumber","eth_getCode","eth_getTransactionReceipt",
    "randomnessRouter()(address)","routeRegistry()(address)","profileRegistry()(address)",
    "RANDOM_AUDIT_5_LIVE_QUALIFICATION=PASS"
]:
    if marker not in runner: fail("live runner missing "+marker)
for marker in ["workflow_dispatch","evidence_draft_path","qualify-randomness-testnet.py","random-audit-5-live-testnet"]:
    if marker not in workflow: fail("live workflow missing "+marker)

step5=protocol.get("step5",{})
public_live=step5.get("public_testnet_live")
raw_chain=json.dumps(chain)
raw_endpoints=json.dumps(endpoints)
placeholders=(
    "REPLACE_WITH_" in raw_chain or "REPLACE_FROM_" in raw_chain or "PLACEHOLDER" in raw_chain or
    "REPLACE_WITH_" in raw_endpoints or "PLACEHOLDER" in raw_endpoints
)
candidate_only=chain.get("chain_id_status")!="FROZEN"

if public_live is True and not placeholders and not candidate_only:
    if not PASS_EVIDENCE.exists():
        fail("public testnet appears live/frozen but RANDOM-AUDIT-5 PASS evidence is missing")
    else:
        evidence=load(PASS_EVIDENCE)
        if evidence.get("phase")!="RANDOM-AUDIT-5" or evidence.get("status")!="PASS":
            fail("retained RANDOM-AUDIT-5 evidence is not PASS")
        if evidence.get("repositorySha") in (None,"","REPLACE_EXACT_RELEASE_SHA"):
            fail("retained RANDOM-AUDIT-5 evidence lacks exact release SHA")
else:
    if PASS_EVIDENCE.exists():
        fail("RANDOM-AUDIT-5 PASS evidence exists while public testnet is not live/frozen")
    if public_live is True:
        fail("protocol claims public_testnet_live while metadata/endpoints remain placeholder/candidate")
    if not placeholders:
        fail("public-testnet metadata/endpoints appear resolved while protocol does not declare live")
    if not candidate_only:
        fail("chain metadata claims frozen identity while public testnet is not live")

if errors:
    for e in errors: print("ERROR:",e,file=sys.stderr)
    raise SystemExit(1)

if public_live is True and not placeholders and not candidate_only:
    print("RANDOM_AUDIT_5_READINESS=LIVE_EVIDENCE_RETAINED")
    print("liveQualificationComplete=true")
else:
    print("RANDOM_AUDIT_5_READINESS=BLOCKED_PUBLIC_TESTNET_NOT_LIVE")
    print("liveQualificationComplete=false")
    print(f"public_testnet_live={public_live}")
    print(f"chain_id_status={chain.get('chain_id_status')}")
