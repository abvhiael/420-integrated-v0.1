#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors = []

def require(cond, msg):
    if not cond:
        errors.append(msg)

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def load(path):
    return json.loads(read(path))

src = ROOT / "contracts/src/launchpad"
required = [
    "LaunchpadIds420.sol",
    "LaunchpadAuthorization420.sol",
    "LaunchpadProjectRegistry420.sol",
    "LaunchpadSaleRegistry420.sol",
    "LaunchpadAllocationRegistry420.sol",
    "LaunchpadRouter420.sol",
    "ILaunchpadCrowdfundingIntegration420.sol",
    "LaunchpadCrowdfundingIntegration420.sol",
]
for name in required:
    require((src / name).is_file(), f"missing Launchpad source: {name}")

cfg = load("contracts/config/420launchpad-genesis.json")
require(cfg.get("schema") == "420-launchpad-genesis-v1", "unexpected Launchpad genesis schema")
boundary = cfg.get("boundary", {})
for key in ("custody", "minting", "dex", "payment_execution"):
    require(boundary.get(key) is False, f"V1 boundary drift: {key} must remain false")
invariants = cfg.get("invariants", [])
for n in range(1, 11):
    prefix = f"LAUNCHPAD-INV-{n:03d}:"
    require(any(x.startswith(prefix) for x in invariants), f"missing invariant {prefix}")

svc = read("contracts/src/libraries/ServiceIds420.sol")
require('keccak256("420/service/launchpad/v1")' in svc, "canonical launchpad service ID missing")

consumer = load("config/genesis-consumer-services.json")
crowd = next(
    (x for x in consumer.get("services", []) if x.get("id") == "420/service/launchpad-crowdfunding/v1"),
    None,
)
require(crowd is not None, "Launchpad crowdfunding consumer-service target missing")
if crowd:
    require(
        crowd.get("authority") == "APPLICATION_WITH_CONTRACT_BACKED_SETTLEMENT",
        "crowdfunding authority drift",
    )
    require(
        crowd.get("genesis_target") == "reward_donation_community_project_product_preorder",
        "crowdfunding Genesis target drift",
    )
    expected = {"420 Identity", "420 Pay", "420 Arbitration", "420Reputation", "420 Notifications"}
    require(expected.issubset(set(crowd.get("depends_on", []))), "crowdfunding dependencies drift")

flags = {x["key"]: x.get("genesis_default") for x in consumer.get("feature_flags", [])}
require(flags.get("launchpad.securities_or_equity") is False, "securities/equity must remain disabled")

recon = load("contracts/config/interfaces/420launchpad-dependency-reconciliation.json")
require(recon["protocol"]["boundary"] == "NON_CUSTODIAL_COMMITMENT_REGISTRY", "protocol boundary reconciliation drift")
require(
    recon["genesisFacingCrowdfunding"]["securitiesOrEquityEnabled"] is False,
    "crowdfunding feature-gate drift",
)
dep_status = {
    x["name"]: x["status"] for x in recon["genesisFacingCrowdfunding"].get("dependencies", [])
}
for name in ("420 Identity", "420 Pay", "420 Arbitration"):
    require(dep_status.get(name) == "REPOSITORY_INTEGRATED", f"{name} integration status drift")
for name in ("420Reputation", "420 Notifications"):
    require(
        dep_status.get(name) == "REPOSITORY_INTEGRATED_EVENT_BOUNDARY",
        f"{name} event-boundary status drift",
    )

hardening = load("contracts/config/interfaces/420launchpad-v1-hardening.json")
require(hardening.get("schema") == "420-launchpad-v1-hardening-v1", "unexpected V1 hardening schema")
require(hardening.get("serviceId") == "420/service/launchpad/v1", "V1 hardening service ID drift")
require(hardening.get("scope") == "NON_CUSTODIAL_COMMITMENT_REGISTRY", "V1 hardening scope drift")
commitments = hardening.get("commitments", {})
for kind in ("payment", "delivery", "refund"):
    policy = commitments.get(kind, {})
    require(policy.get("requiredNonzero") is True, f"{kind} commitment must remain nonzero")
    require(
        policy.get("uniquenessEnforcedByBaseV1") is False,
        f"{kind} base V1 uniqueness semantics drift",
    )
    require(
        policy.get("crowdfundingReplayProtection") is True,
        f"{kind} crowdfunding replay protection drift",
    )
require(
    commitments["payment"].get("canonicalSettlementBindingImplementedBy")
    == "LaunchpadCrowdfundingIntegration420",
    "payment settlement integration drift",
)
require(
    commitments["refund"].get("canonicalRefundBindingImplementedBy")
    == "LaunchpadCrowdfundingIntegration420",
    "refund integration drift",
)
rounding = hardening.get("allocationRounding", {})
require(rounding.get("participantClaimsNeverExceedAllocation") is True, "allocation conservation policy drift")
require(rounding.get("residualDust") == "UNASSIGNED_ACCOUNTING_DUST", "allocation dust semantics drift")
require(rounding.get("dustCustody") is False, "V1 must not custody rounding dust")
require(rounding.get("sweepAuthority") is False, "V1 must not gain dust sweep authority")
project_active = hardening.get("projectActive", {})
require(project_active.get("semantics") == "IMMUTABLE_REGISTRATION_MARKER", "project active semantics drift")
require(project_active.get("mutableLifecycleControl") is False, "project active lifecycle drift")
sec = hardening.get("securityBoundary", {})
for key in ("custody", "minting", "paymentExecution", "refundExecution", "deliveryExecution", "swapAuthority"):
    require(sec.get(key) is False, f"V1 hardening security boundary drift: {key}")

integration = load("contracts/config/interfaces/420launchpad-crowdfunding-integration.json")
require(integration.get("schema") == "420-launchpad-crowdfunding-integration-v1", "Audit-3 integration schema drift")
require(integration.get("step") == "LAUNCHPAD-AUDIT-3", "Audit-3 step identity drift")
require(integration.get("serviceId") == "420/service/launchpad-crowdfunding/v1", "crowdfunding service ID drift")
require(integration.get("authority") == "APPLICATION_WITH_CONTRACT_BACKED_SETTLEMENT", "crowdfunding integration authority drift")
require(
    integration.get("genesisTarget")
    == ["reward", "donation", "community_project", "product_preorder"],
    "approved crowdfunding mode set drift",
)
require(integration.get("securitiesOrEquityEnabled") is False, "Audit-3 securities/equity must remain disabled")
ideps = integration.get("dependencies", {})
pay = ideps.get("420Pay", {})
require(pay.get("contributionRequiredStatus") == "SETTLED", "Pay settled-state binding drift")
for rule in (
    "payer == participant",
    "merchant == sale.proceedsReceiver",
    "settlementAsset == sale.paymentAsset",
    "settlementAmount == contributionAmount",
    "receiptHash != bytes32(0)",
):
    require(rule in pay.get("bindings", []), f"Pay binding missing: {rule}")
require(pay.get("paymentIdGlobalReplayProtection") is True, "Pay replay protection drift")
identity = ideps.get("420Identity", {})
require(identity.get("participantControllerBindingRequired") is True, "Identity controller binding drift")
require(identity.get("activeProfileRequired") is True, "Identity active-profile binding drift")
require(identity.get("salePolicyHashUsedAsCredentialType") is True, "Identity eligibility-policy binding drift")
arbitration = ideps.get("420Arbitration", {})
require(
    arbitration.get("requiredDomain") == "420/arbitration/domain/launchpad-crowdfunding/v1",
    "Arbitration crowdfunding domain drift",
)
require(arbitration.get("requiredOriginObject") == "saleId", "Arbitration sale origin drift")
require(arbitration.get("arbitrationAuthorityTransferredToLaunchpad") is False, "Launchpad must not gain Arbitration authority")
rep = ideps.get("420Reputation", {})
require(rep.get("domain") == "CROWDFUNDING", "Reputation domain drift")
require(rep.get("interactionKinds") == ["CONTRIBUTION", "REWARD_DELIVERY"], "Reputation interaction kinds drift")
require(rep.get("universalScoreAuthority") is False, "Reputation universal-score authority drift")
notify = ideps.get("420Notifications", {})
require(
    notify.get("eventTypes") == ["CONTRIBUTION", "REFUND", "DELIVERY", "DISPUTE", "RULING"],
    "Notification event type drift",
)
require(notify.get("deterministicEventId") is True, "Notification replay identity drift")
require(notify.get("notificationAuthority") is False, "Notifications authority drift")
require(integration.get("milestone", {}).get("level2RequiredNow") is True, "Audit-3 Level 2 milestone drift")

integration_src = read("contracts/src/launchpad/LaunchpadCrowdfundingIntegration420.sol")
for needle in (
    "enum CampaignMode",
    "REWARD,",
    "DONATION,",
    "COMMUNITY_PROJECT,",
    "PRODUCT_PREORDER",
    "status != PAY_STATUS_SETTLED",
    "payer != participant",
    "merchant != sale_.proceedsReceiver",
    "settlementAsset != sale_.paymentAsset",
    "settlementAmount != amount",
    "identity.hasValidCredential(profileId, sale_.eligibilityPolicyHash)",
    "usedPaymentId[paymentId]",
    "preparedRefundCommitment",
    "usedRefundCommitment",
    "usedDeliveryCommitment",
    "arbitrationCases.caseOrigin(caseId)",
    "publishedDisputeOutcome",
    "ReputationEvidencePublished",
    "NotificationPublished",
):
    require(needle in integration_src, f"crowdfunding integration implementation missing: {needle}")

allocation_src = read("contracts/src/launchpad/LaunchpadAllocationRegistry420.sol")
for needle in (
    "setCrowdfundingIntegration",
    "consumeContribution",
    "consumeRefund",
    "recordDelivery",
):
    require(needle in allocation_src, f"allocation integration boundary missing: {needle}")

arbitration_src = read("contracts/src/arbitration/ArbitrationCaseRegistry420.sol")
require("function caseOrigin(" in arbitration_src, "Arbitration immutable origin read missing")

map_cfg = load("contracts/config/genesis-dapp-contract-map.json")
launchpad = next((x for x in map_cfg.get("apps", []) if x.get("dapp") == "420 Launchpad"), None)
require(launchpad is not None, "Launchpad contract map entry missing")
if launchpad:
    require(
        "LaunchpadCrowdfundingIntegration420.sol" in launchpad.get("contracts", []),
        "crowdfunding integration missing from contract map",
    )

test_paths = [
    "contracts/test/LaunchpadGenesis420.t.sol",
    "contracts/test/LaunchpadAudit420.t.sol",
    "contracts/test/LaunchpadCrowdfundingIntegration420.t.sol",
    "contracts/test/LaunchpadArbitrationOrigin420.t.sol",
]
for path in test_paths:
    require((ROOT / path).is_file(), f"focused Launchpad test missing: {path}")
flow_test = read("contracts/test/LaunchpadCrowdfundingIntegration420.t.sol")
for needle in (
    "CampaignMode.REWARD",
    "CampaignMode.DONATION",
    "CampaignMode.COMMUNITY_PROJECT",
    "CampaignMode.PRODUCT_PREORDER",
    "testSettledPayAndIdentityAreRequiredForContribution",
    "testContributionRejectsUnsettledWrongPartyAssetAndAmount",
    "testContributionRejectsMissingOrInvalidIdentityEligibility",
    "testPaymentReplayIsRejectedAcrossContributionAttempts",
    "testCanonicalRefundBatchRequiredBeforeLaunchpadRefundRecord",
    "testSuccessfulClaimPublishesReplayProtectedDeliveryEvidence",
    "testDisputeMustMatchCanonicalArbitrationOriginAndProjectController",
    "testFinalizedDisputeOutcomePublishesOnceWithoutExecutingRemedy",
):
    require(needle in flow_test, f"Audit-3 focused flow coverage missing: {needle}")

report = ROOT / "docs/audit/420LAUNCHPAD-AUDIT.md"
roadmap = ROOT / "docs/audit/420LAUNCHPAD-AUDIT-ROADMAP.md"
require(report.is_file(), "Launchpad audit report missing")
require(roadmap.is_file(), "Launchpad audit roadmap missing")
if roadmap.is_file():
    roadmap_text = roadmap.read_text(encoding="utf-8")
    for n in range(1, 9):
        require(f"LAUNCHPAD-AUDIT-{n}" in roadmap_text, f"roadmap step {n} missing")

solidity = "\n".join((src / name).read_text(encoding="utf-8") for name in required)
for forbidden in (
    ".transfer(",
    ".transferFrom(",
    ".safeTransferFrom(",
    ".call{value:",
    "selfdestruct(",
    "delegatecall(",
):
    require(forbidden not in solidity, f"forbidden V1 custody/execution primitive found: {forbidden}")
require("420Swap" not in solidity and "Swap420" not in solidity, "Launchpad must not import or invoke 420Swap authority")

if errors:
    print("420Launchpad audit verification FAILED")
    for error in errors:
        print(f" - {error}")
    raise SystemExit(1)

print("420Launchpad audit verification PASS")
print("Protocol V1 boundary: NON_CUSTODIAL_COMMITMENT_REGISTRY")
print("Crowdfunding dependency integration: REPOSITORY_INTEGRATED")
print("Audit-3 milestone qualification: LEVEL_2_REQUIRED")
