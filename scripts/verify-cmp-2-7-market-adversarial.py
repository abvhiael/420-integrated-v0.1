#!/usr/bin/env python3
import json
from pathlib import Path
import sys

R = Path(__file__).resolve().parents[1]
M = R / "contracts/config/compute-market/cmp-2.7-market-adversarial.json"
D = R / "docs/compute-market/CMP-2.7-MARKET-ADVERSARIAL-QUALIFICATION.md"
RM = R / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
WF = R / ".github/workflows/compute-market.yml"

errors = []
for p in [M, D, RM, WF]:
    if not p.exists():
        errors.append(f"missing {p.relative_to(R)}")

if errors:
    print("\n".join(errors))
    sys.exit(1)

m = json.loads(M.read_text())
d = D.read_text()
road = RM.read_text()
wf = WF.read_text()

if m.get("step") != "CMP-2.7":
    errors.append("wrong step")
if m.get("qualification_level") != 2:
    errors.append("CMP-2.7 must be the Level 2 market adversarial milestone")
if m.get("implementation", {}).get("production_contract_changes") is not False:
    errors.append("unexpected production contract change claim")

required_threats = {
    "request_authorization_replay_and_malformed_terms",
    "offer_authority_scope_and_resource_drift",
    "stale_request_offer_and_resource_revision",
    "unauthorized_acceptance_and_scheduler_privilege",
    "terminal_request_resurrection_and_double_match",
    "pricing_overbid_bounds_rounding_and_overflow",
    "provider_beneficiary_and_identity_drift",
    "scheduler_outage_replacement_and_race",
    "capacity_oversubscription_and_partial_mutation",
}
matrix = m.get("threat_matrix", [])
by_threat = {x.get("threat"): x for x in matrix}
if set(by_threat) != required_threats:
    errors.append("threat matrix set drift")

for threat, row in by_threat.items():
    evidence = row.get("evidence", [])
    if not evidence:
        errors.append(f"{threat}: no executable evidence")
    for item in evidence:
        if "::" not in item:
            errors.append(f"{threat}: malformed evidence {item}")
            continue
        rel, test = item.split("::", 1)
        p = R / rel
        if not p.exists():
            errors.append(f"{threat}: missing file {rel}")
            continue
        if f"function {test}(" not in p.read_text():
            errors.append(f"{threat}: missing test {item}")

matching = (R / "contracts/test/ComputeMatchingEngine420.t.sol").read_text()
for token in [
    "testCmp27OutsiderAcceptanceFailsWithoutMutationAndOwnerCanStillAccept",
    "testCmp27CancelledRequestCannotBeResurrectedByExistingProposal",
    "testCmp27ProviderBeneficiaryDriftCannotRewriteAcceptedMatchOrEnableFreshProposal",
    "testCmp27MeteredMultiplicationOverflowFailsWithoutProposalAllocation",
]:
    if token not in matching:
        errors.append(f"missing strengthened adversarial test {token}")

mil = m.get("milestone_relationship", {})
if mil.get("level_2_required_now") is not True:
    errors.append("Level 2 milestone not required")
if mil.get("milestone") != "CMP-2 accumulated market adversarial integration":
    errors.append("wrong Level 2 milestone")

if m.get("next_canonical_step") != "CMP-2.8 — Phase closeout":
    errors.append("next step drift")

for phrase in [
    "## CMP-2.7 — Market adversarial qualification",
    "Level 1 + Level 2 qualification in progress",
    "CMP-2.8 remains the canonical Level 3 phase-closeout boundary",
]:
    if phrase not in road + "\n" + d:
        errors.append(f"missing CMP-2.7 documentation phrase: {phrase}")

if "Verify CMP-2.7 market adversarial qualification" not in wf:
    errors.append("workflow step missing")
if "python scripts/verify-cmp-2-7-market-adversarial.py" not in wf:
    errors.append("workflow verifier invocation missing")

if errors:
    print("CMP-2.7 verification FAILED")
    for e in errors:
        print("-", e)
    sys.exit(1)

print("CMP-2.7 market adversarial qualification: mechanically consistent")
