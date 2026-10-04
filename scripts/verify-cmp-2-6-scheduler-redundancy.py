#!/usr/bin/env python3
from pathlib import Path
import json

R = Path(__file__).resolve().parents[1]
match = (R / "contracts/src/compute/ComputeMatch420.sol").read_text()
matching_tests = (R / "contracts/test/ComputeMatchingEngine420.t.sol").read_text()
capacity_tests = (R / "contracts/test/ComputeCapacityAwareAssignment420.t.sol").read_text()
cfg = json.loads((R / "contracts/config/compute-market/cmp-2.6-scheduler-redundancy.json").read_text())
doc = (R / "docs/compute-market/CMP-2.6-SCHEDULER-REDUNDANCY.md").read_text()
road = (R / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md").read_text()
wf = (R / ".github/workflows/compute-market.yml").read_text()

normalized = "".join(match.split())
for token in [
    "functionpropose(",
    "functionproposePriced(",
    "scheduler",
    "functionaccept(",
    "msg.sender!=r.owner",
    "acceptedForRequest[p.requestId]!=bytes32(0)",
    "proposalEligible(proposalId)",
]:
    assert token in normalized, f"missing scheduler non-authority gate: {token}"

for token in [
    "testCmp26SchedulerFailoverUsesFreshProposalWithoutPrivilege",
    "testCmp26RequesterCanSelfProposeWhenExternalSchedulersAreUnavailable",
    "testCmp26CompetingSchedulersCannotDoubleAcceptOrRewriteWinner",
    "testReplaceableSchedulersCanProposeButDoNotOwnAuthority",
]:
    assert token in matching_tests, f"missing CMP-2.6 matching test: {token}"

assert "testSchedulerCannotLinkJobOrReserveCapacityDirectly" in capacity_tests

assert cfg["step"] == "CMP-2.6"
assert cfg["qualificationLevel"] == 1
assert cfg["level2RequiredNow"] is False
assert cfg["schedulerModel"]["registryRequired"] is False
assert cfg["schedulerModel"]["allowlistRequired"] is False
assert cfg["schedulerModel"]["requesterMaySelfPropose"] is True
assert cfg["nextCanonicalStep"] == "CMP-2.7 — Market adversarial qualification"

assert "requester self-proposal provides a protocol-level fallback" in doc
assert "WorkerSnapshot remains the only capacity reservation controller" in doc
assert "## CMP-2.6 — Scheduler redundancy and non-authority" in road
assert "Verify CMP-2.6 scheduler redundancy and non-authority" in wf
assert "python scripts/verify-cmp-2-6-scheduler-redundancy.py" in wf

print("CMP-2.6 verifier: PASS")
