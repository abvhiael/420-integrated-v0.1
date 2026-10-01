#!/usr/bin/env python3
import json, pathlib, sys
R=pathlib.Path(__file__).resolve().parents[1]
M=R/"contracts/config/compute-market/cmp-1.4.7-deterministic-verification-adapters.json"
I=R/"contracts/src/compute/IComputeDeterministicVerificationAdapter420.sol"
G=R/"contracts/src/compute/ComputeDeterministicAdapterRegistry420.sol"
Q=R/"contracts/src/compute/ComputeDeterministicVerificationRouter420.sol"
A=R/"contracts/src/compute/ComputeIntegerSumSquaresAdapter420.sol"
W=R/"contracts/src/compute/ComputeJobMatchedWorkerEvidence420.sol"
T=R/"contracts/test/ComputeDeterministicVerificationRouter420.t.sol"
D=R/"docs/compute-market/CMP-1.4.7-DETERMINISTIC-VERIFICATION-ADAPTERS.md"
RM=R/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
errors=[]
for p in [M,I,G,Q,A,W,T,D,RM]:
    if not p.exists(): errors.append(f"missing {p.relative_to(R)}")
if errors:
    print("\n".join(errors)); sys.exit(1)
m=json.loads(M.read_text()); i=I.read_text(); g=G.read_text(); q=Q.read_text(); a=A.read_text(); w=W.read_text(); t=T.read_text(); d=D.read_text(); r=RM.read_text()
definition="For workloads whose result can be independently recomputed."
if m.get("step")!="CMP-1.4.7": errors.append("wrong step")
if m.get("canonical_definition")!=definition: errors.append("definition drift")
if f"### CMP-1.4.7 — Deterministic verification adapters\n{definition}" not in r: errors.append("roadmap definition drift")
for token in ["inputCommitment(","outputCommitment(","evaluate("]:
    if token not in i: errors.append(f"adapter interface missing {token}")
for token in ["codeHash","latestRevision","function publish(","function setActive("]:
    if token not in g: errors.append(f"registry missing {token}")
for token in ["function bindAdapter(","function evaluate(","RESULT_COMMITTED","adapterCodeHash","workerOutputCommitment"]:
    if token not in q: errors.append(f"router missing {token}")
for token in ["outputHash","a.outputHash = outputHash"]:
    if token not in w: errors.append(f"worker evidence missing {token}")
for token in [
 "testRoutePublicationAndPreExecutionBindingFreezeExactAdapter",
 "testOnlyOwnerCanBindAndCannotBindAfterExecution",
 "testCorrectOutputProducesPositiveDeterministicEvidenceWithoutMutatingJob",
 "testIncorrectOutputProducesNegativeEvidenceWithoutFabricatingFailureVerdict",
 "testTamperedInputAndOutputFailClosedAgainstCanonicalCommitments",
 "testAdapterUpgradeDoesNotRewriteFrozenJobRoute",
 "testInactiveOrWrongProfileRouteCannotBeNewlyBound",
 "testEvaluationIsSingleUse"
]:
    if token not in t: errors.append(f"test missing {token}")
for forbidden in ["recordVerification(","recordSettlement(","AssetVault420","ComputeSettlement420","ComputeStake"]:
    if forbidden in q or forbidden in a: errors.append(f"unrelated authority coupling {forbidden}")
required={"CMP-INV-005","CMP-INV-014","CMP-INV-016","CMP-INV-017","CMP-INV-020","CMP-INV-025","CMP-INV-026","CMP-INV-027","CMP-INV-030"}
if set(m.get("invariants",[]))!=required: errors.append("invariant set drift")
if m.get("milestone_relationship",{}).get("level_2_required_now") is not False: errors.append("unexpected Level 2 requirement")
dep=m.get("deployment_publication",{})
if any(dep.get(k) is not False for k in ["fixed_genesis_predeploy_created","protocol_registry_publication_claimed","live_deployment_claimed"]): errors.append("unexpected deployment claim")
for h in ["## Canonical definition","## Gap analysis","## Implementation","## Reference adapter","## Authority separation","## Level 1 qualification","## Level 2 status","## Exit criteria","## Completion"]:
    if h not in d: errors.append(f"missing heading {h}")
if errors:
    print("CMP-1.4.7 verification FAILED")
    for e in errors: print("-",e)
    sys.exit(1)
print("CMP-1.4.7 deterministic verification adapters: mechanically consistent")
