#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def require(condition, message, errors):
    if not condition:
        errors.append(message)

def main():
    errors = []
    cfg = json.loads((ROOT / "config/420town-content-v1.json").read_text())
    town_cfg = json.loads((ROOT / "config/420town-genesis.json").read_text())
    catalog = json.loads((ROOT / "town/schema/v1/object-catalog.json").read_text())
    services = json.loads((ROOT / "config/genesis-consumer-services.json").read_text())
    threat = (ROOT / "docs/genesis-services/THREAT-MODEL.md").read_text()
    source = (ROOT / "town/content/service.go").read_text()

    service = next((x for x in services["services"] if x["id"] == "420/service/town/v1"), None)
    require(service is not None, "missing canonical Town service record", errors)
    if service:
        require(service["authority"] == "REPLACEABLE_APPLICATION",
                "Town service authority classification drift", errors)
        require(service["genesis_target"] == "communities_posts_threads_comments_votes_moderation",
                "Town Genesis target drift", errors)

    require("TOWN-AUDIT-4" in town_cfg["implementedThrough"],
            "Town canonical config missing TOWN-AUDIT-4", errors)
    require("TOWN-AUDIT-4" not in town_cfg["deferredRoadmap"],
            "Town canonical config still defers TOWN-AUDIT-4", errors)
    require(town_cfg["contentBodyPolicy"] == "OFF_CHAIN_BY_DEFAULT",
            "Town content body policy drift", errors)
    require(town_cfg["authorityBoundary"]["contentBodiesOnChain"] is False,
            "Town must not claim on-chain content bodies", errors)

    require(cfg["stateClass"] == "REPLACEABLE_OFF_CHAIN_APPLICATION_STATE",
            "Town content must remain replaceable off-chain application state", errors)
    require(cfg["bodyStorage"] == "OFF_CHAIN_BY_DEFAULT",
            "Town content body storage policy drift", errors)
    require(cfg["contentAnchor"]["bodyBytesStoredByTown"] is False,
            "Town content service must not store body bytes", errors)
    require(cfg["deletion"]["mode"] == "TOMBSTONE",
            "Town deletion semantics must remain tombstone-based", errors)
    require(cfg["writes"]["idempotencyKeyRequired"] is True,
            "Town mutating content writes must require idempotency keys", errors)
    require(cfg["writes"]["historicalRevisions"] == "APPEND_ONLY",
            "Town content revisions must remain append-only", errors)
    require(cfg["visibility"]["unknownScope"] == "DENY",
            "unknown visibility must fail closed", errors)
    require(cfg["visibility"]["commentsInheritRootPostVisibility"] is True,
            "comments must inherit root post visibility", errors)
    for field in ["deviceWriteLimit","deviceVoteLimit","networkWriteLimit","networkVoteLimit"]:
        require(cfg["abuseControls"].get(field, 0) > 0,
                f"Town content abuse control missing {field}", errors)
    require(cfg["abuseControls"].get("deviceNetworkContext") == "TRUSTED_SERVER_SIDE_RISK_CONTEXT",
            "device/network abuse context must remain trusted server-side context", errors)
    require(len(cfg["invariants"]) >= 18,
            "Town content invariant inventory incomplete", errors)

    required_visibility = {
        "PUBLIC","UNLISTED","FOLLOWERS","COMMUNITY_ONLY",
        "PURCHASERS_OR_BACKERS","PRIVATE","ORGANIZATION_MEMBERS",
        "MODERATORS","ADMINS"
    }
    require(set(cfg["visibility"]["canonicalScopes"]) == required_visibility,
            "Town content visibility vocabulary drift", errors)

    content_catalog = catalog.get("content_v1", {})
    require(content_catalog.get("package") == "town/content",
            "schema catalog content package drift", errors)
    require(content_catalog.get("body_storage") == "OFF_CHAIN_BY_DEFAULT",
            "schema catalog body storage drift", errors)
    require(content_catalog.get("historical_revisions") == "APPEND_ONLY",
            "schema catalog revision policy drift", errors)
    require(content_catalog.get("unknown_visibility") == "DENY",
            "schema catalog unknown visibility policy drift", errors)

    for kind in ["Post","Thread","Comment","Vote"]:
        item = next((x for x in catalog["objects"] if x["kind"] == kind), None)
        require(item is not None, f"schema catalog missing {kind}", errors)

    for token in [
        "func (s *Service) CreatePost",
        "func (s *Service) CreateThread",
        "func (s *Service) CreateComment",
        "func (s *Service) SetVote",
        "func (s *Service) TombstonePost",
        "func (s *Service) TombstoneComment",
        "ErrIdempotencyConflict",
        "ErrRateLimited",
        "ErrDuplicateContent",
        "DeviceKey",
        "NetworkKey",
        "deviceWrites",
        "networkWrites",
        "comments",
        "fingerprints",
        "idempotency",
    ]:
        require(token in source, f"Town content service missing {token}", errors)

    for forbidden in [
        "Body []byte",
        "Body string",
        "ContentBody",
    ]:
        require(forbidden not in source,
                f"Town content service unexpectedly stores body payload: {forbidden}", errors)

    for threat_name in ["### SPAM", "### SYBIL", "### INDEX_POISONING"]:
        require(threat_name in threat, f"shared threat model missing {threat_name}", errors)

    required_tests = [
        "town/content/service_test.go",
    ]
    required_docs = [
        "docs/apps/town/content.md",
        "docs/apps/town/authority.md",
    ]
    for path in required_tests + required_docs:
        require((ROOT / path).is_file(), f"missing Town content artifact: {path}", errors)

    if errors:
        print("420Town content verifier FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("420Town content verifier PASS")
    print("state_class=REPLACEABLE_OFF_CHAIN_APPLICATION_STATE")
    print("body_storage=OFF_CHAIN_BY_DEFAULT")
    print("deletion=TOMBSTONE")
    print("idempotency=REQUIRED")
    print(f"invariants={len(cfg['invariants'])}")

if __name__ == "__main__":
    main()
