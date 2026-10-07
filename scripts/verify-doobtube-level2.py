#!/usr/bin/env python3
"""DOOBTUBE-8 Level 2 retained integration verifier."""
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]

def read(path):
    p=ROOT/path
    assert p.exists(), f"missing {path}"
    return p.read_text(encoding="utf-8")

def need(path, phrases):
    text=read(path)
    for phrase in phrases:
        assert phrase in text, f"{path}: missing {phrase!r}"
    return text

doc=need("docs/DOOBTUBE-ECOSYSTEM-INTEGRATION.md",[
    "Roadmap step: **DOOBTUBE-8 — Ecosystem integration milestone**",
    "Qualification level: **Level 2 — retained app integration milestone**",
    "DT-INT-REG-001","DT-INT-AUTH-001","DT-INT-MEDIA-001",
    "DT-INT-RIGHTS-001","DT-INT-STORAGE-001","DT-INT-SEARCH-001",
    "DT-INT-NOTIFY-001","DT-INT-INV-001","DT-INT-INV-012",
    "DOOBTUBE-9 — Security, abuse and moderation qualification",
])
module=need("doobtube/integration/milestone.py",[
    "DIRECT_REQUIRED","DIRECT_OPTIONAL","TRANSITIVE_ONLY","NOT_ADOPTED_V1",
    '"420Registry"','"420Wallet"','"420SmartAccounts"','"420Media"',
    '"420Rights"','"420Storage"','"420Search"','"420Notifications"',
    '"420Identity"','"420Pay"','"420Compute"',
    '"420Arbitration"','"420Analytics"','"420Verify"','"420Explorer"',
    "class EcosystemMilestone","def qualify","assert_no_shadow_authority",
])
tests=need("doobtube/tests/test_doobtube_level2_integration.py",[
    "test_full_adopted_stack_qualifies_together",
    "test_optional_identity_can_degrade_to_wallet_only",
    "test_registry_stale_wrong_chain_inactive_and_service_substitution_fail_closed",
    "test_wallet_identity_actor_substitution_fails_closed",
    "test_media_compatibility_mismatch_fails_closed",
    "test_rights_revocation_or_provenance_identity_mismatch_blocks_public_flow",
    "test_storage_unready_blocks_integrated_public_flow",
    "test_search_cannot_widen_visibility_claim_authority_or_substitute_service",
    "test_notifications_cannot_become_entitlement_marketing_or_wallet_authority",
    "test_pay_compute_remain_media_transitive_and_unadopted_services_remain_non_authoritative",
    "test_shadow_authority_transfer_fails_closed",
])

service_ids=read("contracts/src/libraries/ServiceIds420.sol")
for literal in [
    'PROTOCOL_REGISTRY = keccak256("420/service/protocol-registry/v1")',
    'WALLET = keccak256("420/service/wallet/v1")',
    'SMART_ACCOUNTS = keccak256("420/service/smart-accounts/v1")',
    'SEARCH = keccak256("420/service/search/v1")',
    'NOTIFICATIONS = keccak256("420/service/notifications/v1")',
    'IDENTITY = keccak256("420/service/identity/v1")',
    'RESOURCE_PROTOCOL = keccak256("420/service/resource-protocol/v1")',
    'RIGHTS = keccak256("420/service/rights/v1")',
    'PAY = keccak256("420/service/pay/v1")',
    'COMPUTE_MARKET = keccak256("420/service/compute-market/v1")',
]:
    assert literal in service_ids, f"canonical service ID drift: {literal}"

consumer=json.loads(read("config/genesis-consumer-services.json"))
media=next(x for x in consumer["services"] if x["id"]=="420/service/media/v1")
expected={"420 Identity","420 Rights","420 Storage","420 Search","420 Notifications","420 Pay","420 Compute Protocol"}
assert set(media["dependencies"])==expected, "420Media dependency set drifted"

media_types=need("media/api/types.go",[
    'Version            = "v1"',
    'ServiceID          = "420/service/media/v1"',
    'SigningDomain      = "420/MEDIA/API/SIGNING/V1"',
    "type Provenance struct","type PrepareUploadRequest struct",
    "type CreateLivestreamRequest struct","type SearchItem struct",
    "type CreateSubscriptionRequest struct",
])
media_server=need("media/api/server.go",[
    'GET /v1/search','POST /v1/notifications/subscriptions',
    'POST /v1/uploads/prepare','POST /v1/livestreams',
    'POST /v1/moderation/reports',
    'POST /v1/moderation/decisions/{id}/appeals',
])
search=need("search/httpapi/handler.go",[
    'APIVersion         = "420-search-http-v1"',
    'BasePath           = "/v1"',
    'case BasePath + "/search":',
    'case BasePath + "/readiness":',
    "SearchResponse struct",
])

web=need("doobtube/web/core/service.js",[
    "/v1/search?","/v1/notifications/subscriptions",
    "/v1/uploads/prepare","/v1/livestreams",
    "/v1/moderation/reports","/v1/moderation/decisions/",
])
web_app=need("doobtube/web/app.js",[
    "promotional_opt_in:false","canonical READY",
    "Report submitted. The report itself does not hide/delete/transfer media.",
    "Appeal submitted without rewriting prior decision history.",
])

# Direct Pay/Compute clients must still be absent from executable DoobTube service/web code.
for path in [
    "doobtube/api/service.py","doobtube/media/service.py",
    "doobtube/web/core/service.js","doobtube/web/app.js",
]:
    t=read(path)
    assert "/v1/pay" not in t.lower(), f"direct Pay route appeared in {path}"
    assert "/v1/compute" not in t.lower(), f"direct Compute route appeared in {path}"

# Non-adopted visibility services must not become executable dependencies.
for path in ["doobtube/api/service.py","doobtube/media/service.py","doobtube/web/core/service.js"]:
    t=read(path)
    for token in ("420/service/arbitration/v1","420/service/analytics/v1","420/service/verify/v1","420/service/explorer/v1"):
        assert token not in t, f"unadopted service became runtime dependency in {path}: {token}"

road=read("docs/DOOBTUBE-ROADMAP.md")
audit=read("docs/DOOBTUBE-AUDIT.md")
assert "**Status: COMPLETE (Level 2).** Canonical ecosystem integration definition" in road
assert "DOOBTUBE-0 through DOOBTUBE-8 are complete" in audit
print("DOOBTUBE-8 Level 2 ecosystem integration verification: PASS")
