#!/usr/bin/env python3
import json, pathlib, sys

R=pathlib.Path(__file__).resolve().parents[1]
M=R/"contracts/config/compute-market/cmp-1.4.5-independent-verifier-selection.json"
S=R/"contracts/src/compute/ComputeIndependentVerifierSelector420.sol"
T=R/"contracts/test/ComputeIndependentVerifierSelector420.t.sol"
D=R/"docs/compute-market/CMP-1.4.5-INDEPENDENT-VERIFIER-SELECTION.md"
RM=R/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
POL=R/"contracts/src/compute/ComputeVerifierIndependencePolicy420.sol"
errors=[]

for p in [M,S,T,D,RM,POL]:
    if not p.exists(): errors.append(f"missing {p.relative_to(R)}")
if errors:
    print("\n".join(errors)); sys.exit(1)

m=json.loads(M.read_text()); s=S.read_text(); t=T.read_text(); d=D.read_text(); r=RM.read_text(); p=POL.read_text()
definition="Prevent worker-selected friendly verifiers and preserve conflict-of-interest controls."

if m.get("step")!="CMP-1.4.5": errors.append("wrong step")
if m.get("canonical_definition")!=definition: errors.append("definition drift")
if f"### CMP-1.4.5 — Independent verifier selection\n{definition}" not in r:
    errors.append("roadmap definition drift")

for token in [
    "contract ComputeIndependentVerifierSelector420",
    "INDEPENDENT_VERIFIER()",
    "function select(",
    "function revoke(",
    "verificationPolicyCommitment",
    "jobRevision",
    "selectionAuthority",
    "independencePolicy.appoint("
]:
    if token not in s: errors.append(f"selector missing {token}")

for token in [
    "testDesignatedSelectorChoosesOnlyActiveCapableIndependentVerifier",
    "testWorkerOwnerPayerVerifierAndOutsiderCannotChooseVerifier",
    "testSharedControllerFriendlyVerifierFailsClosed",
    "testWrongWorkloadOrSuspendedVerifierFailsClosed",
    "testSelectionMustOccurBeforeExecution",
    "testSelectorRevocationIsVersionedAndAllowsReviewedReplacementBeforeExecution",
    "testPolicySelectorRotationInvalidatesOldSelectorContract"
]:
    if token not in t: errors.append(f"test missing {token}")

for forbidden in [
    "setCapability(",
    "setApprovedProfile(",
    ".attest(",
    "AssetVault420",
    "ComputeSettlement420",
    "ComputeStake"
]:
    if forbidden in s: errors.append(f"selector contains unrelated authority surface: {forbidden}")

if "msg.sender != verifierSelector" not in p:
    errors.append("independence policy no longer restricts appointment to selector")

required={"CMP-INV-005","CMP-INV-014","CMP-INV-016","CMP-INV-017","CMP-INV-020","CMP-INV-023","CMP-INV-025","CMP-INV-026","CMP-INV-027","CMP-INV-030"}
if set(m.get("invariants",[]))!=required: errors.append("invariant set drift")

if m.get("roadmap_order",{}).get("predecessor_complete_on_base") is not False:
    errors.append("CMP-1.4.4 open status not preserved")

dep=m.get("deployment_publication",{})
if any(dep.get(k) is not False for k in ["fixed_genesis_predeploy_created","protocol_registry_publication_claimed","live_deployment_claimed"]):
    errors.append("unexpected deployment/publication claim")

for h in ["## Canonical definition","## Gap analysis","## Implementation","## Selection provenance","## Authority separation","## Level 1 qualification","## Level 2 status","## Exit criteria","## Completion"]:
    if h not in d: errors.append(f"missing heading {h}")

if errors:
    print("CMP-1.4.5 verification FAILED")
    for e in errors: print("-",e)
    sys.exit(1)

print("CMP-1.4.5 independent verifier selection: mechanically consistent")
