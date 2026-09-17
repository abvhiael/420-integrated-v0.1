#!/usr/bin/env python3
"""Validate the GEN-SVC-0 consumer-service architecture baseline."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "config" / "genesis-consumer-services.json"
FROZEN_APPS = ROOT / "config" / "genesis-applications.json"
THREAT_MODEL = ROOT / "docs" / "genesis-services" / "THREAT-MODEL.md"
FIXTURES = ROOT / "docs" / "genesis-services" / "INTEGRATION-FIXTURES.md"
ROADMAP = ROOT / "docs" / "genesis-services" / "GEN-SVC-0-ROADMAP.md"


def load(path: Path):
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def main() -> int:
    errors: list[str] = []

    for path in (REGISTRY, FROZEN_APPS, THREAT_MODEL, FIXTURES, ROADMAP):
        require(path.exists(), f"missing required file: {path.relative_to(ROOT)}", errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    registry = load(REGISTRY)
    frozen = load(FROZEN_APPS)

    require(registry.get("schema") == "420-genesis-consumer-services-v1", "unexpected consumer-service schema", errors)
    require(registry.get("frozen_application_catalog") == "config/genesis-applications.json", "consumer registry must reference frozen application catalog", errors)
    require(registry.get("policy", {}).get("frozen_catalog_unchanged") is True, "GEN-SVC-0 must preserve the frozen application catalog", errors)
    require(frozen.get("status") == "FROZEN", "genesis application catalog must remain FROZEN", errors)
    require(frozen.get("schema") == "420-genesis-application-decision-v9", "GEN-SVC-0 expects frozen application decision v9", errors)

    services = registry.get("services", [])
    service_ids = [item.get("id") for item in services]
    service_names = [item.get("name") for item in services]
    require(len(service_ids) == len(set(service_ids)), "duplicate service IDs", errors)
    require(len(service_names) == len(set(service_names)), "duplicate service names", errors)
    require(all(isinstance(value, str) and value.startswith("420/service/") for value in service_ids), "all service IDs must use 420/service/* namespace", errors)

    required_services = {
        "420Media",
        "420Town Community Boards",
        "420Classifieds",
        "420Travel",
        "420Reputation",
        "420Events",
        "420Location",
        "420Launchpad Crowdfunding",
        "Reefer Review Publishing",
        "420Learn + 420Knowledge",
        "420University",
        "420Mail",
        "420Calendar",
        "420Freelance",
    }
    require(required_services.issubset(set(service_names)), f"missing service records: {sorted(required_services - set(service_names))}", errors)

    required_objects = {
        "User","Organization","Profile","Location","Place","Event","Listing","Review","ReputationRecord","Content","Publication","Community","Post","Comment","Vote","Campaign","Contribution","Reward","Message","Conversation","CalendarEvent","Booking","Job","Gig","Credential","MediaAsset","Stream","Subscription"
    }
    objects = set(registry.get("canonical_objects", []))
    require(required_objects.issubset(objects), f"missing canonical objects: {sorted(required_objects - objects)}", errors)

    required_visibility = {"PUBLIC","UNLISTED","FOLLOWERS","COMMUNITY_ONLY","PURCHASERS_OR_BACKERS","PRIVATE","ORGANIZATION_MEMBERS","MODERATORS","ADMINS"}
    visibility = set(registry.get("visibility_scopes", []))
    require(required_visibility.issubset(visibility), f"missing visibility scopes: {sorted(required_visibility - visibility)}", errors)

    required_moderation = {"REPORT","HIDE","BLOCK","MUTE","SUSPEND","APPEAL","MODERATOR_DECISION","RESTORE","LOCK"}
    moderation = set(registry.get("moderation_actions", []))
    require(required_moderation.issubset(moderation), f"missing moderation actions: {sorted(required_moderation - moderation)}", errors)

    api = registry.get("api_conventions", {})
    require(api.get("version_prefix") == "/v1", "API version prefix must be /v1", errors)
    require(api.get("pagination") == "cursor", "API pagination must be cursor based", errors)
    require(api.get("timestamps") == "RFC3339_UTC", "timestamps must use RFC3339 UTC", errors)
    require(api.get("signing") == "domain_separated_typed_payloads", "signed actions must be domain separated", errors)
    require(api.get("webhooks") == "signed_replay_protected", "webhooks must be signed and replay protected", errors)
    require(api.get("chain_provenance_required_for_authority_bearing_records") is True, "authority-bearing records require chain provenance", errors)

    flags = {item.get("key"): item.get("genesis_default") for item in registry.get("feature_flags", [])}
    required_flags = {
        "media.livestreaming": True,
        "travel.bnb_booking": False,
        "travel.doobr_transactions": False,
        "mail.external_smtp": False,
        "university.freelance_ui": False,
        "launchpad.securities_or_equity": False,
        "publishing.paid_external_newsletters": False,
        "calendar.external_provider_sync": False,
    }
    for key, expected in required_flags.items():
        require(flags.get(key) is expected, f"feature flag {key} must default to {expected}", errors)

    required_threats = {"SPAM","SYBIL","FAKE_REVIEWS","SELLER_FRAUD","CROWDFUNDING_ABUSE","LOCATION_PRIVACY","MESSAGING_ABUSE","MODERATION_ABUSE","CONTENT_RIGHTS_ABUSE","ESCROW_FAILURE","INDEX_POISONING","WEBHOOK_REPLAY"}
    threats = set(registry.get("required_threat_domains", []))
    require(required_threats.issubset(threats), f"missing threat domains: {sorted(required_threats - threats)}", errors)

    required_personas = {"USER","BUSINESS","CREATOR","MODERATOR","BUYER","SELLER","STUDENT","PUBLISHER","BACKER","TRAVELLER","FREELANCER","CLIENT"}
    personas = set(registry.get("integration_fixture_personas", []))
    require(required_personas.issubset(personas), f"missing fixture personas: {sorted(required_personas - personas)}", errors)

    threat_text = THREAT_MODEL.read_text(encoding="utf-8")
    fixture_text = FIXTURES.read_text(encoding="utf-8")
    roadmap_text = ROADMAP.read_text(encoding="utf-8")

    for threat in required_threats:
        require(threat in threat_text, f"threat model does not document {threat}", errors)
    for persona in required_personas:
        require(f"`{persona}`" in fixture_text, f"fixture document does not document {persona}", errors)
    for step in range(1, 11):
        require(f"GEN-SVC-0.{step}" in roadmap_text, f"roadmap missing GEN-SVC-0.{step}", errors)

    forbidden_authority_terms = {"CONSENSUS_AUTHORITY", "WALLET_KEY_CUSTODY", "GLOBAL_ADMIN_AUTHORITY"}
    for service in services:
        require(service.get("authority") not in forbidden_authority_terms, f"service {service.get('name')} claims forbidden authority", errors)
        require(bool(service.get("depends_on")), f"service {service.get('name')} must declare dependencies", errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    print("GEN-SVC-0 validation: PASS")
    print(f"validated {len(services)} services, {len(objects)} canonical objects, {len(personas)} fixture personas")
    return 0


if __name__ == "__main__":
    sys.exit(main())
