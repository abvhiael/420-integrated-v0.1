#!/usr/bin/env python3
import json, pathlib, sys
R=pathlib.Path(__file__).resolve().parents[1]
M=R/"contracts/config/compute-market/cmp-1.4.3-verification-policy-registry.json"
P=R/"contracts/src/compute/ComputePolicyRegistry420.sol"
J=R/"contracts/src/compute/ComputeJobRegistry420.sol"
T=R/"contracts/test/ComputeVerificationPolicyBinding420.t.sol"
D=R/"docs/compute-market/CMP-1.4.3-VERIFICATION-POLICY-REGISTRY.md"
RM=R/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
errors=[]
for p in [M,P,J,T,D,RM]:
    if not p.exists(): errors.append(f"missing {p.relative_to(R)}")
if errors:
    print("\n".join(errors)); sys.exit(1)
m=json.loads(M.read_text()); p=P.read_text(); j=J.read_text(); t=T.read_text(); d=D.read_text(); r=RM.read_text()
definition="Bind jobs to exact versioned verification policies before execution."
if m.get("step")!="CMP-1.4.3": errors.append("wrong step")
if m.get("canonical_definition")!=definition: errors.append("definition drift")
if f"### CMP-1.4.3 — Verification policy registry\n{definition}" not in r: errors.append("roadmap drift")
for x in ["KIND_VERIFICATION","function isCurrentAcceptable("]:
    if x not in p: errors.append(f"policy registry missing {x}")
for x in ["verificationPolicyId","verificationPolicyRevision","verificationPolicyCommitment","bindVerificationPolicyRegistry(","bindVerificationPolicy(","VerificationPolicyBound"]:
    if x not in j: errors.append(f"job registry missing {x}")
for x in ["testBoundRegistryRequiresPolicyBeforeExecution","testOnlyOwnerCanBindAndExactCurrentVerificationPolicyIsRequired","testLaterPolicyRevisionCannotRewriteAcceptedJob","testStaleRevisionAndDuplicateBindingFailClosed","testPolicyRegistryBindingIsOneTimeAndDeploymentScoped"]:
    if x not in t: errors.append(f"missing test {x}")
if "address(verificationPolicies) != address(0)" not in j: errors.append("qualified-mode execution guard missing")
for forbidden in ["AssetVault420","ComputeSettlement420","ComputeStake"]:
    if forbidden in j or forbidden in p: errors.append(f"unrelated authority coupling {forbidden}")
if not m.get("milestone_relationship",{}).get("level_2_required_now"): errors.append("Level 2 milestone not recorded")
dep=m.get("deployment_publication",{})
if any(dep.get(k) is not False for k in ["fixed_genesis_predeploy_created","protocol_registry_publication_claimed","live_deployment_claimed"]): errors.append("unexpected deployment claim")
for h in ["## Canonical definition","## Implementation","## Authority separation","## Level 1 qualification","## Level 2 milestone","## Exit criteria","## Completion"]:
    if h not in d: errors.append(f"missing heading {h}")
if errors:
    print("CMP-1.4.3 verification FAILED")
    for e in errors: print("-",e)
    sys.exit(1)
print("CMP-1.4.3 verification policy registry: mechanically consistent")
