#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
contract = (ROOT / "contracts/src/compute/ComputeMatch420.sol").read_text()
tests = (ROOT / "contracts/test/ComputeMatchingEngine420.t.sol").read_text()
config = json.loads((ROOT / "contracts/config/compute-market/cmp-2.3-replaceable-matching.json").read_text())
doc = (ROOT / "docs/compute-market/CMP-2.3-REPLACEABLE-MATCHING.md").read_text()

required_contract = [
    "contract ComputeMatch420",
    "function propose(",
    "function accept(",
    "function proposalEligible(",
    "acceptedForRequest",
    "requests.isEffective",
    "offers.isEffective",
    "requestCommitment",
    "offerCommitment",
    "msg.sender != r.owner",
    "r.terms.resourceClass != o.computeClass",
    "r.terms.runtimeHash != o.runtimeProfileHash",
    "r.terms.capabilityHash != o.capabilityHash",
    "r.terms.jurisdictionHash != o.jurisdictionHash",
    "o.fixedPrice > r.terms.maximumPrice",
]
for token in required_contract:
    assert token in contract, f"missing CMP-2.3 contract gate: {token}"

required_tests = [
    "testReplaceableSchedulersCanProposeButDoNotOwnAuthority",
    "testOwnerAcceptsOneProposalAndImmutableSnapshotWins",
    "testRequestRevisionMakesSchedulerProposalStale",
    "testOfferRevisionMakesSchedulerProposalStale",
    "testContractRejectsIncompatiblePriceWithoutAllocatingProposal",
    "testContractRejectsResourceDriftAndPreservesFailedAcceptanceAtomicity",
]
for token in required_tests:
    assert token in tests, f"missing CMP-2.3 test: {token}"

assert config["step"] == "CMP-2.3"
assert config["qualificationLevel"] == 2
assert config["schedulerAuthority"] == "proposal-only"
assert config["acceptanceAuthority"] == "request-owner"
assert "Schedulers propose matches; contracts remain authoritative." in doc
assert "Level 3 remains reserved for CMP-2.8" in doc

workflow = (ROOT / ".github/workflows/compute-market.yml").read_text()
assert "Verify CMP-2.3 replaceable matching engine" in workflow
assert "python scripts/verify-cmp-2-3-replaceable-matching.py" in workflow

roadmap = (ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md").read_text()
assert "## CMP-2.3 — Replaceable matching engine" in roadmap
assert "implementation / Level 1 + Level 2 qualification in progress" in roadmap

print("CMP-2.3 verifier: PASS")
