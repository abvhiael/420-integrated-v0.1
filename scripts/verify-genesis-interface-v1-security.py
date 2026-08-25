#!/usr/bin/env python3
from pathlib import Path
import json,sys
root=Path(__file__).resolve().parents[1]
errors=[]
needed=[
"ICapabilityRegistry420.sol","ICustodyVault420.sol","IGenesisInitializable420.sol",
"IMigration420.sol","ISystemSafety420.sol"
]
base=root/"contracts/src/interfaces/genesis"
for f in needed:
    if not (base/f).exists(): errors.append("missing "+f)

acct=json.loads((root/"contracts/config/accounts/genesis-account-decision-1.json").read_text())
if acct["status"]!="FROZEN_REQUIREMENTS_IMPLEMENTATION_ABI_PENDING":
    errors.append("account decision status")

layer=json.loads((root/"contracts/config/interfaces/genesis-interface-layer.json").read_text())
for i in ["ICapabilityRegistry420","ICustodyVault420","IGenesisInitializable420","IMigration420","ISystemSafety420"]:
    if i not in layer["shared_interfaces"]: errors.append("layer missing "+i)

safety=json.loads((root/"contracts/config/interfaces/system-safety-semantics.json").read_text())
if set(safety["states"]) != {"NORMAL","DEGRADED","HALTED","RECOVERY"}:
    errors.append("safety states")
if "WITHDRAWAL_ONLY" not in safety["action_classes"]:
    errors.append("withdrawal safety class")

out={
 "pass":not errors,
 "errors":errors,
 "genesis_account_decision_1":True,
 "total_shared_interfaces":len(layer["shared_interfaces"]),
 "security_extensions":5
}
(root/"contracts/config/interfaces/v1-security-verification.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if not errors else 2)
