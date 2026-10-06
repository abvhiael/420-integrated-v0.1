#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def require(condition, message, errors):
    if not condition:
        errors.append(message)

def main():
    errors = []
    cfg = json.loads((ROOT / "config/420town-moderation-v1.json").read_text())
    town_cfg = json.loads((ROOT / "config/420town-genesis.json").read_text())
    catalog = json.loads((ROOT / "town/schema/v1/object-catalog.json").read_text())
    registry = json.loads((ROOT / "config/genesis-consumer-services.json").read_text())
    shared = (ROOT / "docs/genesis-services/GEN-SVC-0-ROADMAP.md").read_text()
    threat = (ROOT / "docs/genesis-services/THREAT-MODEL.md").read_text()
    source = (ROOT / "town/moderation/service.go").read_text()
    content_source = (ROOT / "town/content/service.go").read_text()
    model_source = (ROOT / "town/model/model.go").read_text()

    canonical = [
        "REPORT","HIDE","BLOCK","MUTE","SUSPEND","APPEAL",
        "MODERATOR_DECISION","RESTORE","LOCK"
    ]

    require(cfg["actions"] == canonical, "Town moderation canonical action order/vocabulary drift", errors)
    require(set(registry["moderation_actions"]) == set(canonical),
            "Town moderation vocabulary diverges from GEN-SVC registry", errors)
    require("REPORT, HIDE, BLOCK, MUTE, SUSPEND, APPEAL, MODERATOR_DECISION, RESTORE, LOCK" in shared,
            "shared GEN-SVC moderation vocabulary drift", errors)
    require("### MODERATION_ABUSE" in threat, "shared moderation-abuse threat model missing", errors)

    require("TOWN-AUDIT-5" in town_cfg["implementedThrough"],
            "Town canonical config missing TOWN-AUDIT-5", errors)
    require("TOWN-AUDIT-5" not in town_cfg["deferredRoadmap"],
            "Town canonical config still defers TOWN-AUDIT-5", errors)
    require(town_cfg.get("moderationPackage") == "town/moderation",
            "Town canonical moderation package drift", errors)

    authority = cfg["authority"]
    require(authority["communityScoped"] is True, "moderator authority must be community-scoped", errors)
    require(authority["blockMuteUserScoped"] is True, "block/mute must remain user-scoped", errors)
    require(authority["suspensionScope"] == "COMMUNITY_APPLICATION_SCOPE",
            "suspension must remain community application scoped", errors)
    for field in ["protocolAuthority","assetAuthority","walletAuthority","identityRevocationAuthority"]:
        require(authority[field] is False, f"moderation must not claim {field}", errors)

    require(cfg["appeals"]["affectedSubjectOnly"] is True,
            "appeals must be filed by affected subject", errors)
    require(cfg["appeals"]["preservePriorDecisionHistory"] is True,
            "appeals must preserve prior decision history", errors)
    require(cfg["provenance"]["appendOnlyCaseLog"] is True,
            "moderation case log must remain append-only", errors)
    require(cfg["provenance"]["parentRecordRequiredAfterInitialReport"] is True,
            "moderation provenance parent linkage required", errors)
    require(cfg["integration"]["contentGateRequired"] is True,
            "moderation content gate must be mandatory", errors)
    require(len(cfg["invariants"]) >= 17, "Town moderation invariant inventory incomplete", errors)

    mod_catalog = catalog.get("moderation_v1", {})
    require(mod_catalog.get("package") == "town/moderation", "schema moderation package drift", errors)
    require(mod_catalog.get("actions") == canonical, "schema moderation actions drift", errors)
    require(mod_catalog.get("community_scoped") is True, "schema moderation scope drift", errors)
    require(mod_catalog.get("content_gate_required") is True, "schema content-gate requirement drift", errors)

    for token in canonical:
        require(f'= "{token}"' in model_source,
                f"Town model missing moderation action {token}", errors)

    for token in [
        "func (s *Service) Report",
        "func (s *Service) Moderate",
        "func (s *Service) Appeal",
        "func (s *Service) Block",
        "func (s *Service) Mute",
        "func (s *Service) CanRead",
        "func (s *Service) CanWrite",
        "ParentRecordID",
        "ErrIdempotencyConflict",
        "ErrUnavailable",
        "SetContentResolver",
    ]:
        require(token in source, f"Town moderation service missing {token}", errors)

    for token in [
        "type ModerationGate interface",
        "moderation ModerationGate",
        "moderation == nil",
        "s.moderation.CanRead",
        "s.moderation.CanWrite",
        "ErrModerationDenied",
        "TargetCommunity",
    ]:
        require(token in content_source, f"Town content moderation gate missing {token}", errors)

    for forbidden in [
        "function withdraw(",
        "function transfer(",
        "privateKey",
        "revokeIdentity",
        "transferAsset",
    ]:
        require(forbidden not in source,
                f"Town moderation unexpectedly exposes prohibited authority primitive: {forbidden}", errors)

    for path in [
        "town/moderation/service.go",
        "town/moderation/service_test.go",
        "docs/apps/town/moderation.md",
    ]:
        require((ROOT / path).is_file(), f"missing Town moderation artifact: {path}", errors)

    if errors:
        print("420Town moderation verifier FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("420Town moderation verifier PASS")
    print("actions=" + ",".join(canonical))
    print("authority=COMMUNITY_SCOPED")
    print("block_mute=USER_SCOPED")
    print("appeal_provenance=APPEND_ONLY")
    print("content_gate=REQUIRED")
    print(f"invariants={len(cfg['invariants'])}")

if __name__ == "__main__":
    main()
