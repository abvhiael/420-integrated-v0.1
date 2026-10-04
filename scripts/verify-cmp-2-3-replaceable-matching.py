#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
contract = (ROOT / "contracts/src/compute/ComputeMatch420.sol").read_text()
tests = (ROOT / "contracts/test/ComputeMatchingEngine420.t.sol").read_text()
config = json.loads((ROOT / "contracts/config/compute-market/cmp-2.3-replaceable-matching.json").read_text())
doc = (ROOT / "docs/compute-market/CMP-2.3-REPLACEABLE-MATCHING.md").read_text()

normalized = "".join(contract.split())
required_contract = [
    "contractComputeMatch420",
    "functionpropose(",
    "functionaccept(",
    "functionproposalEligible(",
    "acceptedForRequest",
    "requests.isEffective",
    "offers.isEffective",
    "requestCommitment",
    "offerCommitment",
    "msg.sender!=r.owner",
    "r.terms.resourceClass!=o.computeClass",
    "r.terms.runtimeHash!=o.runtimeProfileHash",
    "r.terms.capabilityHash!=o.capabilityHash",
    "r.terms.jurisdictionHash!=o.jurisdictionHash",
]
for token in required_contract:
    assert token in normalized, f"missing CMP-2.3 contract gate: {token}"

# CMP-2.4 generalizes the original fixed-price budget check to a deterministic
# accepted quote ceiling while preserving the CMP-2.3 requester maximum invariant.
assert (
    "o.fixedPrice>r.terms.maximumPrice" in normalized
    or "quotedMaximum>r.terms.maximumPrice" in normalized
), "missing CMP-2.3 requester maximum-price gate"

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
assert "Status: COMPLETE — Level 1 + Level 2 exact-head qualified" in roadmap
assert "CMP-2.3-QUALIFICATION-EVIDENCE.md" in roadmap

print("CMP-2.3 verifier: PASS")
