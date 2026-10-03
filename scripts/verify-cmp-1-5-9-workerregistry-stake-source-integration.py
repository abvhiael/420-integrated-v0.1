#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "contracts/config/compute-market/cmp-1.5.9-workerregistry-stake-source-integration.json"
IFACE = ROOT / "contracts/src/interfaces/IComputeStakeSource420.sol"
ADAPTER = ROOT / "contracts/src/compute/ComputeWorkerStake420.sol"
SOURCE = ROOT / "contracts/src/compute/ComputeStakeWorkerCollateral420.sol"
TEST_ADAPTER = ROOT / "contracts/test/ComputeWorkerStake420.t.sol"
TEST_REAL = ROOT / "contracts/test/ComputeWorkerStakeSourceIntegration420.t.sol"
TEST_READ = ROOT / "contracts/test/ComputeWorkerReadModel420.t.sol"
DOC = ROOT / "docs/compute-market/CMP-1.5.9-WORKERREGISTRY-STAKE-SOURCE-INTEGRATION.md"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

def require_text(path, needles, errors):
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            errors.append(f"{path}: missing {needle}")

def main():
    errors = []
    cfg = json.loads(CFG.read_text(encoding="utf-8"))

    if cfg.get("step") != "CMP-1.5.9":
        errors.append("step drift")
    if cfg.get("canonical_definition") != "WorkerRegistry stake-source integration":
        errors.append("canonical definition drift")
    if cfg.get("qualification", {}).get("level") != 2:
        errors.append("qualification level drift")
    if cfg.get("next_canonical_step") != "CMP-1.5.10 — ComputeEscrow slash-redistribution integration":
        errors.append("next-step drift")

    require_text(IFACE, [
        "function computeStakeSourceId()",
        "function workerRegistry()",
        "function readWorkerPosition("
    ], errors)

    require_text(SOURCE, [
        "contract ComputeStakeWorkerCollateral420",
        "function computeStakeSourceId()",
        "function workerRegistry()",
        "return address(workers);",
        "function readWorkerPosition("
    ], errors)

    require_text(ADAPTER, [
        "address workerRegistry;",
        "bytes32 sourceCodeHash;",
        "IComputeStakeSource420(source).workerRegistry()",
        "sourceWorkers != address(workers)",
        "source.codehash",
        "sourceCodeHash: codeHash",
        "if (!_bindingUsable(b)) revert InvalidSource();",
        "if (!_bindingUsable(b)) return false;",
        "r.sourceCodeHash != b.sourceCodeHash",
        "b.source.codehash != b.sourceCodeHash",
        "workerRegistry_ != address(workers)"
    ], errors)

    require_text(TEST_ADAPTER, [
        "testCompatibleMarkerWithWrongWorkerRegistryCannotBind",
        "testCompatibleComputeStakeSourceAndThresholdsQualify",
        "testLiveSlashOrExitCanRemoveNewAdmissionWithoutRewritingHistory"
    ], errors)

    require_text(TEST_REAL, [
        "testRealComputeStakeSourceBindsCanonicalWorkerRegistryAndCodeHash",
        "testRealVaultBackedCollateralControlsWorkerAdmissionAndReference",
        "testRealSourceReadMatchesCanonicalCollateralPosition",
        "stakeSource.stake{value: 120 ether}",
        "stakeSource.requestExit(positionId)"
    ], errors)

    require_text(TEST_READ, [
        "ReadStakeSourceMock420(address(workers))",
        "workerStake.bindSource(address(stakeSource), true)"
    ], errors)

    require_text(DOC, [
        "consumer side",
        "same canonical WorkerRegistry",
        "runtime code hash",
        "actual Vault-backed",
        "CMP-1.5.10 — ComputeEscrow slash-redistribution integration"
    ], errors)

    require_text(ROADMAP, [
        "### CMP-1.5.9 — WorkerRegistry stake-source integration"
    ], errors)

    milestone = cfg.get("milestone", {})
    if milestone.get("level_2_required_now") is not True:
        errors.append("Level 2 milestone missing")

    deferred = set(cfg.get("deferred", []))
    for prefix in ("CMP-1.5.10", "CMP-1.5.11", "CMP-1.5.12", "CMP-1.5.13"):
        if not any(x.startswith(prefix) for x in deferred):
            errors.append(f"missing deferred owner {prefix}")

    print(json.dumps({
        "schema": "420Integrated.ComputeMarket.CMP-1.5.9.Qualification.v1",
        "step": "CMP-1.5.9",
        "pass": not errors,
        "errors": errors,
        "level_2_milestone": True,
        "next_canonical_step": cfg.get("next_canonical_step")
    }, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
