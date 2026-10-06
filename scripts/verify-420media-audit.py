#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

def need(path: str, needles=()):
    p = ROOT / path
    assert p.exists(), f"missing {path}"
    text = p.read_text(encoding="utf-8")
    for n in needles:
        assert n in text, f"{path}: missing {n!r}"
    return text

audit = need("docs/420MEDIA-AUDIT.md", [
    "420/service/media/v1",
    "video_uploads_basic_livestreaming",
    "CODE COMPLETE: **NO**",
])
roadmap = need("docs/420MEDIA-ROADMAP.md", [
    "MEDIA-AUDIT-1",
    "MEDIA-AUDIT-2",
    "MEDIA-AUDIT-3",
    "MEDIA-AUDIT-4",
    "MEDIA-AUDIT-5",
    "MEDIA-AUDIT-6",
    "MEDIA-AUDIT-13",
    "Production-equivalent public-testnet qualification",
])
deployment = need("docs/420-MEDIA-PHASE-1-DEPLOYMENT-GRAPH.md", [
    "MEDIA-AUDIT-2",
    "Canonical deployment order",
    "MEDIA-AUDIT-7",
    "code-less",
])
discovery = need("docs/420-MEDIA-PHASE-3-OPERATOR-DISCOVERY.md", [
    "MEDIA-AUDIT-3",
    "Service-network control plane",
    "Reorg and recovery model",
    "canonical registry state",
])
storage_lifecycle = need("docs/420-MEDIA-STORAGE-LIFECYCLE.md", [
    "MEDIA-AUDIT-4",
    "UPLOADED -> READY",
    "canonical-aware deleter",
    "420Storage",
])
livestream = need("docs/420-MEDIA-LIVESTREAM-SERVICE.md", [
    "MEDIA-AUDIT-5",
    "media.livestreaming",
    "desired_live",
    "Level 2 milestone",
    "MediaStreamRegistry420",
])
identity_rights = need("docs/420-MEDIA-IDENTITY-RIGHTS.md", [
    "MEDIA-AUDIT-6",
    "optional Identity",
    "AuthorizePublicProjection",
    "RightsRouter420.canUse",
    "Level 1 app-scoped fast qualification",
])

svc = json.loads(need("config/genesis-consumer-services.json"))
media = next((x for x in svc["services"] if x["id"] == "420/service/media/v1"), None)
assert media is not None, "missing canonical Media service"
assert media["name"] == "420Media"
assert media["genesis_target"] == "video_uploads_basic_livestreaming"
assert media["authority"] == "REPLACEABLE_APPLICATION"
required = {"420 Identity","420 Rights","420 Storage","420 Search","420 Notifications","420 Pay","420 Compute Protocol"}
assert set(media["depends_on"]) == required
flags = {x["key"]: x["genesis_default"] for x in svc["feature_flags"]}
assert flags.get("media.livestreaming") is True

apps = json.loads(need("config/genesis-applications.json"))
assert all(x["name"] != "420Media" for x in apps["apps"]), "audit policy changed: 420Media is now frozen; reconcile audit"

for path in [
    "contracts/src/media/MediaCapabilityRegistry420.sol",
    "contracts/src/media/MediaOperatorRegistry420.sol",
    "contracts/src/media/MediaSLA420.sol",
    "contracts/src/media/MediaStreamRegistry420.sol",
    "contracts/src/media/MediaJobMarket420.sol",
    "contracts/src/media/MediaSettlement420.sol",
    "contracts/src/media/MediaIds420.sol",
    "contracts/test/MediaPhase1Protocol420.t.sol",
    "contracts/test/MediaPhase1Hardening420.t.sol",
    "cmd/420media-node/main.go",
    "media/node/runner.go",
    "media/node/ethadapter/adapter.go",
    "media/node/livegateway/gateway.go",
    "media/node/mediaprocessor/processor.go",
    "media/node/telemetry/telemetry.go",
    "scripts/420media-anvil-integration.sh",
    "docs/420-MEDIA-PHASE-1-PROTOCOL.md",
    "docs/420-MEDIA-PHASE-2-NODE.md",
    "docs/420-MEDIA-PHASE-3-OPERATOR-DISCOVERY.md",
    "media/discovery/types.go",
    "media/discovery/source.go",
    "media/discovery/selector.go",
    "media/discovery/ethereum.go",
    "media/controlplane/discovery.go",
    "media/storage/lifecycle.go",
    "media/storage/lifecycle_test.go",
    "media/livestream/service.go",
    "media/livestream/store_file.go",
    "media/livestream/ethereum_authority.go",
    "media/livestream/service_test.go",
    "media/livestream/ethereum_authority_test.go",
    "media/node/livegateway/recovery_test.go",
    "media/authority/guard.go",
    "media/authority/ethereum.go",
    "media/authority/guard_test.go",
    "media/authority/ethereum_test.go",
    "media/storage/rights.go",
    "media/storage/rights_test.go",
    "media/livestream/identity.go",
    "media/livestream/identity_test.go",
]:
    assert (ROOT / path).exists(), f"missing existing Media baseline file {path}"

assert not (ROOT / "media/web").exists(), "Media web now exists; update audit classification"
assert not (ROOT / "media/api").exists(), "Media API now exists; update audit classification"
assert not (ROOT / "sdk/media420").exists(), "Media SDK now exists; update audit classification"

print("420Media audit baseline: PASS")
