#!/usr/bin/env python3
from pathlib import Path
import json,sys
root=Path(__file__).resolve().parents[1]
errors=[]
req=[
"Types420.sol","Errors420.sol","IGenesisResident420.sol","IProtocolRegistry420.sol",
"ICanonicalAssetRegistry420.sol","IGovernanceAuthority420.sol","IPauseRegistry420.sol",
"IHealthRegistry420.sol","IOracle420.sol","IIdentityCredential420.sol","INames420.sol",
"ISettlementHealth420.sol","IFeeQuote420.sol","ISigningDomain420.sol","IAccounting420.sol"
]
base=root/"contracts/src/interfaces/genesis"
for f in req:
    if not (base/f).exists(): errors.append("missing "+f)
p=json.loads((root/"contracts/config/interfaces/genesis-interface-layer.json").read_text())
m=json.loads((root/"contracts/config/interfaces/dependency-matrix.json").read_text())
if p["status"]!="DEFINED_CANDIDATE_FOR_FREEZE": errors.append("status")
if len(p["shared_interfaces"])!=13: errors.append("interface count")
for s in ["420Pay","420Swap","420Bridge","420Stake","420Governance","420AI"]:
    if s not in m["dependencies"]: errors.append("missing matrix "+s)
out={"pass":not errors,"errors":errors,"interfaces":13,"dependency_suites":len(m["dependencies"])}
(root/"contracts/config/interfaces/verification.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if not errors else 2)
