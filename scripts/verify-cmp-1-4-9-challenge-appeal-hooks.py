#!/usr/bin/env python3
import json, pathlib, sys
R=pathlib.Path(__file__).resolve().parents[1]
M=R/"contracts/config/compute-market/cmp-1.4.9-challenge-appeal-hooks.json"
C=R/"contracts/src/compute/ComputeDisputeResolution420.sol"
T=R/"contracts/test/ComputeVerifiedEntitlement420.t.sol"
D=R/"docs/compute-market/CMP-1.4.9-CHALLENGE-APPEAL-HOOKS.md"
RM=R/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
errors=[]
for p in [M,C,T,D,RM]:
    if not p.exists(): errors.append(f"missing {p.relative_to(R)}")
if errors:
    print("\n".join(errors)); sys.exit(1)
m=json.loads(M.read_text()); c=C.read_text(); t=T.read_text(); d=D.read_text(); r=RM.read_text()
definition="Integrate verifier decisions with dispute holds and later stake/slash adjudication."
if m.get("step")!="CMP-1.4.9": errors.append("wrong step")
if m.get("canonical_definition")!=definition: errors.append("definition drift")
if f"### CMP-1.4.9 — Challenge and appeal hooks\n{definition}" not in r:
    errors.append("roadmap definition drift")
for token in [
    "struct VerificationReview",
    "function verificationReview(bytes32 disputeId)",
    "function verificationHoldForJob(bytes32 jobId)",
    "adverseToOriginalVerification",
    "holdActive",
    "appealAdjudicator",
    "verificationPolicyCommitment"
]:
    if token not in c: errors.append(f"dispute hook missing {token}")
for forbidden in ["slash(", "stake(", "AssetVault420", "recordVerification("]:
    section=c[c.find("function verificationReview"):c.find("function providerReleaseAllowed")]
    if forbidden in section: errors.append(f"review hook gained forbidden authority: {forbidden}")
for token in [
    "testTimelyPayerChallengeHoldsSpecificProviderLiabilityUntilProviderWinFinality",
    "testPayerWinReallocatesOnlyContestedJobToFullOriginalPayerRefund",
    "testAppealUsesDifferentIndependentAdjudicatorAndOverturnsUnreleasedDecision",
    "verificationReview(disputeId)",
    "verificationHoldForJob(id)",
    "adverseToOriginalVerification"
]:
    if token not in t: errors.append(f"hook qualification missing {token}")
required={
 "CMP-INV-005","CMP-INV-009","CMP-INV-010","CMP-INV-013","CMP-INV-014",
 "CMP-INV-016","CMP-INV-017","CMP-INV-018","CMP-INV-020","CMP-INV-022",
 "CMP-INV-024","CMP-INV-025","CMP-INV-026","CMP-INV-027","CMP-INV-030"
}
if set(m.get("invariants",[]))!=required: errors.append("invariant set drift")
mil=m.get("milestone_relationship",{})
if mil.get("level_2_required_now") is not True or mil.get("milestone")!="CMP-1.4 verifier-dispute lifecycle integration":
    errors.append("Level 2 milestone missing")
dep=m.get("deployment_publication",{})
if any(dep.get(k) is not False for k in ["fixed_genesis_predeploy_created","protocol_registry_publication_claimed","live_deployment_claimed"]):
    errors.append("unexpected deployment claim")
for h in ["## Canonical definition","## Repository baseline and gap analysis","## Implementation","## Later stake/slash hand-off","## Original-verdict immutability","## Level 1 qualification","## Level 2 milestone","## Exit criteria","## Completion"]:
    if h not in d: errors.append(f"missing heading {h}")
if errors:
    print("CMP-1.4.9 verification FAILED")
    for e in errors: print("-",e)
    sys.exit(1)
print("CMP-1.4.9 challenge/appeal hooks: mechanically consistent")
