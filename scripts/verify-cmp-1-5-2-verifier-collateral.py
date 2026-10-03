#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "contracts/config/compute-market/cmp-1.5.2-verifier-collateral.json"
SRC = ROOT / "contracts/src/compute/ComputeStakeVerifierCollateral420.sol"
IFACE = ROOT / "contracts/src/interfaces/IComputeVerifierStakeSource420.sol"
TEST = ROOT / "contracts/test/ComputeStakeVerifierCollateral420.t.sol"
DOC = ROOT / "docs/compute-market/CMP-1.5.2-VERIFIER-COLLATERAL.md"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

def require_text(path, needles, errors):
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            errors.append(f"{path}: missing {needle}")

def main():
    errors = []
    cfg = json.loads(CFG.read_text(encoding="utf-8"))

    if cfg.get("step") != "CMP-1.5.2":
        errors.append("step drift")
    if cfg.get("canonical_definition") != "Verifier collateral":
        errors.append("canonical definition drift")
    if cfg.get("qualification", {}).get("level") != 1:
        errors.append("wrong qualification level")
    if cfg.get("next_canonical_step") != "CMP-1.5.3 — Policy-specific minimum collateral":
        errors.append("next-step drift")

    require_text(ROADMAP, ["### CMP-1.5.2 — Verifier collateral"], errors)
    require_text(IFACE, [
        "interface IComputeVerifierStakeSource420",
        "function computeVerifierStakeSourceId()",
        "function readVerifierPosition"
    ], errors)
    require_text(SRC, [
        "contract ComputeStakeVerifierCollateral420",
        "IComputeVerifierStakeSource420",
        "VaultIds420.VAULT_COLLATERAL",
        "ComputeVerifierRegistry420 public immutable verifiers",
        "function stake(bytes32 verifierId, bytes32 stakePolicyId)",
        "VERIFIER_COLLATERAL_TYPE",
        "vault.depositNative{value: msg.value}()",
        "vault.createObligation(",
        "verifier.status == ComputeVerifierRegistry420.Status.RETIRED",
        "abi.encode(POSITION_DOMAIN, block.chainid, address(this), verifierId, authority, stakePolicyId)",
        "function readVerifierPosition"
    ], errors)

    require_text(TEST, [
        "testVerifierStakeIsBackedByCanonicalVaultObligation",
        "testTopUpAcrossLifecycleRevisionKeepsSameAuthorityPosition",
        "testAuthorityRotationDoesNotTransferExistingCollateral",
        "testPolicyPositionsRemainIsolated",
        "testNonAuthorityCannotStakeForVerifier",
        "testRetiredVerifierCannotAddCollateral",
        "testMissingVaultCreateGrantRevertsAtomically",
        "testDirectEthIsRejected"
    ], errors)

    require_text(DOC, [
        "CMP-1.5.2 — Verifier collateral",
        "authority rotation cannot transfer prior collateral",
        "420Vault remains the custody/accounting authority",
        "CMP-1.5.3 — Policy-specific minimum collateral"
    ], errors)

    deferred = set(cfg.get("deferred", []))
    for prefix in (
        "CMP-1.5.3","CMP-1.5.4","CMP-1.5.5","CMP-1.5.6","CMP-1.5.7",
        "CMP-1.5.8","CMP-1.5.9","CMP-1.5.10","CMP-1.5.11","CMP-1.5.12","CMP-1.5.13"
    ):
        if not any(x.startswith(prefix) for x in deferred):
            errors.append(f"missing deferred owner {prefix}")

    print(json.dumps({
        "schema":"420Integrated.ComputeMarket.CMP-1.5.2.Qualification.v1",
        "step":"CMP-1.5.2",
        "pass":not errors,
        "errors":errors,
        "next_canonical_step":cfg.get("next_canonical_step")
    }, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
