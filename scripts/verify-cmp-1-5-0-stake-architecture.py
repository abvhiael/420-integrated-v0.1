#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "contracts/config/compute-market/cmp-1.5.0-stake-architecture.json"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
DOC = ROOT / "docs/compute-market/CMP-1.5.0-STAKE-ARCHITECTURE.md"

EXPECTED_DEFINITION = "Reuse canonical $420 custody/accounting. Do not create an unrelated collateral treasury."
EXPECTED_STEPS = [f"CMP-1.5.{i}" for i in range(1, 14)]
EXPECTED_INVARIANTS = {
    "CMP-INV-005","CMP-INV-009","CMP-INV-010","CMP-INV-013","CMP-INV-018",
    "CMP-INV-019","CMP-INV-020","CMP-INV-021","CMP-INV-022","CMP-INV-023",
    "CMP-INV-025","CMP-INV-026","CMP-INV-028","CMP-INV-029","CMP-INV-030",
}

REQUIRED_PATHS = [
    "contracts/src/interfaces/IComputeStakeSource420.sol",
    "contracts/src/compute/ComputeWorkerStake420.sol",
    "contracts/src/vault/VaultRegistry420.sol",
    "contracts/src/vault/AssetVault420.sol",
    "contracts/src/vault/VaultAccounting420.sol",
    "contracts/src/vault/VaultIds420.sol",
    "contracts/src/compute/ComputeEscrowFunding420.sol",
    "contracts/src/apps/Stake420.sol",
    "docs/compute-market/CMP-1.2.0-VAULT-BASELINE-AND-ECONOMIC-DESIGN.md",
    "docs/compute-market/CMP-1.4.9-CHALLENGE-APPEAL-HOOKS.md",
]

def fail(errors, msg):
    errors.append(msg)

def require_text(path, needles, errors, label=None):
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            fail(errors, f"{label or path}: missing expected text: {needle}")

def main():
    errors = []
    if not CFG.exists():
        raise SystemExit("missing CMP-1.5.0 architecture config")
    cfg = json.loads(CFG.read_text(encoding="utf-8"))

    if cfg.get("schema") != "420Integrated.ComputeMarket.CMP-1.5.0.StakeArchitecture.v1":
        fail(errors, "schema drift")
    if cfg.get("step") != "CMP-1.5.0":
        fail(errors, "step drift")
    if cfg.get("canonical_definition") != EXPECTED_DEFINITION:
        fail(errors, "canonical definition drift")
    if cfg.get("status") not in {"IMPLEMENTED_QUALIFICATION_PENDING", "COMPLETE"}:
        fail(errors, "unexpected status")

    require_text(ROADMAP, [
        "### CMP-1.5.0 — Stake architecture",
        EXPECTED_DEFINITION,
        "## CMP-1.5 — ComputeStake",
        "stake();", "unstake();", "requestExit();", "slash();", "reward().",
    ], errors, "roadmap")

    for rel in REQUIRED_PATHS:
        if not (ROOT / rel).exists():
            fail(errors, f"missing retained architecture input: {rel}")

    by_source = {x.get("source"): x for x in cfg.get("existing_components", [])}
    for rel in [
        "contracts/src/interfaces/IComputeStakeSource420.sol",
        "contracts/src/compute/ComputeWorkerStake420.sol",
        "contracts/src/vault/VaultRegistry420.sol",
        "contracts/src/vault/AssetVault420.sol",
        "contracts/src/vault/VaultAccounting420.sol",
        "contracts/src/vault/VaultIds420.sol",
        "contracts/src/compute/ComputeEscrowFunding420.sol",
        "contracts/src/apps/Stake420.sol",
    ]:
        if rel not in by_source:
            fail(errors, f"component inventory missing {rel}")

    custody = cfg.get("canonical_custody_model", {})
    expected_custody = {
        "custody_family": "420Vault",
        "vault_contract": "AssetVault420",
        "registry": "VaultRegistry420",
        "accounting": "VaultAccounting420",
        "vault_type": "VaultIds420.VAULT_COLLATERAL",
        "canonical_asset": "native $420",
        "canonical_asset_address": "address(0)",
        "dedicated_compute_collateral_vault": True,
        "parallel_staking_treasury": False,
        "direct_compute_stake_balance_custody": False,
        "payer_escrow_reuse": False,
    }
    for key, value in expected_custody.items():
        if custody.get(key) != value:
            fail(errors, f"custody model drift: {key}={custody.get(key)!r}")

    require_text(ROOT / "contracts/src/vault/VaultIds420.sol", [
        'VAULT_COLLATERAL = keccak256("420/VAULT/TYPE/COLLATERAL/V1")',
        "ACTION_CREATE_OBLIGATION",
        "ACTION_RELEASE_OBLIGATION",
        "ACTION_CANCEL_OBLIGATION",
        "ACTION_CLAIM",
    ], errors, "VaultIds420")

    require_text(ROOT / "contracts/src/interfaces/IComputeStakeSource420.sol", [
        "interface IComputeStakeSource420",
        "computeStakeSourceId()",
        "readWorkerPosition",
        "activeAmount",
        "slashableAmount",
        "exiting",
        "withdrawableAt",
    ], errors, "IComputeStakeSource420")

    require_text(ROOT / "contracts/src/compute/ComputeWorkerStake420.sol", [
        "This contract never custodies stake",
        "EXPECTED_SOURCE_ID",
        "readWorkerPosition",
        "positionPasses",
    ], errors, "ComputeWorkerStake420")

    require_text(ROOT / "docs/compute-market/CMP-1.2.0-VAULT-BASELINE-AND-ECONOMIC-DESIGN.md", [
        "separately backed and actually forfeited CMP-1.5 stake/collateral",
        "not payer deposits",
    ], errors, "CMP-1.2 custody boundary")

    require_text(ROOT / "docs/compute-market/CMP-1.4.9-CHALLENGE-APPEAL-HOOKS.md", [
        "does not call a stake contract",
        "objective evidence",
        "bounded sanction",
    ], errors, "CMP-1.4.9 slash boundary")

    non_substitutes = set(cfg.get("non_substitutes", []))
    required_non_substitute_fragments = [
        "validator bond state",
        "wallet balance",
        "payer-funded ComputeEscrow",
        "Treasury",
        "420Trust",
        "verification verdict",
    ]
    for frag in required_non_substitute_fragments:
        if not any(frag in item for item in non_substitutes):
            fail(errors, f"missing non-substitute boundary: {frag}")

    ownership = cfg.get("step_ownership", [])
    owner_steps = [x.get("step") for x in ownership]
    if owner_steps != EXPECTED_STEPS:
        fail(errors, f"CMP-1.5 substep ownership drift: {owner_steps}")

    invariants = set(cfg.get("frozen_invariants", []))
    if invariants != EXPECTED_INVARIANTS:
        fail(errors, f"invariant set drift: {sorted(invariants)}")

    deployment = cfg.get("deployment_state", {})
    if deployment.get("new_fixed_predeploy") is not False:
        fail(errors, "architecture must not claim a new fixed predeploy")
    for key in ("live_compute_stake_address", "live_collateral_vault_address"):
        if deployment.get(key) is not None:
            fail(errors, f"unexpected live address claim: {key}")
    if deployment.get("protocol_registry_publication") is not False:
        fail(errors, "unexpected ProtocolRegistry publication claim")
    if deployment.get("runtime_code_hash_verified") is not False:
        fail(errors, "unexpected runtime code-hash claim")

    qualification = cfg.get("qualification", {})
    if qualification.get("level") != 1:
        fail(errors, "CMP-1.5.0 must remain Level 1")
    if cfg.get("next_canonical_step") != "CMP-1.5.1 — Worker collateral":
        fail(errors, "next canonical step drift")

    require_text(DOC, [
        EXPECTED_DEFINITION,
        "dedicated Compute collateral Vault instance",
        "not a second treasury",
        "CMP-1.5.1 — Worker collateral",
    ], errors, "architecture doc")

    out = {
        "schema": "420Integrated.ComputeMarket.CMP-1.5.0.Qualification.v1",
        "step": "CMP-1.5.0",
        "pass": not errors,
        "errors": errors,
        "canonical_custody": "420Vault/AssetVault420/VaultAccounting420",
        "parallel_staking_treasury": False,
        "next_canonical_step": cfg.get("next_canonical_step"),
    }
    print(json.dumps(out, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
