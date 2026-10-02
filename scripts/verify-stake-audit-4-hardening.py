#!/usr/bin/env python3
"""Verify STAKE-AUDIT-4 security/property/invariant hardening anchors."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

EXPECTED = {
    "STAKE-INV-001": "custody_conservation",
    "STAKE-INV-002": "reserve_accounting_conservation",
    "STAKE-INV-003": "canonical_transition_graph",
    "STAKE-INV-004": "slash_evidence_uniqueness",
    "STAKE-INV-005": "reward_at_most_once",
    "STAKE-INV-006": "bounded_distinct_reward_participants",
    "STAKE-INV-007": "external_call_failure_atomicity",
    "STAKE-INV-008": "consensus_system_call_atomicity",
}

def fail(message: str) -> None:
    print(f"STAKE-AUDIT-4 verifier FAILED: {message}", file=sys.stderr)
    raise SystemExit(1)

def require(path: str, tokens: list[str]) -> str:
    p = ROOT / path
    if not p.is_file():
        fail(f"missing {path}")
    text = p.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            fail(f"{path} missing required token: {token}")
    return text

def main() -> int:
    matrix_path = ROOT / "contracts/config/security/stake-hardening-v1.json"
    matrix = json.loads(matrix_path.read_text(encoding="utf-8"))
    if matrix.get("step") != "STAKE-AUDIT-4":
        fail("hardening matrix step mismatch")
    if matrix.get("status") != "PRE_GENESIS_EXECUTABLE_VERIFICATION":
        fail("hardening matrix has not exited pending-hardening status")
    if matrix.get("external_audit_required") is not True:
        fail("hardening record must preserve external-audit requirement")

    actual = {entry["id"]: entry["name"] for entry in matrix.get("invariants", [])}
    if actual != EXPECTED:
        fail(f"invariant matrix mismatch: {actual!r}")

    gate = matrix.get("hardening_gate", {})
    if gate.get("validator_stake") != "CLOSED_PENDING_EXTERNAL_AUDIT":
        fail("Validator_Stake hardening gate not closed")
    if gate.get("rewards_treasuries") != "CLOSED_PENDING_EXTERNAL_AUDIT":
        fail("Rewards_Treasuries hardening gate not closed")

    registry = json.loads((ROOT / "contracts/config/security/genesis-suite-registry.json").read_text(encoding="utf-8"))
    suites = {entry["name"]: entry for entry in registry["suites"]}
    for name in ("Validator_Stake", "Rewards_Treasuries"):
        entry = suites.get(name)
        if not entry:
            fail(f"missing security suite {name}")
        if entry.get("status") != "PRE_GENESIS_EXECUTABLE_VERIFICATION":
            fail(f"{name} remains outside executable verification")
        if entry.get("evidence") != "contracts/config/security/stake-hardening-v1.json":
            fail(f"{name} evidence pointer missing")

    require("contracts/test/StakeSecurityInvariant420.t.sol", [
        "invariant_CustodyConservation",
        "invariant_ReserveAccountingConservation",
        "invariant_SlashEvidenceIsUnique",
        "invariant_RewardIsAtMostOncePerBlock",
        "invariant_MalformedOrOversizedParticipantsNeverSettle",
        "targetContract(address(handler))",
    ])
    require("contracts/test/StakeTransitionProperty420.t.sol", [
        "testFuzz_TransitionGraphMatchesCanonicalEdges",
        "_canonicalEdge",
        '"STAKE-INV-003 transition graph mismatch"',
        '"rejected transition changed status"',
    ])
    require("contracts/test/StakeRollbackAtomicity420.t.sol", [
        "testFuzz_ProtocolCreditReplacementRollbackOnReserveFailure",
        "testWithdrawalRollbackRestoresRegistryAndReserveWhenRecipientRejects",
        "testSystemCallFailureRollsBackSequenceHashAndDownstreamState",
        '"sequence advanced despite atomic revert"',
        '"call hash persisted despite atomic revert"',
    ])

    foundry = require("contracts/foundry.toml", [
        "[profile.pr.invariant]",
        "[profile.ci.invariant]",
        "[profile.hardening.invariant]",
        "runs = 4096",
        "depth = 384",
    ])
    if "fail_on_revert = true" not in foundry:
        fail("invariant profile must remain fail-on-revert")

    print("STAKE-AUDIT-4 verifier PASS: all eight invariant classes and both security-suite hardening gates are anchored")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
