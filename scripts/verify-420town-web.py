#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
errors=[]
def need(cond,msg):
    if not cond: errors.append(msg)

cfg=json.loads((ROOT/"config/420town-web-v1.json").read_text())
town=json.loads((ROOT/"config/420town-genesis.json").read_text())
html=(ROOT/"town/web/index.html").read_text()
app=(ROOT/"town/web/app.js").read_text()
styles=(ROOT/"town/web/styles.css").read_text()
runtime=json.loads((ROOT/"town/web/runtime-config.json").read_text())
runtime_example=json.loads((ROOT/"town/web/runtime-config.example.json").read_text())
config_js=(ROOT/"town/web/core/config.js").read_text()
wallet=(ROOT/"town/web/core/wallet.js").read_text()
authority=(ROOT/"town/web/core/authority.js").read_text()
service=(ROOT/"town/web/core/service.js").read_text()
state=(ROOT/"town/web/core/state.js").read_text()
check=(ROOT/"town/web/scripts/check.mjs").read_text()
workflow=(ROOT/".github/workflows/420town-audit.yml").read_text()

need(cfg.get("schema")=="420-town-web-v1","Town web schema drift")
need(cfg.get("serviceId")=="420/service/town/v1","Town web service ID drift")
need(cfg.get("status")=="WEB_APPLICATION_BASELINE","Town web status drift")
need(town.get("status") in {"WEB_APPLICATION_BASELINE","REPOSITORY_COMPLETE_PRE_TESTNET"},"Town canonical phase is incompatible with qualified web baseline")
need("TOWN-AUDIT-8" in town.get("implementedThrough",[]),"Town canonical config missing TOWN-AUDIT-8")
need("TOWN-AUDIT-8" not in town.get("deferredRoadmap",[]),"Town canonical config still defers TOWN-AUDIT-8")
need(town.get("webConfig")=="config/420town-web-v1.json","Town web config binding drift")
need(town.get("webRoot")=="town/web","Town web root drift")

need(cfg.get("productionOrigin")=="https://town.420integrated.org","production origin drift")
need(cfg.get("discovery",{}).get("domain")=="public_town","Town discovery must stay in public_town")
need(cfg.get("discovery",{}).get("authoritative") is False,"Search discovery must remain non-authoritative")
need(cfg.get("content",{}).get("idempotencyRequired") is True,"web content idempotency disabled")
auth=cfg.get("authority",{})
need(auth.get("source")=="TownAuthority420","web authority source drift")
need(auth.get("walletRequired") is True and auth.get("networkValidation") is True and auth.get("targetPinning") is True,"authority execution gates weakened")
need(auth.get("communityKeyModel")=="EXPLICIT_BYTES32","authority community key model drift")
need(auth.get("inferFromApplicationObjectId") is False,"web must not infer authority key from application ObjectID")
need(set(["community","membership","subscription","entitlement"]).issubset(set(auth.get("reads",[]))),"authority read state inventory incomplete")
need(set(["createCommunity","joinCommunity","leaveCommunity","removeMember","assignRole","activateSubscription","grantEntitlement"]).issubset(set(auth.get("writes",[]))),"authority write inventory incomplete")
need(len(cfg.get("invariants",[]))>=15,"Town web invariant inventory incomplete")

need(runtime.get("schema")=="420-town-web-runtime-v1","runtime config schema drift")
need(runtime.get("site",{}).get("productionOrigin")=="https://town.420integrated.org","runtime production origin drift")
serialized=json.dumps(runtime).lower()
for token in ["apikey","privatekey","credential","secret","password","authorization"]:
    need(token not in serialized,f"privileged secret-like runtime key found: {token}")
need(runtime.get("features",{}).get("authorityTransactions") is False,"repository production config must fail closed until network/authority materialized")
need(runtime_example.get("features",{}).get("authorityTransactions") is True,"runtime example must demonstrate authority transaction materialization")

for token in ["discover-form","authority-community-key","join-community","leave-community","post-form","thread-form","comment-form","report-form","moderate-form","appeal-form","admin-form","access-form","aria-live","transaction-status"]:
    need(token in html,f"Town web missing UI surface {token}")
for token in ["@media","focus-visible","prefers-reduced-motion"]:
    need(token in styles,f"Town web accessibility/responsive stylesheet missing {token}")
for token in ["authorityKey","discoverCommunities","service.feed","service.createPost","service.createThread","service.createComment","service.vote","service.report","service.moderate","service.appeal","readSubscription","readEntitlement","encodeJoin","encodeLeave","encodeCreate","encodeRemoveMember","encodeAssignRole"]:
    need(token in app,f"Town web controller missing {token}")
need("localStorage" not in app and "sessionStorage" not in app,"Town web must not persist session token")
need("innerHTML" not in app,"Town web dynamic rendering must avoid innerHTML")

for token in ["invalid Town runtime schema","requires HTTPS outside localhost","forbidden in browser config","authority transactions require chain and contract"]:
    need(token in config_js,f"Town web runtime validator missing {token}")
for token in ["WALLET_NOT_CONNECTED","WRONG_NETWORK","AUTHORITY_UNMATERIALIZED","UNEXPECTED_TRANSACTION_TARGET","eth_sendTransaction"]:
    need(token in wallet,f"Town wallet gate missing {token}")
for token in ["eth_call","readCommunity","readMembership","readSubscription","readEntitlement"]:
    need(token in authority,f"Town authority reader missing {token}")
for token in ["domain:public_town","/v1/moderation/reports","/actions","/appeals","Idempotency-Key"]:
    need(token in service,f"Town web service integration missing {token}")
for token in ["LOADING","EMPTY","ERROR","TRANSACTION","READY","getRandomValues"]:
    need(token in state,f"Town web state/idempotency model missing {token}")
for token in ["420Town web structural check PASS","syntax check failed","runtime config contains secret-like field","accessibility/responsive stylesheet incomplete"]:
    need(token in check,f"Town web structural check missing {token}")

for path in [
 "town/web/test/config.test.js","town/web/test/wallet.test.js","town/web/test/abi.test.js",
 "town/web/test/authority.test.js","town/web/test/state.test.js","town/web/test/service.test.js"
]:
    need((ROOT/path).exists(),f"Town web test missing {path}")

for token in [
 "config/420town-web-v1.json","town/**","scripts/verify-420town-web.py",
 "Verify Town web application","npm run qualify","working-directory: town/web"
]:
    need(token in workflow,f"Town workflow missing web gate {token}")

if errors:
    print("420Town web verifier FAILED")
    for e in errors: print("-",e)
    raise SystemExit(1)

print("420Town web verifier PASS")
print("discovery=420Search/public_town/non_authoritative")
print("authority=TownAuthority420/wallet+network+target_pinned")
print("content=Town_v1_API")
print("runtime=NO_COMMITTED_SECRETS")
print(f"invariants={len(cfg['invariants'])}")
