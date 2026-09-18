#!/usr/bin/env python3
"""Validate the GEN-SVC-1 420Reputation Genesis profile."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROFILE = ROOT / "config" / "420reputation-genesis.json"
TRUST_MODEL = ROOT / "docs" / "420-TRUST-V1-MODEL.md"
DOC = ROOT / "docs" / "genesis-services" / "GEN-SVC-1-REPUTATION.md"


def load(path: Path):
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def main() -> int:
    errors: list[str] = []
    for path in (PROFILE, TRUST_MODEL, DOC):
        require(path.exists(), f"missing required file: {path.relative_to(ROOT)}", errors)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    profile = load(PROFILE)
    trust_text = TRUST_MODEL.read_text(encoding="utf-8")
    doc_text = DOC.read_text(encoding="utf-8")

    require(profile.get("schema") == "420-reputation-genesis-v1", "unexpected reputation schema", errors)
    require(profile.get("serviceId") == "420/service/reputation/v1", "unexpected reputation service ID", errors)
    require(profile.get("canonicalTrustProtocol") == "420Trust V1", "420Trust V1 must remain canonical evidence protocol", errors)
    require("does **not** assign a universal" in trust_text, "420Trust universal-score exclusion missing", errors)

    authority = profile.get("authority", {})
    for key in (
        "createsUniversalScore",
        "createsIdentityAuthority",
        "createsWalletAuthority",
        "createsSettlementAuthority",
        "createsGovernanceOrValidatorWeight",
    ):
        require(authority.get(key) is False, f"authority invariant violated: {key}", errors)
    require(authority.get("canonicalEvidenceOwner") == "420Trust", "canonical evidence owner must be 420Trust", errors)
    require(authority.get("reviewTextCanonical") is False, "review text must not be canonical protocol state", errors)

    domains = profile.get("domains", [])
    domain_ids = [item.get("id") for item in domains]
    required_domains = {"marketplace","classifieds","travel","employer","freelancer","creator","crowdfunding","community","education"}
    require(required_domains.issubset(set(domain_ids)), f"missing domains: {sorted(required_domains-set(domain_ids))}", errors)
    require(len(domain_ids) == len(set(domain_ids)), "duplicate reputation domain IDs", errors)

    review = profile.get("review", {})
    scale = review.get("ratingScale", {})
    require(scale.get("min") == 1 and scale.get("max") == 5 and scale.get("integerOnly") is True, "rating scale must be integer 1-5", errors)
    require(review.get("bodyStorage") == "OFF_CHAIN", "review bodies must be off-chain", errors)
    require(review.get("attachmentsStorage") == "OFF_CHAIN", "review attachments must be off-chain", errors)
    require(review.get("oneReviewPerVerifiedInteraction") is True, "one review per verified interaction must be enforced", errors)
    require(review.get("businessResponse") == "SUPPORTED", "review responses must be supported", errors)

    signals = profile.get("trustSignals", {})
    require(signals.get("subjectiveStarRatingAsCanonicalTrustSignal") is False, "subjective star ratings cannot be canonical Trust signals", errors)
    require(signals.get("requiresExactMetricAuthorization") is True, "Trust signals require exact metric authorization", errors)
    require(signals.get("requiresEvidenceReplayProtection") is True, "Trust signals require evidence replay protection", errors)

    sybil = profile.get("antiSybil", {})
    require(sybil.get("duplicateInteractionReviewBlocked") is True, "duplicate interaction review must be blocked", errors)
    require(sybil.get("selfReviewBlocked") is True, "self review must be blocked", errors)
    require(sybil.get("stakeWeightedReputation") is False, "stake-weighted reputation is forbidden", errors)
    require(sybil.get("walletBalanceWeightedReputation") is False, "wallet-balance-weighted reputation is forbidden", errors)
    require(sybil.get("rateLimitsRequired") is True, "rate limits are required", errors)
    require(sybil.get("confidenceIsApplicationPolicyNotCanonicalTruth") is True, "display confidence must remain application policy", errors)

    moderation = profile.get("moderation", {})
    require(moderation.get("mayRewriteTrustHistory") is False, "moderation cannot rewrite Trust history", errors)
    require(moderation.get("mayTransferAssets") is False, "moderation cannot transfer assets", errors)
    require(moderation.get("mayRevokeIdentity") is False, "moderation cannot revoke Identity", errors)

    portable = profile.get("portableView", {})
    included = set(portable.get("includes", []))
    require({"domainId","policyVersion","verifiedReviewCount","ratingDistribution","trustMetrics"}.issubset(included), "portable view missing required fields", errors)
    forbidden = set(portable.get("forbids", []))
    require({"universalScore","hiddenCrossDomainScore","creditScore","validatorWeight","governanceWeight"}.issubset(forbidden), "portable view missing forbidden-score protections", errors)

    privacy = profile.get("privacy", {})
    require(privacy.get("noSensitivePlaintextOnChain") is True, "sensitive plaintext must stay off-chain", errors)
    require(privacy.get("reviewBodiesExcludedFromTrustState") is True, "review bodies must be excluded from Trust state", errors)

    api = profile.get("api", {})
    endpoints = set(api.get("endpoints", []))
    required_endpoints = {
        "GET /v1/reputation/{domainId}/{subjectType}/{subjectId}",
        "GET /v1/reviews/{domainId}/{subjectType}/{subjectId}",
        "POST /v1/reviews",
        "PATCH /v1/reviews/{reviewId}",
        "POST /v1/reviews/{reviewId}/response",
        "POST /v1/reviews/{reviewId}/report",
        "GET /v1/interactions/{evidenceRef}/verification",
        "GET /v1/policy/{domainId}",
    }
    require(required_endpoints.issubset(endpoints), f"missing reputation endpoints: {sorted(required_endpoints-endpoints)}", errors)
    require(api.get("writeIdempotencyRequired") is True, "write idempotency must be required", errors)

    invariants = set(profile.get("invariants", []))
    required_invariants = {f"REP-INV-{i:03d}_" for i in range(1, 11)}
    for prefix in required_invariants:
        require(any(item.startswith(prefix) for item in invariants), f"missing invariant prefix {prefix}", errors)

    consumers = set(profile.get("genesisConsumers", []))
    required_consumers = {"420Classifieds","420Travel","420Launchpad Crowdfunding","420Learn + 420Knowledge","420Town Community Boards","420Freelance"}
    require(required_consumers.issubset(consumers), f"missing Genesis consumers: {sorted(required_consumers-consumers)}", errors)

    for step in range(1, 11):
        require(f"GEN-SVC-1.{step}" in doc_text, f"documentation missing GEN-SVC-1.{step}", errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    print("GEN-SVC-1 validation: PASS")
    print(f"validated {len(domains)} reputation domains and {len(endpoints)} API endpoints")
    return 0


if __name__ == "__main__":
    sys.exit(main())
