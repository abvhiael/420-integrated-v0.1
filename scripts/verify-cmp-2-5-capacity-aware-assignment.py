#!/usr/bin/env python3
from pathlib import Path
import json

R = Path(__file__).resolve().parents[1]
request = (R / "contracts/src/compute/ComputeRequestRegistry420.sol").read_text()
adapter = (R / "contracts/src/compute/ComputeCapacityAwareAssignment420.sol").read_text()
snapshot = (R / "contracts/src/compute/ComputeJobWorkerSnapshotEvidence420.sol").read_text()
capacity = (R / "contracts/src/compute/ComputeWorkerCapacityReservation420.sol").read_text()
tests = (R / "contracts/test/ComputeCapacityAwareAssignment420.t.sol").read_text()
cfg = json.loads((R / "contracts/config/compute-market/cmp-2.5-capacity-aware-assignment.json").read_text())
doc = (R / "docs/compute-market/CMP-2.5-CAPACITY-AWARE-ASSIGNMENT.md").read_text()
road = (R / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md").read_text()
wf = (R / ".github/workflows/compute-market.yml").read_text()

for token in [
    "function validRequest(",
    "commitment(requestId, r.revision) == requestCommitment",
    "r.terms.deadline == deadline",
]:
    assert token in request, token

for token in [
    "contract ComputeCapacityAwareAssignment420",
    "function linkAcceptedMatch(",
    "function acceptIntoJob(",
    "function authorizedResource(",
    "marketMatches.acceptedForRequest",
    "marketMatches.commitment",
    "_resourceStillEligible",
    "offers.commitment(m.offerId, m.offerRevision) != m.offerCommitment",
    "r.revision != o.resourceRevision",
]:
    assert token in adapter, token

for token in ["capacity.reserve(", "jobs.assignWorker("]:
    assert token in snapshot, token
for token in ["function bindController(", "function reserve(", "_onlyController();", "CapacityExhausted"]:
    assert token in capacity, token

for token in [
    "testAcceptedMarketMatchConsumesCmp13ReservationAtomicallyAtWorkerAssignment",
    "testCapacityExhaustionRevertsAssignmentWithoutPartialMutation",
    "testSchedulerCannotLinkJobOrReserveCapacityDirectly",
    "testResourceRevisionDriftBlocksJobLinkBeforeCapacityMutation",
    "testMarketRequestExposesExactJobRegistryEvidenceOnly",
]:
    assert token in tests, token

assert cfg["step"] == "CMP-2.5"
assert cfg["canonicalDefinition"] == "Consume CMP-1.3 capacity reservations atomically."
assert cfg["qualificationLevel"] == 1
assert cfg["level2RequiredNow"] is False
assert cfg["nextCanonicalStep"] == "CMP-2.6 — Scheduler redundancy and non-authority"
assert "WorkerSnapshot remains the only capacity mutation authority" in doc
assert "## CMP-2.5 — Capacity-aware assignment" in road
assert "CMP-2.5 reuses the canonical CMP-1.3" in road
assert "Verify CMP-2.5 capacity-aware assignment" in wf

print("CMP-2.5 verifier: PASS")
