#!/usr/bin/env python3
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MODEL = ROOT / "contracts/config/compute-market/cmp-1.4.1-verifier-identity-lifecycle.json"
CONTRACT = ROOT / "contracts/src/compute/ComputeVerifierRegistry420.sol"
TEST = ROOT / "contracts/test/ComputeVerifierRegistry420.t.sol"
DOC = ROOT / "docs/compute-market/CMP-1.4.1-VERIFIER-IDENTITY-LIFECYCLE.md"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

errors=[]

for p in [MODEL, CONTRACT, TEST, DOC, ROADMAP]:
    if not p.exists():
        errors.append(f"missing required file: {p.relative_to(ROOT)}")

if errors:
    print("\n".join(errors))
    sys.exit(1)

model=json.loads(MODEL.read_text())
contract=CONTRACT.read_text()
test=TEST.read_text()
doc=DOC.read_text()
roadmap=ROADMAP.read_text()

definition="Register, activate, suspend, rotate and retire verifier identities without granting unrelated authority."

if model.get("step")!="CMP-1.4.1": errors.append("wrong step")
if model.get("canonical_definition")!=definition: errors.append("canonical definition drift")
if f"### CMP-1.4.1 — Verifier identity and lifecycle\n{definition}" not in roadmap:
    errors.append("detailed roadmap definition missing or changed")

for token in [
    "contract ComputeVerifierRegistry420",
    "enum Status { NONE, REGISTERED, ACTIVE, SUSPENDED, RETIRED }",
    "function register(",
    "function activate(",
    "function suspend(",
    "function proposeRotation(",
    "function acceptRotation(",
    "function retire(",
    "function isActive(",
    "verifierIdForAuthority"
]:
    if token not in contract: errors.append(f"contract missing {token}")

for token in [
    "testSelfRegistrationCreatesDomainSeparatedIdentityWithoutActivation",
    "testLifecycleRequiresGovernanceAndRetirementIsTerminal",
    "testOnlyAuthorityOrGovernanceCanSuspendActiveVerifier",
    "testRotationRequiresGovernanceProposalAndNewAuthorityAcceptance",
    "testDuplicateAuthorityAndPendingRotationFailClosed",
    "testRevisionHistoryPreservesStatusTransitions"
]:
    if token not in test: errors.append(f"test missing {token}")

for forbidden in [
    "ACTION_VERIFY_RESULT",
    "AssetVault420",
    "ComputeSettlement420",
    "ComputeStake"
]:
    if forbidden in contract:
        errors.append(f"unrelated authority coupling in registry: {forbidden}")

required_invariants={"CMP-INV-005","CMP-INV-016","CMP-INV-020","CMP-INV-023","CMP-INV-025","CMP-INV-026","CMP-INV-027","CMP-INV-030"}
if set(model.get("invariants",[])) != required_invariants:
    errors.append("invariant set drift")

deploy=model.get("deployment_publication",{})
if any(deploy.get(k) is not False for k in [
    "fixed_genesis_predeploy_created","protocol_registry_publication_claimed","live_deployment_claimed"
]):
    errors.append("unexpected deployment/publication claim")

for heading in ["## Canonical definition","## Implementation","## Authority separation","## Level 1 qualification requirements","## Exit criteria","## Completion"]:
    if heading not in doc: errors.append(f"documentation missing {heading}")

if errors:
    print("CMP-1.4.1 verification FAILED")
    for e in errors: print(f"- {e}")
    sys.exit(1)

print("CMP-1.4.1 verifier identity lifecycle: mechanically consistent")
