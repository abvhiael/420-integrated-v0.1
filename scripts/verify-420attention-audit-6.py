#!/usr/bin/env python3
import json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[1]
errors=[]
def need(path):
    p=root/path
    if not p.is_file(): errors.append("missing "+path)
    return p
for path in [
    "attention/web/package.json","attention/web/index.html","attention/web/styles.css","attention/web/app.js",
    "attention/web/runtime-config.json","attention/web/runtime-config.example.json","attention/web/security-headers.json","attention/web/README.md",
    "attention/web/core/config.js","attention/web/core/service.js","attention/web/core/wallet.js",
    "attention/web/scripts/check.mjs","attention/web/scripts/build.mjs",
    "attention/web/test/config.test.js","attention/web/test/service.test.js","attention/web/test/wallet.test.js","attention/web/test/runtime-defaults.test.js",
    "docs/apps/attention/user-guide.md","docs/apps/attention/developer/api.md","docs/audit/420ATTENTION-AUDIT-6-QUALIFICATION.md"
]: need(path)
runtime_path=need("attention/web/runtime-config.json")
if runtime_path.is_file():
    runtime=json.loads(runtime_path.read_text())
    reg=runtime.get("registry",{})
    if reg.get("attentionTreasuryAddress")!="0x0000000000000000000000000000000000000421": errors.append("AttentionTreasury frozen address drifted")
    if reg.get("campaignRegistryAddress")!="0x000000000000000000000000000000000000043b": errors.append("CampaignRegistry frozen address drifted")
    if reg.get("attentionServiceId")!="420/service/attention/v1" or reg.get("cannaseurServiceId")!="420/service/cannaseur/v1": errors.append("Attention service ID drifted")
    if runtime.get("network",{}).get("chainId") is not None or runtime.get("api",{}).get("baseUrl") is not None: errors.append("committed runtime must remain unresolved before testnet")
    features=runtime.get("features",{})
    for key in ("consentManagement","rewardClaims","sponsorCampaignManagement"):
        if features.get(key) is not False: errors.append(key+" must default OFF before testnet")
app=need("attention/web/app.js")
if app.is_file():
    text=app.read_text()
    for token in ["set-global-consent","set-campaign-consent","claim-reward","create-campaign","fund-campaign","activate-campaign","pause-campaign","close-campaign","cancel-campaign","waitForAttentionTransaction"]:
        if token not in text: errors.append("missing web workflow marker "+token)
    if "innerHTML" in text: errors.append("unsafe innerHTML usage")
wallet=need("attention/web/core/wallet.js")
if wallet.is_file():
    text=wallet.read_text()
    for token in ["eth_estimateGas","eth_sendTransaction","WRONG_NETWORK","REVIEW_CHAIN_MISMATCH","UNEXPECTED_TRANSACTION_TARGET","REORGED","REVERTED"]:
        if token not in text: errors.append("missing wallet safety marker "+token)
service=need("attention/web/core/service.js")
if service.is_file():
    text=service.read_text()
    for token in ["canonical!==true","projection provenance incomplete","credentials:'omit'","referrerPolicy:'no-referrer'"]:
        if token not in text: errors.append("missing projection/privacy marker "+token)
print(json.dumps({"pass":not errors,"errors":errors,"step":"ATTENTION-AUDIT-6","qualificationLevel":1},indent=2))
sys.exit(0 if not errors else 2)
