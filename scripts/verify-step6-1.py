#!/usr/bin/env python3
import json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[1]
errors=[]
sysaddr=json.loads((root/"config/system-addresses.json").read_text())
if sysaddr.get("status")!="FROZEN_STEP6_1": errors.append("system address map not frozen")
if len(sysaddr.get("assignments",[]))!=28: errors.append(f"expected 28 frozen assignments, got {len(sysaddr.get('assignments',[]))}")
expected={
"ProtocolReserve":"contracts/src/system/ProtocolReserve.sol",
"CommunityRewardReserve":"contracts/src/system/CommunityRewardReserve.sol",
"RandomnessRegistry":"contracts/src/system/RandomnessRegistry.sol",
"PublicDistributionVault":"contracts/src/system/PublicDistributionVault.sol",
"ValidatorBootstrapReserve":"contracts/src/system/ValidatorBootstrapReserve.sol",
}
for name,p in expected.items():
    if not (root/p).exists():errors.append("missing "+name)
pd=(root/"contracts/src/system/PublicDistributionVault.sol").read_text()
for tok in ["12_600_000 ether","4_200_000 ether","100_000 ether","180 days","365 days"]:
    if tok not in pd:errors.append("distribution invariant missing "+tok)
gt=(root/"contracts/src/governance/GovernanceTimelock.sol").read_text()
for tok in ["G1_DELAY = 7 days","G2_DELAY = 14 days","G3_DELAY = 14 days","G4_DELAY = 42 days"]:
    if tok not in gt:errors.append("timelock invariant missing "+tok)
plan=json.loads((root/"contracts/config/predeploy/predeploy-plan.json").read_text())
if len(plan.get("predeploys",[]))!=28:errors.append("predeploy count mismatch")
out={"pass":not errors,"errors":errors,"frozen_system_addresses":len(sysaddr.get("assignments",[]))}
(root/"contracts/config/step6.1-verification.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if not errors else 2)
