#!/usr/bin/env python3
import json
import pathlib
import sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
QUAL=ROOT/"contracts/config/swap/swap-audit-8-testnet-qualification.json"
AUDIT7=ROOT/"contracts/config/swap/swap-audit-7-deployment-binding.json"
LAUNCH=ROOT/"testnet/config/launch.json"
ENDPOINTS=ROOT/"testnet/services/endpoints.json"
OFFICIAL=ROOT/"developer-hub/manifests/testnet.json"
EVIDENCE=ROOT/"docs/audit/SWAP-AUDIT-8-LIVE-TESTNET-EVIDENCE.json"
EXCHANGE_WORKFLOW=ROOT/".github/workflows/exchange-testnet-swap.yml"
EXCHANGE_RUNNER=ROOT/"exchange/web/scripts/live-swap-qualify.mjs"
EXCHANGE_MODULE=ROOT/"exchange/web/core/live-swap-qualification.js"
EXCHANGE_TEST=ROOT/"exchange/web/test/live-swap-qualification.test.js"
WALLET_WORKFLOW=ROOT/".github/workflows/wallet-live-testnet.yml"
WALLET_RUNNER=ROOT/"wallet/web/scripts/qualify-live-testnet.mjs"
PAY_TEST=ROOT/"contracts/test/PaySwapGenesisIntegration420.t.sol"

errors=[]

def fail(msg): errors.append(msg)

def load(path):
    try: return json.loads(path.read_text())
    except Exception as exc:
        fail(f"{path.relative_to(ROOT)} invalid JSON: {exc}")
        return {}

for p in [QUAL,AUDIT7,LAUNCH,ENDPOINTS,EXCHANGE_WORKFLOW,EXCHANGE_RUNNER,EXCHANGE_MODULE,EXCHANGE_TEST,WALLET_WORKFLOW,WALLET_RUNNER,PAY_TEST]:
    if not p.exists(): fail(f"missing SWAP-AUDIT-8 prerequisite: {p.relative_to(ROOT)}")

q=load(QUAL)
if q.get("schema")!="420-swap-audit-8-testnet-qualification-v1": fail("qualification schema drift")
if q.get("phase")!="SWAP-AUDIT-8": fail("phase drift")
if q.get("repository_ready") is not True: fail("repository readiness not declared")
if q.get("live_qualified") is not False and not EVIDENCE.exists(): fail("live qualification claimed without retained evidence")

required_ids={"SUCCESS","SLIPPAGE","STALE_QUOTE_ORACLE","WRONG_CHAIN","DISABLED_MARKET","REPLAY","REORG_RECOVERY","PAY_COMPOSITION"}
journeys=q.get("journeys",[])
ids={x.get("id") for x in journeys}
if ids!=required_ids: fail(f"journey inventory drift: {sorted(ids)}")
for item in journeys:
    if item.get("required") is not True: fail(f"{item.get('id')} not required")
    if not item.get("requirement"): fail(f"{item.get('id')} requirement missing")

audit7=load(AUDIT7)
if audit7.get("repository_ready") is not True: fail("SWAP-AUDIT-7 repository binding not qualified")
if audit7.get("status")!="REPOSITORY_QUALIFIED_LIVE_TESTNET_DEFERRED": fail("SWAP-AUDIT-7 status drift")
if audit7.get("live_qualified") is not False: fail("SWAP-AUDIT-7 falsely claims live qualification")

exchange_workflow=EXCHANGE_WORKFLOW.read_text() if EXCHANGE_WORKFLOW.exists() else ""
exchange_runner=EXCHANGE_RUNNER.read_text() if EXCHANGE_RUNNER.exists() else ""
exchange_module=EXCHANGE_MODULE.read_text() if EXCHANGE_MODULE.exists() else ""
exchange_test=EXCHANGE_TEST.read_text() if EXCHANGE_TEST.exists() else ""
wallet_workflow=WALLET_WORKFLOW.read_text() if WALLET_WORKFLOW.exists() else ""
wallet_runner=WALLET_RUNNER.read_text() if WALLET_RUNNER.exists() else ""
pay_test=PAY_TEST.read_text() if PAY_TEST.exists() else ""

for marker in ["workflow_dispatch","qualify-live-swap","EXCHANGE_TESTNET_MANIFEST_JSON","EXCHANGE_TESTNET_SWAP_FIXTURE_JSON","live-swap-qualify.mjs"]:
    if marker not in exchange_workflow: fail(f"Exchange live workflow missing {marker}")
for marker in ["resolved testnet runtime required","EXCHANGE_TESTNET_MANIFEST","EXCHANGE_TESTNET_SWAP_FIXTURE","GITHUB_SHA"]:
    if marker not in exchange_runner: fail(f"Exchange live runner missing {marker}")
for marker in ["REORGED","DROPPED","FINALIZED","inspectAndReconcileTransaction","TESTNET_RUNTIME_REQUIRED"]:
    if marker not in exchange_module: fail(f"Exchange live module missing {marker}")
for marker in ["reorged","reverted receipt","V13/RPC conflict","qualifies a live swap"]:
    if marker not in exchange_test: fail(f"Exchange live test missing {marker}")
for marker in ["workflow_dispatch","qualify-wallet-testnet","qualify:testnet","manifest_path","minimum_block_number"]:
    if marker not in wallet_workflow: fail(f"Wallet live workflow missing {marker}")
for marker in ["eth_chainId","eth_blockNumber","eth_getCode","Explorer","Faucet","environment === 'testnet'"]:
    if marker not in wallet_runner: fail(f"Wallet live runner missing {marker}")
for marker in ["PaymentRouter420","CanonicalSettlementAdapter420","CanonicalSwapExecutor420"]:
    if marker not in pay_test: fail(f"Pay/Swap retained integration missing {marker}")

launch=load(LAUNCH)
endpoints=load(ENDPOINTS)
official_exists=OFFICIAL.exists()

if official_exists:
    manifest=load(OFFICIAL)
    if manifest.get("network",{}).get("environment")!="testnet": fail("official testnet manifest is not testnet")
    rpc=manifest.get("rpc",{}).get("http",[])
    if not rpc or any(not isinstance(v,str) or not v.startswith("https://") or "REPLACE" in v or "PLACEHOLDER" in v for v in rpc):
        fail("official testnet RPC absent/insecure/placeholder")
    for svc in ("explorer","faucet"):
        value=manifest.get("services",{}).get(svc)
        if not isinstance(value,str) or not value.startswith("https://") or "REPLACE" in value or "PLACEHOLDER" in value:
            fail(f"official testnet {svc} absent/insecure/placeholder")
    if not EVIDENCE.exists():
        fail("official testnet manifest exists but SWAP-AUDIT-8 live evidence is absent")
    else:
        ev=load(EVIDENCE)
        if ev.get("phase")!="SWAP-AUDIT-8" or ev.get("status")!="PASS":
            fail("retained SWAP-AUDIT-8 evidence is not PASS")
        ev_ids={x.get("id") for x in ev.get("journeys",[]) if x.get("status")=="PASS"}
        if ev_ids!=required_ids: fail("not every required live journey is retained as PASS")
else:
    if EVIDENCE.exists(): fail("live Swap evidence exists without official testnet manifest")
    if q.get("status")!="BLOCKED_OFFICIAL_TESTNET_NOT_LIVE": fail("qualification state does not fail closed while official testnet is absent")
    if q.get("live_qualified") is not False: fail("live qualification overclaimed while official testnet is absent")
    exact=q.get("exact_release_candidate",{})
    for key in ("implementation_sha","chain_id","evidence_block","evidence_block_hash"):
        if exact.get(key) is not None: fail(f"fabricated live release evidence: {key}")
    deployment=q.get("deployment_evidence",{})
    for key in ("protocol_registry_address","protocol_registry_code_hash","canonical_swap_executor_address","canonical_swap_executor_code_hash","canonical_market_registry_address","canonical_pool_address","canonical_pool_code_hash","payment_router_address","settlement_adapter_address"):
        if deployment.get(key) is not None: fail(f"fabricated deployed evidence: {key}")
    for key in ("registry_transactions","binding_transactions"):
        if deployment.get(key)!=[]: fail(f"fabricated live transactions: {key}")
    for item in journeys:
        if item.get("status")!="PENDING_LIVE_TESTNET" or item.get("evidence") is not None:
            fail(f"{item.get('id')} overclaims live evidence")
    wf=q.get("live_workflow_runs",{})
    if wf.get("wallet") is not None or wf.get("exchange_swap") is not None:
        fail("fabricated live workflow run IDs")
    if launch.get("chain_id",{}).get("status")=="FROZEN":
        fail("launch config claims frozen chain ID while official testnet manifest is absent")
    if "NOT YET AUTHORIZED" not in (ROOT/"docs/STEP-5-TESTNET-LAUNCH.md").read_text():
        fail("testnet launch authority no longer states not authorized")
    if "TESTNET NOT DECLARED LIVE" not in (ROOT/"docs/STEP-5.4-PUBLIC-TESTNET.md").read_text():
        fail("public-testnet authority no longer states not live")
    raw=json.dumps(endpoints)
    if "PLACEHOLDER" not in raw and "REPLACE_WITH_" not in raw:
        fail("public testnet endpoints appear resolved while official manifest is absent")

if errors:
    for e in errors: print("ERROR:",e,file=sys.stderr)
    raise SystemExit(1)

if official_exists:
    print("SWAP_AUDIT_8_READINESS=LIVE_EVIDENCE_RETAINED")
    print("liveQualificationComplete=true")
else:
    print("SWAP_AUDIT_8_READINESS=BLOCKED_OFFICIAL_TESTNET_NOT_LIVE")
    print("liveQualificationComplete=false")
print("exchangeWorkflow=.github/workflows/exchange-testnet-swap.yml")
print("walletWorkflow=.github/workflows/wallet-live-testnet.yml")
print("requiredJourneys="+str(len(required_ids)))
