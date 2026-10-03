#!/usr/bin/env python3
import json, pathlib, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
PROTOCOL=ROOT/"config/protocol.json"
CHAIN=ROOT/"testnet/public/metadata/chain.json"
PACKAGE=ROOT/"contracts/config/pay/pay-audit-6-deployment-package.json"
WIRING=ROOT/"contracts/config/420pay-genesis-wiring.json"
RUNNER=ROOT/"scripts/qualify-420pay-testnet.py"
LIVE_WORKFLOW=ROOT/".github/workflows/420pay-live-testnet.yml"
TEMPLATE=ROOT/"docs/audit/420PAY-AUDIT-7-LIVE-EVIDENCE-DRAFT.example.json"
PASS_EVIDENCE=ROOT/"docs/audit/420PAY-AUDIT-7-LIVE-TESTNET-EVIDENCE.json"

errors=[]
def fail(x): errors.append(x)
def load(p):
    try: return json.loads(p.read_text())
    except Exception as exc:
        fail(f"{p.relative_to(ROOT)} invalid JSON: {exc}"); return {}

for p in [PROTOCOL,CHAIN,PACKAGE,WIRING,RUNNER,LIVE_WORKFLOW,TEMPLATE]:
    if not p.exists(): fail(f"missing PAY-AUDIT-7 prerequisite: {p.relative_to(ROOT)}")

protocol=load(PROTOCOL); chain=load(CHAIN); package=load(PACKAGE); wiring=load(WIRING)
workflow=LIVE_WORKFLOW.read_text() if LIVE_WORKFLOW.exists() else ""
runner=RUNNER.read_text() if RUNNER.exists() else ""

for marker in ["eth_chainId","eth_getBlockByNumber","eth_getCode","eth_getTransactionReceipt","PAY_AUDIT_7_LIVE_QUALIFICATION=PASS"]:
    if marker not in runner: fail("live runner missing "+marker)
for marker in ["workflow_dispatch","evidence_draft_path","qualify-420pay-testnet.py","pay-audit-7-live-testnet"]:
    if marker not in workflow: fail("live workflow missing "+marker)

if package.get("status")!="REPOSITORY_READY_LIVE_DEPLOYMENT_PENDING" or package.get("repository_ready") is not True:
    fail("PAY-AUDIT-6 repository package not ready")
if package.get("live_qualified") is not False:
    fail("PAY-AUDIT-6 package falsely claims live qualification")
if wiring.get("deployment_binding_verified") is not False:
    fail("420Pay wiring falsely claims live deployment binding")
if wiring.get("pay_audit_6_status")!="COMPLETE":
    fail("PAY-AUDIT-6 wiring status not complete")

step5=protocol.get("step5",{})
public_live=step5.get("public_testnet_live")
raw_chain=json.dumps(chain)
placeholders=("REPLACE_WITH_" in raw_chain or "REPLACE_FROM_" in raw_chain or "PLACEHOLDER" in raw_chain)
candidate_only=chain.get("chain_id_status")!="FROZEN"

if public_live is True and not placeholders and not candidate_only:
    if not PASS_EVIDENCE.exists():
        fail("public testnet appears live/frozen but PAY-AUDIT-7 PASS evidence is missing")
    else:
        e=load(PASS_EVIDENCE)
        if e.get("phase")!="PAY-AUDIT-7" or e.get("status")!="PASS":
            fail("retained PAY-AUDIT-7 evidence is not PASS")
        if e.get("repositorySha") in (None,"","REPLACE_EXACT_RELEASE_SHA"):
            fail("retained PAY-AUDIT-7 evidence lacks exact release SHA")
else:
    if PASS_EVIDENCE.exists():
        fail("PAY-AUDIT-7 PASS evidence exists while public testnet is not live/frozen")
    if public_live is True:
        fail("protocol claims public_testnet_live while public metadata is placeholder/candidate")
    if not placeholders:
        fail("public-testnet endpoints/genesis appear resolved while protocol does not declare live")
    if not candidate_only:
        fail("chain metadata claims frozen identity while public testnet is not live")

if errors:
    for e in errors: print("ERROR:",e,file=sys.stderr)
    raise SystemExit(1)

if public_live is True and not placeholders and not candidate_only:
    print("PAY_AUDIT_7_READINESS=LIVE_EVIDENCE_RETAINED")
    print("liveQualificationComplete=true")
else:
    print("PAY_AUDIT_7_READINESS=BLOCKED_PUBLIC_TESTNET_NOT_LIVE")
    print("liveQualificationComplete=false")
    print(f"public_testnet_live={public_live}")
    print(f"chain_id_status={chain.get('chain_id_status')}")
