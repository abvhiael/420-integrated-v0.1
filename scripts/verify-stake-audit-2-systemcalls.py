#!/usr/bin/env python3
"""Verify STAKE-AUDIT-2 production system-call derivation anchors."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

EXPECTED_ROUTES = [
    ("420/SYSCALL/VALIDATOR_STATE/V1", "0x0000000000000000000000000000000000000423", "applyConsensusState", "17e619d8"),
    ("420/SYSCALL/VALIDATOR_EXIT_NOTICE/V1", "0x0000000000000000000000000000000000000423", "applyExitNotice", "3dc84ed0"),
    ("420/SYSCALL/VALIDATOR_SLASH/V1", "0x0000000000000000000000000000000000000423", "applySlash", "0c6c5204"),
    ("420/SYSCALL/ROTATION_SNAPSHOT/V1", "0x0000000000000000000000000000000000000423", "applyRotationSnapshot", "6594414c"),
    ("420/SYSCALL/REWARD/V1", "0x0000000000000000000000000000000000000420", "applyConsensusReward", "ac11b5e1"),
]


def fail(message: str) -> None:
    print(f"STAKE-AUDIT-2 verifier FAILED: {message}", file=sys.stderr)
    raise SystemExit(1)


def require_tokens(path: str, tokens: list[str]) -> str:
    p = ROOT / path
    if not p.is_file():
        fail(f"missing required file {path}")
    text = p.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            fail(f"{path} missing required token: {token}")
    return text


def main() -> int:
    cfg_path = ROOT / "contracts/config/consensus-system-call.json"
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    actual_routes = [(r["domain"], r["target"], r["method"]) for r in cfg["routes"]]
    expected_cfg = [(domain, target, method) for domain, target, method, _ in EXPECTED_ROUTES]
    if actual_routes != expected_cfg:
        fail(f"frozen route drift: {actual_routes!r}")

    derivation = require_tokens(
        "consensus/systemcall/stake_derivation.go",
        [
            "func BuildStakeBatch(",
            "func GrossBlockIssuance(",
            "func DeriveRewardSettlement(",
            "func DeriveSlashSettlement(",
            "ValidatorRegistryTarget = Address{18: 0x04, 19: 0x23}",
            "RewardControllerTarget  = Address{18: 0x04, 19: 0x20}",
            "issuanceReductionInterval uint64 = 420_000",
            "issuanceFloorEra          uint64 = 340",
            "minSecurityAllocation            = uint64(283_446_712_018)",
            "maxSecurityAllocation            = uint64(500_000_000_000)",
        ],
    )
    for domain, _target, _method, selector in EXPECTED_ROUTES:
        if domain not in derivation:
            fail(f"Go derivation missing action {domain}")
        selector_bytes = ", ".join(f"0x{selector[i:i+2]}" for i in range(0, 8, 2))
        if selector_bytes not in derivation:
            fail(f"Go derivation missing selector bytes {selector}")

    require_tokens(
        "consensus/systemcall/sequence_state.go",
        [
            "420-stake-systemcall-sequence-v1",
            "RequireCanonicalParent",
            "RecoverCanonicalParent",
            "CommitCanonicalChild",
            "ErrSequenceRecoveryRequired",
            "os.CreateTemp",
            "tmp.Sync()",
            "os.Rename",
        ],
    )
    require_tokens(
        "consensus/engine/stake_systemcalls.go",
        [
            "ForkchoiceUpdatedV3WithFinalizedStakeOutcomes",
            "NewPayloadV3WithFinalizedStakeOutcomes",
            "sequences.BuildNext(parent, outcomes)",
        ],
    )
    require_tokens(
        "consensus/systemcall/stake_derivation_test.go",
        ["TestStakeABIPayloadVectors", "TestSequenceManagerPersistenceAndExplicitRecovery"],
    )
    require_tokens(
        "contracts/test/StakeSystemCallABIVectors420.t.sol",
        [
            "testExactStakeSystemCallABIVectors",
            "ValidatorRegistry.applyConsensusState.selector",
            "ValidatorRegistry.applySlash.selector",
            "RewardController.applyConsensusReward.selector",
        ],
    )
    adr = require_tokens(
        "docs/architecture/decisions/STAKE-AUDIT-2-SYSTEM-CALL-DERIVATION.md",
        ["STAKE-AUDIT-2", "Sequence persistence and recovery", "Reward derivation", "Slash derivation"],
    )
    for *_prefix, selector in EXPECTED_ROUTES:
        if f"0x{selector}" not in adr:
            fail(f"ADR missing selector 0x{selector}")

    print("STAKE-AUDIT-2 verifier PASS: frozen routes, derivation, sequence recovery, Engine wiring and ABI-vector tests present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
