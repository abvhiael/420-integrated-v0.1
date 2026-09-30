#!/usr/bin/env python3
import json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
MODEL=ROOT/"contracts/config/compute-market/cmp-1.4.2-verifier-classes-capabilities.json"
CONTRACT=ROOT/"contracts/src/compute/ComputeVerifierCapabilityRegistry420.sol"
TEST=ROOT/"contracts/test/ComputeVerifierCapabilityRegistry420.t.sol"
DOC=ROOT/"docs/compute-market/CMP-1.4.2-VERIFIER-CLASSES-AND-CAPABILITIES.md"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
errors=[]
for p in [MODEL,CONTRACT,TEST,DOC,ROADMAP]:
    if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
if errors:
    print("\n".join(errors)); sys.exit(1)
m=json.loads(MODEL.read_text()); c=CONTRACT.read_text(); t=TEST.read_text(); d=DOC.read_text(); r=ROADMAP.read_text()
definition="Support independently typed classes such as protocol verifier, independent verifier, job-owner verifier, oracle verifier, TEE verifier and committee verifier."
if m.get("step")!="CMP-1.4.2": errors.append("wrong step")
if m.get("canonical_definition")!=definition: errors.append("definition drift")
if f"### CMP-1.4.2 — Verifier classes and workload capabilities\n{definition}" not in r: errors.append("roadmap definition drift")
classes=["PROTOCOL_VERIFIER","INDEPENDENT_VERIFIER","JOB_OWNER_VERIFIER","ORACLE_VERIFIER","TEE_VERIFIER","COMMITTEE_VERIFIER"]
for x in classes:
    if x not in c: errors.append(f"missing class {x}")
for x in ["setCapability(","isCapable(","capabilityRevision(","ComputeVerifierRegistry420 public immutable verifiers"]:
    if x not in c: errors.append(f"missing contract surface {x}")
for x in [
 "testInitialClassVocabularyIsIndependentlyTyped",
 "testGovernanceCanQualifyExactClassAndWorkloadOnly",
 "testDifferentClassesAndWorkloadsAreIndependent",
 "testUnauthorizedUnknownZeroAndRetiredMutationsFailClosed",
 "testCapabilityRequiresCurrentActiveVerifierIdentityAndRevision",
 "testRevocationIsVersionedAndHistoricalQualificationPreserved"
]:
    if x not in t: errors.append(f"missing test {x}")
for forbidden in ["ACTION_VERIFY_RESULT","AssetVault420","ComputeSettlement420","ComputeStake"]:
    if forbidden in c: errors.append(f"unrelated authority coupling {forbidden}")
required={"CMP-INV-005","CMP-INV-016","CMP-INV-017","CMP-INV-020","CMP-INV-023","CMP-INV-025","CMP-INV-026","CMP-INV-027","CMP-INV-030"}
if set(m.get("invariants",[]))!=required: errors.append("invariant set drift")
dep=m.get("deployment_publication",{})
if any(dep.get(k) is not False for k in ["fixed_genesis_predeploy_created","protocol_registry_publication_claimed","live_deployment_claimed"]):
    errors.append("unexpected deployment claim")
for h in ["## Canonical definition","## Implementation","## Authority separation","## Level 1 qualification requirements","## Level 2 milestone","## Exit criteria","## Completion"]:
    if h not in d: errors.append(f"missing heading {h}")
if errors:
    print("CMP-1.4.2 verification FAILED")
    for e in errors: print("-",e)
    sys.exit(1)
print("CMP-1.4.2 verifier classes/workload capabilities: mechanically consistent")
