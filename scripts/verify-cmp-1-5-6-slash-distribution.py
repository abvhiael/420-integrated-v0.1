#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "contracts/config/compute-market/cmp-1.5.6-slash-distribution.json"
POLICY = ROOT / "contracts/src/compute/ComputeStakeSlashDistributionPolicy420.sol"
EXECUTOR = ROOT / "contracts/src/compute/ComputeStakeSlashDistribution420.sol"
AUTH = ROOT / "contracts/src/compute/ComputeStakeSlashAuthorization420.sol"
WORKER = ROOT / "contracts/src/compute/ComputeStakeWorkerCollateral420.sol"
VERIFIER = ROOT / "contracts/src/compute/ComputeStakeVerifierCollateral420.sol"
RESOLVER = ROOT / "contracts/src/compute/ComputeVerifierDisputeSlashRecipientResolver420.sol"
DOC = ROOT / "docs/compute-market/CMP-1.5.6-SLASH-DISTRIBUTION.md"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

def require_text(path, needles, errors):
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            errors.append(f"{path}: missing {needle}")

def main():
    errors = []
    cfg = json.loads(CFG.read_text(encoding="utf-8"))

    if cfg.get("step") != "CMP-1.5.6":
        errors.append("step drift")
    if cfg.get("canonical_definition") != "Policy-bound distribution to harmed payer, replacement worker, challenger and/or protocol treasury.":
        errors.append("canonical definition drift")
    if cfg.get("qualification", {}).get("level") != 2:
        errors.append("qualification level drift")
    if cfg.get("next_canonical_step") != "CMP-1.5.7 — Reward accounting":
        errors.append("next-step drift")

    require_text(ROADMAP, [
        "### CMP-1.5.6 — Slash distribution",
        "Policy-bound distribution to harmed payer, replacement worker, challenger and/or protocol treasury."
    ], errors)

    require_text(POLICY, [
        "contract ComputeStakeSlashDistributionPolicy420",
        "slashPolicyCommitment",
        "recipientResolverCodeHash",
        "harmedPayerBps",
        "replacementWorkerBps",
        "challengerBps",
        "protocolTreasuryBps",
        "total != 10_000"
    ], errors)

    require_text(AUTH, [
        "distributionPolicyRevision",
        "distributionPolicyCommitment",
        "function bindDistribution(",
        "function consumeDistribution(",
        "candidate.authorizer() != address(this)",
        "distributionPolicies.currentPolicy(policyCommitment)"
    ], errors)

    require_text(EXECUTOR, [
        "contract ComputeStakeSlashDistribution420",
        "function executeBatch(",
        "previewSlashBatch(",
        "executeSlashBatch(",
        "authorizer.consumeDistribution(",
        "e.distributedAmount == e.totalAmount",
        "p.recipientResolver.codehash",
        "resolved.harmedPayer == a.subjectAccount"
    ], errors)

    for path, collateral_type in (
        (WORKER, "WORKER_COLLATERAL_TYPE"),
        (VERIFIER, "VERIFIER_COLLATERAL_TYPE")
    ):
        require_text(path, [
            "IComputeSlashDistributionSource420",
            "function previewSlashBatch(",
            "function executeSlashBatch(",
            "vault.cancelObligation(",
            "SLASH_REMAINDER_DOMAIN",
            "SLASH_DISTRIBUTION_TYPE",
            "vault.createObligation(",
            "vault.releaseObligation(",
            "vault.claim(",
            "p.activeAmount -= amount",
            "p.slashableAmount -= amount",
            collateral_type
        ], errors)

    require_text(RESOLVER, [
        "ComputeVerifierDisputeSlashRecipientResolver420",
        "recipients.harmedPayer = payer",
        "recipients.challenger = r.claimant",
        "recipients.replacementWorker = address(0)"
    ], errors)

    require_text(DOC, [
        "partial tranche",
        "authorization remains outstanding",
        "payer escrow remains untouched",
        "CMP-1.5.7 — Reward accounting"
    ], errors)

    milestone = cfg.get("milestone", {})
    if milestone.get("level_2_required_now") is not True:
        errors.append("Level 2 milestone missing")
    if "retained Compute*.t.sol suite" not in milestone.get("retained_app_suite", ""):
        errors.append("retained app suite missing")

    deferred = set(cfg.get("deferred", []))
    for prefix in (
        "CMP-1.5.7","CMP-1.5.8","CMP-1.5.9","CMP-1.5.10",
        "CMP-1.5.11","CMP-1.5.12","CMP-1.5.13"
    ):
        if not any(x.startswith(prefix) for x in deferred):
            errors.append(f"missing deferred owner {prefix}")

    print(json.dumps({
        "schema":"420Integrated.ComputeMarket.CMP-1.5.6.Qualification.v1",
        "step":"CMP-1.5.6",
        "pass":not errors,
        "errors":errors,
        "level_2_milestone":True,
        "next_canonical_step":cfg.get("next_canonical_step")
    }, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
