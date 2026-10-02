#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "contracts/config/compute-market/cmp-2.1-worker-offers.json"
OFFER = ROOT / "contracts/src/compute/ComputeOfferRegistry420.sol"
AUTH = ROOT / "contracts/src/compute/ComputeAuthorization420.sol"
TEST = ROOT / "contracts/test/ComputeWorkerOffers420.t.sol"
SDK = ROOT / "packages/420-sdk/src/compute.ts"
SDK_TEST = ROOT / "packages/420-sdk/test/compute-sdk.test.mjs"
DOC = ROOT / "docs/compute-market/CMP-2.1-WORKER-OFFERS.md"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

def require_text(path, needles, errors):
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            errors.append(f"{path}: missing {needle}")

def main():
    errors = []
    cfg = json.loads(CFG.read_text(encoding="utf-8"))
    if cfg.get("step") != "CMP-2.1":
        errors.append("step drift")
    if cfg.get("canonical_definition") != "Advertise hardware/software capacity, availability, jurisdiction and price.":
        errors.append("canonical definition drift")
    if cfg.get("qualification", {}).get("level") != 1:
        errors.append("qualification level drift")
    if cfg.get("qualification", {}).get("level_2_required_now") is not False:
        errors.append("unexpected Level 2 requirement")
    if cfg.get("next_canonical_step") != "CMP-2.2 — Compute requests":
        errors.append("next-step drift")

    require_text(OFFER, [
        "contract ComputeOfferRegistry420 is I420System",
        "function publishWorkerOffer(",
        "function updateOffer(",
        "function cancel(bytes32 offerId)",
        "bytes32 jurisdictionHash",
        "uint64 availableFrom",
        "uint256 capacityUnits",
        "bytes32 hardwareProfileHash",
        "bytes32 runtimeProfileHash",
        "bytes32 capabilityHash",
        "mapping(bytes32 => mapping(uint64 => Offer)) private _history",
        "authorization.ACTION_PUBLISH_OFFER()",
        "authorization.ACTION_UPDATE_OFFER()",
        "authorization.ACTION_CANCEL_OFFER()",
        "authorization.scopeResource(providerId, nodeId, resourceId)",
        "block.timestamp < o.availableFrom",
        "r.revision != o.resourceRevision",
        "r.hardwareProfileHash != o.hardwareProfileHash",
        "r.runtimeProfileHash != o.runtimeProfileHash",
        "r.capabilityHash != o.capabilityHash",
        "r.capacityUnits != o.capacityUnits",
        "LEGACY_JURISDICTION"
    ], errors)

    require_text(AUTH, [
        "ACTION_PUBLISH_OFFER",
        "ACTION_UPDATE_OFFER",
        "ACTION_CANCEL_OFFER"
    ], errors)

    require_text(TEST, [
        "testWorkerOfferAdvertisesCanonicalResourceAvailabilityJurisdictionAndPrice",
        "testResourceDriftInvalidatesUntilAuthorizedOfferRevisionRefreshesSnapshot",
        "testScopedDelegateCanPublishUpdateAndCancelButWrongScopeAndOutsiderFail",
        "testWrongResourceScopeAndPriceLimitFailClosed",
        "testInvalidWindowJurisdictionAndResourceRevisionFailClosed",
        "testLegacyFixedPricePublishRemainsDirectOperatorCompatible"
    ], errors)

    require_text(SDK, [
        "COMPUTE_WORKER_OFFER_SCHEMA_420",
        "export interface ComputeWorkerOffer420",
        "validateComputeWorkerOffer420",
        "worker offer availability window is invalid",
        "worker offer contains an empty canonical commitment"
    ], errors)

    require_text(SDK_TEST, [
        "validates canonical CMP-2.1 worker-offer schema and exact revision",
        "rejects malformed, stale, unavailable, zero-capacity, zero-price and empty-jurisdiction worker offers"
    ], errors)

    require_text(DOC, [
        "# CMP-2.1 — Worker offers",
        "hardware profile commitment",
        "runtime/software profile commitment",
        "jurisdiction commitment",
        "ACTION_UPDATE_OFFER",
        "CMP-2.2 — Compute requests"
    ], errors)

    require_text(ROADMAP, [
        "## CMP-2.1 — Worker offers",
        "Advertise hardware/software capacity, availability, jurisdiction and price."
    ], errors)

    print(json.dumps({
        "schema": "420Integrated.ComputeMarket.CMP-2.1.Qualification.v1",
        "step": "CMP-2.1",
        "pass": not errors,
        "errors": errors,
        "qualification_level": 1,
        "level_2_required_now": False,
        "next_canonical_step": cfg.get("next_canonical_step")
    }, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
