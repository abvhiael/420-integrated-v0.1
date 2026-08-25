#!/usr/bin/env python3
import json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[1];errors=[]
cadc=json.loads((root/"contracts/config/bridge/cadc.json").read_text())
if cadc["status"]!="CANONICAL_CAD_PENDING_ISSUER_INTEGRATION":errors.append("CADC status")
if cadc["destination_420"]["mint_authority_420_protocol"] is not False:errors.append("420 mint authority forbidden")
if len(cadc["known_source_deployments"])<5:errors.append("CADC source deployments missing")
tiers=json.loads((root/"contracts/config/swap/market-tiers.json").read_text())
if "CANONICAL" not in tiers["tiers"] or "PERMISSIONLESS" not in tiers["tiers"]:errors.append("tiers")
if tiers["tiers"]["PERMISSIONLESS"]["protocol_oracle_eligible"] is not False:errors.append("permissionless oracle invariant")
if tiers["tiers"]["PERMISSIONLESS"]["public_distribution_eligible"] is not False:errors.append("permissionless distribution invariant")
pol=json.loads((root/"contracts/config/bridge/verification-policy.json").read_text())
for a in ["CADC","USDC","ETH","BTC"]:
    if a not in pol["mechanisms"]:errors.append("missing verification "+a)
text=(root/"contracts/src/bridge/CADCBridgeIntegration.sol").read_text()
for forbidden in ["function mint","function burn"]:
    if forbidden in text:errors.append("CADC integration must not "+forbidden)
out={"pass":not errors,"errors":errors,"cadc":"PENDING_ISSUER_INTEGRATION","market_tiers":2}
(root/"contracts/config/bridge/cadc-swap-verification.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2));sys.exit(0 if not errors else 2)
