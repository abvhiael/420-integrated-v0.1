#!/usr/bin/env python3
import json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[1];errors=[]
def need(rel):
    p=root/rel
    if not p.is_file(): errors.append("missing "+rel)
    return p
required=[
"attention/service/package.json","attention/service/runtime-config.json","attention/service/runtime-config.example.json","attention/service/README.md",
"attention/service/core/config.js","attention/service/core/privacy.js","attention/service/core/reducer.js","attention/service/core/indexer-source.js",
"attention/service/core/transaction-review.js","attention/service/core/service.js","attention/service/core/http.js","attention/service/service.mjs",
"attention/service/scripts/check.mjs","attention/service/scripts/build.mjs",
"attention/service/test/reducer.test.js","attention/service/test/http.test.js","attention/service/test/config-privacy.test.js","attention/service/test/source-retry.test.js",
"attention/web/core/service.js","attention/web/core/wallet.js","docs/apps/attention/developer/api.md","docs/audit/420ATTENTION-AUDIT-7-QUALIFICATION.md"
]
for x in required: need(x)
cfg=need("attention/service/runtime-config.json")
if cfg.is_file():
    v=json.loads(cfg.read_text())
    if v.get("schema")!="420-attention-service-runtime-v1": errors.append("runtime schema drift")
    if v.get("chainId") is not None or v.get("indexerBaseUrl") is not None or v.get("rpcUrl") is not None: errors.append("committed service runtime must remain unresolved")
    c=v.get("contracts",{})
    if c.get("attentionTreasury")!="0x0000000000000000000000000000000000000421": errors.append("AttentionTreasury frozen address drift")
    if c.get("campaignRegistry")!="0x000000000000000000000000000000000000043b": errors.append("CampaignRegistry frozen address drift")
source=need("attention/service/core/indexer-source.js")
if source.is_file():
    s=source.read_text()
    for token in ["/v1/logs?","eth_call","maxRetries","retryBaseMs","direction:'asc'","CampaignCreated","AttentionProofCommitted"]:
        if token not in s: errors.append("Indexer/RPC source marker missing "+token)
reducer=need("attention/service/core/reducer.js")
if reducer.is_file():
    s=reducer.read_text()
    for token in ["conflicting canonical event identity","wrong chain","CampaignConsentSet","RewardAccrued","RewardClaimed","CampaignRefunded"]:
        if token not in s: errors.append("projection invariant missing "+token)
privacy=need("attention/service/core/privacy.js")
if privacy.is_file():
    s=privacy.read_text()
    for token in ["raw.?telemetry","behavioral","targeting.?data","credential","private.?key"]:
        if token not in s: errors.append("privacy exclusion missing "+token)
http=need("attention/service/core/http.js")
if http.is_file():
    s=http.read_text()
    for route in ["/v1/attention/runtime","/v1/attention/campaigns","/v1/attention/accounts/","/v1/attention/proofs/","/v1/attention/rewards/","/v1/attention/prepare/"]:
        if route not in s: errors.append("Attention API route missing "+route)
web=need("attention/web/core/service.js")
if web.is_file():
    s=web.read_text()
    for route in ["/v1/attention/runtime","/v1/attention/campaigns","/v1/attention/accounts/","/v1/attention/proofs/","/v1/attention/rewards/","/v1/attention/prepare/"]:
        if route not in s: errors.append("browser/service route mismatch "+route)
print(json.dumps({"pass":not errors,"errors":errors,"step":"ATTENTION-AUDIT-7","level1":"service","level2":"app-integration-milestone"},indent=2))
sys.exit(0 if not errors else 2)
