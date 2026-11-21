#!/usr/bin/env python3
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
errors=[]
def need(cond,msg):
    if not cond: errors.append(msg)
def read(path): return (ROOT/path).read_text(encoding="utf-8")

required=[
"launchpad/web/package.json","launchpad/web/runtime-config.json","launchpad/web/index.html","launchpad/web/styles.css",
"launchpad/web/app.js","launchpad/web/core/config.js","launchpad/web/core/service.js","launchpad/web/core/wallet.js",
"launchpad/web/scripts/build.mjs","launchpad/web/scripts/check.mjs","launchpad/web/core/creator.js",
"launchpad/service/package.json","launchpad/service/server.mjs","launchpad/service/core/abi.mjs",
"launchpad/service/core/rpc.mjs","launchpad/service/core/projection.mjs","launchpad/service/core/planner.mjs","launchpad/service/core/app.mjs",
"launchpad/service/core/creator.mjs","launchpad/service/core/creator-queue.mjs","launchpad/service/core/creator-report.mjs"
]
for p in required: need((ROOT/p).is_file(),f"missing Audit-5 file: {p}")

cfg=json.loads(read("launchpad/web/runtime-config.json"))
need(cfg.get("schema")=="420-launchpad-web-runtime-v1","web runtime schema drift")
need(cfg.get("registry",{}).get("protocolRegistryAddress")=="0x0000000000000000000000000000000000000434","ProtocolRegistry authority drift")
need(cfg.get("registry",{}).get("serviceId")=="420/service/launchpad/v1","Launchpad service ID drift")
need(cfg.get("execution",{}).get("status")=="DISABLED_UNTIL_CANONICAL_RUNTIME_RESOLVED","execution must default fail-closed")
for key in ("requireWalletChainMatch","requireRegistryResolution","requireCanonicalProjectionProvenance"):
    need(cfg.get("execution",{}).get(key) is True,f"missing execution gate {key}")

html=read("launchpad/web/index.html")
for token in ("campaign-grid","detail","participant-state","contribution-amount","payment-id","delivery-commitment","refund-commitment","creator-form","review-gate","aria-live","Skip to content"):
    need(token in html,f"UI requirement missing: {token}")
need("Registration is not endorsement" in html,"Launchpad risk disclosure missing")
for mode in ("REWARD","DONATION","COMMUNITY_PROJECT","PRODUCT_PREORDER"):
    need(mode in html,f"approved campaign mode missing from creator UI: {mode}")

css=read("launchpad/web/styles.css")
need("@media(max-width:720px)" in css,"responsive baseline missing")
need("prefers-reduced-motion" in css,"reduced-motion accessibility baseline missing")
need(":focus" in css,"keyboard focus baseline missing")

app=read("launchpad/web/app.js")
for token in ("loadCampaigns","openCampaign","connectWallet","prepare('contribute'","prepare('claim'","prepare('refund'","submitReviewedTransaction","service.runtime()"):
    need(token in app,f"browser workflow missing: {token}")
creator_ui=read("launchpad/web/core/creator.js")
creator_api=read("launchpad/service/core/creator.mjs")
creator_queue=read("launchpad/service/core/creator-queue.mjs")
creator_report=read("launchpad/service/core/creator-report.mjs")
need("new CreatorStudio(" in app and "creatorPrepare(" in creator_ui and "creatorSubmit(" in creator_ui,
    "creator wizard/governance workflow missing")
need("Creator governance request prepared" in creator_ui and "requiresGovernance:true" in creator_api,
    "creator governance authority boundary missing")
need("verifyCreatorSignature" in creator_queue and "isValidSignature(bytes32,bytes)" in creator_queue and
    "eth_getCode" in creator_queue and "RECEIVED_FOR_GOVERNANCE_REVIEW" in creator_queue,
    "signed governance request queue cannot authenticate Wallet or retain review-only status")
need("readSale" in creator_report and "project(bytes32)" in creator_report and
    "reconciledSaleRefundPrincipal(bytes32)" in creator_report and "eth_getLogs" in creator_report,
    "creator reporting lacks owner-verified canonical chain evidence")
need("service.prepare('creator'" not in app and "eth_sendTransaction" not in creator_ui,
    "creator flow must not masquerade as direct transaction")

service=read("launchpad/service/core/service.js") if (ROOT/"launchpad/service/core/service.js").exists() else ""
rpc=read("launchpad/service/core/rpc.mjs")
planner=read("launchpad/service/core/planner.mjs")
projection=read("launchpad/service/core/projection.mjs")
server=read("launchpad/service/server.mjs")
for token in ("resolveActive(bytes32)","sales()","allocations()","crowdfundingIntegration()","projects()"):
    need(token in rpc,f"canonical discovery missing: {token}")
for token in ("contributed(bytes32,address)","claimed(bytes32,address)","refunded(bytes32,address)","contribute(bytes32,uint128,bytes32)","claim(bytes32,bytes32)","prepareRefund(bytes32)","recordRefund(bytes32,bytes32)"):
    need(token in planner,f"participant workflow binding missing: {token}")
need("requiresGovernance:true" in planner,"creator request must retain governance authority")
need("transaction" not in planner.split("export function creatorRequest",1)[1].split("}",1)[0],"creator request unexpectedly exposes direct transaction")
need("420-launchpad-projection-v1" in projection and "canonical!==true" in projection,"projection provenance enforcement missing")
need("payload too large" in server,"service request-size bound missing")

webtests=list((ROOT/"launchpad/web/test").glob("*.test.js"))
svctests=list((ROOT/"launchpad/service/test").glob("*.test.mjs"))
need(len(webtests)>=3,"insufficient web Audit-5 tests")
need(len(svctests)>=3,"insufficient service Audit-5 tests")
tests="\n".join(p.read_text() for p in webtests+svctests)
for token in ("WRONG_NETWORK","UNEXPECTED_TRANSACTION_TARGET","canonical provenance","creator workflow remains a governance request","canonical Registry resolution derives Launchpad contract graph","participant transaction planner binds exact canonical targets"):
    need(token in tests,f"Audit-5 test coverage missing: {token}")

need("demo" not in app.lower(),"Audit-5 UI must not contain a demo execution path")
need("fixture" not in app.lower(),"Audit-5 UI must not contain a fixture execution path")
need("eth_sendTransaction" in read("launchpad/web/core/wallet.js"),"wallet submission path missing")
need("eth_sendTransaction" not in server,"backend must not own wallet transaction submission")

if errors:
    print("420Launchpad Audit-5 verification FAILED")
    for e in errors: print(" - "+e)
    raise SystemExit(1)
print("420Launchpad Audit-5 verification PASS")
print("User surface: project/campaign discovery + detail + participant status + reviewed contribution/claim/refund")
print("Creator boundary: EOA/EIP-1271-signed governance review only, no privileged Wallet execution")
print("Canonical discovery: ProtocolRegistry -> Router -> Sale/Allocation/Crowdfunding/Project bindings")
