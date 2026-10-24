#!/usr/bin/env python3
"""Fail-closed WS8 integrated funded-hand adversarial suite ownership check.

This is a prequalification guard, not proof that an attack suite passed.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "contracts/test/BetPokerIntegratedAdversarial54.t.sol"
REQUIRED = (
    "testLegitimateFundedHandSettlement",
    "testColludingDealers",
    "testForgedRecipient",
    "testCiphertextSubstitution",
    "testRevokedKeys",
    "testCrossHandReplay",
    "testPrematureReveal",
    "testSelectiveWithholding",
    "testDisputeAbuse",
    "testDoubleSettlement",
    "testReentrancy",
)

def main() -> int:
    if not SOURCE.is_file():
        print("WS8 SECURITY FAIL: no genuine funded-hand integrated adversarial suite", file=sys.stderr)
        return 1
    source = SOURCE.read_text()
    for identifier in REQUIRED:
        if not re.search(r"\bfunction\s+" + re.escape(identifier) + r"\s*\(", source):
            print("WS8 SECURITY FAIL: missing actual named test: " + identifier, file=sys.stderr)
            return 1
    for banned in ("TestNativeGnarkBackend54", "ShuffleVerifierFixture54", "InitialDeckProofFixture54",
                   "GnarkABIFixture54", "WS3AcceptedShuffle", "WS3AlwaysAuthorized"):
        if re.search(r"\b" + re.escape(banned) + r"\b", source):
            print("WS8 SECURITY FAIL: inadmissible fixture in real-verifier security owner: " + banned, file=sys.stderr)
            return 1
    print("WS8 source preflight OK; full cryptographic qualification must execute Foundry tests separately")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
