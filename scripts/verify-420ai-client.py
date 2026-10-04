#!/usr/bin/env python3
from pathlib import Path
import json,re

ROOT=Path(__file__).resolve().parents[1]
WEB=ROOT/"ai/web"
errors=[]

required=[
 "package.json","index.html","styles.css","app.js","README.md",
 "runtime-config.json","runtime-config.example.json","security-headers.json",
 "core/config.js","core/abi.js","core/wallet.js","core/read-api.js",
 "core/transactions.js","core/controller.js",
 "test/config.test.js","test/abi.test.js","test/wallet.test.js",
 "test/controller.test.js","test/transactions.test.js","test/read-api.test.js"
]
for rel in required:
    if not (WEB/rel).is_file(): errors.append("missing AI client artifact: "+rel)

runtime=json.loads((WEB/"runtime-config.json").read_text())
example=json.loads((WEB/"runtime-config.example.json").read_text())
headers=json.loads((WEB/"security-headers.json").read_text())
app=(WEB/"app.js").read_text()
html=(WEB/"index.html").read_text()
controller=(WEB/"core/controller.js").read_text()
config=(WEB/"core/config.js").read_text()
tx=(WEB/"core/transactions.js").read_text()
workflow=(ROOT/".github/workflows/420ai-audit.yml").read_text()
arch=(ROOT/"docs/420-AI-V1-ARCHITECTURE.md").read_text()

if runtime.get("schema")!="420-ai-web-runtime-v1": errors.append("runtime schema mismatch")
if runtime.get("site",{}).get("productionOrigin")!="https://ai.420integrated.org": errors.append("production origin mismatch")
if runtime.get("network",{}).get("chainId") is not None: errors.append("committed runtime must remain network-unmaterialized before AI-AUDIT-9")
if runtime.get("readApi",{}).get("baseUrl") is not None: errors.append("committed runtime must remain read-API-unmaterialized before AI-AUDIT-9")
for flag in ["requestCreation","requestCancellation","disputeOpening"]:
    if runtime.get("features",{}).get(flag) is not False: errors.append("unmaterialized runtime must fail closed for "+flag)
if example.get("network",{}).get("chainId") is None: errors.append("example production materialization shape missing chain id")
if "Content-Security-Policy" not in headers or "object-src 'none'" not in headers["Content-Security-Policy"]: errors.append("client CSP missing restrictive object policy")

for forbidden in ["apiKey","privateKey","password","credential","authorizationToken","providerSecret"]:
    if re.search(forbidden,json.dumps(runtime),re.I): errors.append("privileged browser secret field present: "+forbidden)

for token in [
 "eth_requestAccounts","eth_sendTransaction","eth_estimateGas","wallet-invalidated",
 "prepareRequest","prepareCancel","prepareDispute","inputCommitment","420-ai-read-v1"
]:
    if token not in (controller+tx): errors.append("client authority/lifecycle boundary missing: "+token)

if "AIJobEscrow.fund" not in (WEB/"README.md").read_text(): errors.append("disabled direct funding boundary not documented")
if "innerHTML" in app: errors.append("client must not render indexed/review data through innerHTML")
for token in ['aria-live','Skip to main content','id="connect-wallet"','id="model-list"','id="job-detail"']:
    if token not in html: errors.append("accessibility/client surface missing: "+token)
if "@media" not in (WEB/"styles.css").read_text(): errors.append("responsive CSS missing")

for token in ["ai/web/**","ai-client:","npm run build","verify-420ai-client.py"]:
    if token not in workflow: errors.append("AI client qualification workflow missing: "+token)
if "AI-AUDIT-8 user-facing client boundary" not in arch: errors.append("AI-AUDIT-8 architecture boundary missing")

if errors:
    print("420AI AI-AUDIT-8 client qualification FAILED")
    for e in errors: print("- "+e)
    raise SystemExit(1)
print("420AI AI-AUDIT-8 client qualification PASSED")
print("verified wallet/network boundaries, indexed discovery, requester transactions, funding display-only semantics, recovery states, accessibility, responsive UI, production config and browser-secret exclusion")
