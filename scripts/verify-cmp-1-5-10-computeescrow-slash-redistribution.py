#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "contracts/config/compute-market/cmp-1.5.10-computeescrow-slash-redistribution.json"
RESOLVER = ROOT / "contracts/src/compute/ComputeVerifierDisputeSlashRecipientResolver420.sol"
DIST = ROOT / "contracts/src/compute/ComputeStakeSlashDistribution420.sol"
WORKER = ROOT / "contracts/src/compute/ComputeStakeWorkerCollateral420.sol"
VERIFIER = ROOT / "contracts/src/compute/ComputeStakeVerifierCollateral420.sol"
ESCROW_TEST = ROOT / "contracts/test/ComputeVerifiedEntitlement420.t.sol"
RESOLVER_TEST = ROOT / "contracts/test/ComputeVerifierDisputeSlashRecipientResolver420.t.sol"
CLOSEOUT = ROOT / "contracts/config/compute-market/cmp-1.2.10-phase-closeout.json"
CLOSEOUT_VERIFY = ROOT / "scripts/verify-cmp-1-2-10-closeout.py"
DOC = ROOT / "docs/compute-market/CMP-1.5.10-COMPUTEESCROW-SLASH-REDISTRIBUTION.md"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

def require_text(path, needles, errors):
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            errors.append(f"{path}: missing {needle}")

def main():
    errors = []
    cfg = json.loads(CFG.read_text(encoding="utf-8"))
    closeout = json.loads(CLOSEOUT.read_text(encoding="utf-8"))

    if cfg.get("step") != "CMP-1.5.10":
        errors.append("step drift")
    if cfg.get("canonical_definition") != "ComputeEscrow slash-redistribution integration":
        errors.append("canonical definition drift")
    if cfg.get("qualification", {}).get("level") != 2:
        errors.append("qualification level drift")
    if cfg.get("next_canonical_step") != "CMP-1.5.11 — Hostile economic qualification":
        errors.append("next-step drift")

    require_text(RESOLVER, [
        "address public immutable canonicalEntitlements",
        "bytes32 public immutable canonicalEntitlementsCodeHash",
        "address entitlements_ = disputes.entitlements()",
        "canonicalEntitlements = entitlements_",
        "canonicalEntitlementsCodeHash = entitlements_.codehash",
        "entitlements != canonicalEntitlements",
        "entitlements.codehash != canonicalEntitlementsCodeHash",
        "recipients.harmedPayer = payer",
        "recipients.challenger = r.claimant"
    ], errors)

    require_text(RESOLVER_TEST, [
        "testResolverFreezesCanonicalEscrowEntitlementsRuntime",
        "resolver.canonicalEntitlements()",
        "resolver.canonicalEntitlementsCodeHash()",
        "disputes.setEntitlements(address(replacement))",
        "entitlement endpoint drift accepted"
    ], errors)

    require_text(ESCROW_TEST, [
        "testObjectiveVerifierSlashResolverUsesCanonicalEscrowPayerWithoutMutatingEscrow",
        "disputes.OBJECTIVE_VERIFIER_ERROR_GROUND()",
        "resolver.canonicalEntitlements() == address(entitlements)",
        "recipients.harmedPayer == payerA",
        "address(vault).balance == vaultBalanceBefore",
        "accountingAfter.recordedBalance == accountingBefore.recordedBalance",
        "refundAfter.obligationId == refundBefore.obligationId"
    ], errors)

    require_text(DIST, [
        "authorizer.workerCollateral()",
        "authorizer.verifierCollateral()",
        "IComputeSlashDistributionSource420(source).executeSlashBatch",
        "authorizer.consumeDistribution(authorizationRef)"
    ], errors)

    for path in (WORKER, VERIFIER):
        require_text(path, [
            "function executeSlashBatch(",
            "vault.cancelObligation(",
            "SLASH_DISTRIBUTION_TYPE",
            "vault.createObligation(",
            "vault.releaseObligation(",
            "vault.claim("
        ], errors)

    slash_state = closeout.get("original_compute_escrow_requirements", {}).get("slash_redistribution")
    if slash_state != "QUALIFIED_VIA_CMP_1_5_10_COLLATERAL_REDISTRIBUTION":
        errors.append("CMP-1.2 slash redistribution closeout not reconciled")

    blockers = {b.get("id") for b in closeout.get("release_blockers", [])}
    if blockers != {"CMP-1.2.9-LIVE"}:
        errors.append(f"unexpected CMP-1.2 release blockers: {sorted(blockers)}")

    require_text(CLOSEOUT_VERIFY, [
        "QUALIFIED_VIA_CMP_1_5_10_COLLATERAL_REDISTRIBUTION",
        'if blockers!={"CMP-1.2.9-LIVE"}'
    ], errors)

    require_text(DOC, [
        "does **not** debit payer escrow",
        "canonicalEntitlementsCodeHash",
        "QUALIFIED_VIA_CMP_1_5_10_COLLATERAL_REDISTRIBUTION",
        "CMP-1.2.9-LIVE",
        "CMP-1.5.11 — Hostile economic qualification"
    ], errors)

    require_text(ROADMAP, [
        "### CMP-1.5.10 — ComputeEscrow slash-redistribution integration"
    ], errors)

    milestone = cfg.get("milestone", {})
    if milestone.get("level_2_required_now") is not True:
        errors.append("Level 2 milestone missing")

    deferred = set(cfg.get("deferred", []))
    for prefix in ("CMP-1.5.11", "CMP-1.5.12", "CMP-1.5.13", "CMP-1.2.9"):
        if not any(x.startswith(prefix) for x in deferred):
            errors.append(f"missing deferred owner {prefix}")

    print(json.dumps({
        "schema": "420Integrated.ComputeMarket.CMP-1.5.10.Qualification.v1",
        "step": "CMP-1.5.10",
        "pass": not errors,
        "errors": errors,
        "level_2_milestone": True,
        "cmp_1_2_slash_redistribution": slash_state,
        "remaining_cmp_1_2_release_blockers": sorted(blockers),
        "next_canonical_step": cfg.get("next_canonical_step")
    }, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
