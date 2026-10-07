#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def need(path: str, needles=()):
    p = ROOT / path
    assert p.exists(), f"missing {path}"
    text = p.read_text(encoding="utf-8")
    for needle in needles:
        assert needle in text, f"{path}: missing {needle!r}"
    return text


name = need("docs/DOOBTUBE-NAME-DECISION.md", [
    "Status: **ADOPTED — DOOBTUBE-0**",
    "The application referred to in the current audit request as **420Video** is named **DoobTube**.",
    "docs/DOOBTUBE-ARCHITECTURE.md",
    "DOOBTUBE-1 — Product scope and canonical user workflows",
])
architecture = need("docs/DOOBTUBE-ARCHITECTURE.md", [
    "Status: **ADOPTED**",
    "replaceable user-facing video application/client layer",
    "420/service/media/v1",
    "no new protocol/service Registry identity",
    "not added to `config/genesis-applications.json`",
    "not added to `config/genesis-consumer-services.json`",
    "no DoobTube-owned smart contract requirement",
    "DoobTube is **non-custodial by architecture**",
    "DOOBTUBE-ARCH-001",
    "DOOBTUBE-ARCH-012",
    "Next canonical roadmap step: DOOBTUBE-1 — Product scope and canonical user workflows",
])
audit = need("docs/DOOBTUBE-AUDIT.md", [
    "DoobTube has **no runtime implementation yet**",
    "DOOBTUBE-0 now canonically specifies",
    "DOOBTUBE-0 through DOOBTUBE-3 are complete",
    "CODE COMPLETE: **NO**",
    "PRODUCTION READY: **NO**",
    "420/service/media/v1",
])
roadmap = need("docs/DOOBTUBE-ROADMAP.md", [
    "## DOOBTUBE-0 — Canonical identity and architecture decision",
    "**Status: COMPLETE (Level 1).**",
    "docs/DOOBTUBE-ARCHITECTURE.md",
    "DOOBTUBE-1",
    "DOOBTUBE-2",
    "DOOBTUBE-3",
    "DOOBTUBE-4",
    "DOOBTUBE-5",
    "DOOBTUBE-6",
    "DOOBTUBE-7",
    "DOOBTUBE-8",
    "DOOBTUBE-9",
    "DOOBTUBE-10",
    "DOOBTUBE-11",
    "DOOBTUBE-12",
    "DOOBTUBE-13",
])

svc = json.loads(need("config/genesis-consumer-services.json"))
media = next((x for x in svc["services"] if x["id"] == "420/service/media/v1"), None)
assert media is not None, "canonical 420Media service disappeared"
assert media["name"] == "420Media", "DoobTube must not silently rename 420Media"
assert media["genesis_target"] == "video_uploads_basic_livestreaming"
assert media["authority"] == "REPLACEABLE_APPLICATION"
assert all(x.get("name") not in {"DoobTube", "420Video"} for x in svc["services"]), (
    "DoobTube/420Video must not create a second Genesis consumer-service identity at DOOBTUBE-0"
)
assert all(x.get("id") not in {"420/service/doobtube/v1", "420/service/video/v1"} for x in svc["services"])

apps = json.loads(need("config/genesis-applications.json"))
assert all(x["name"] not in {"DoobTube", "420Video"} for x in apps["apps"]), (
    "DoobTube/420Video was added to the frozen Genesis catalog without an explicit later catalog decision"
)

assert not (ROOT / "doobtube").exists(), "runtime appeared before DOOBTUBE-1+ implementation ownership"
assert not (ROOT / "contracts" / "src" / "doobtube").exists(), (
    "DoobTube contracts appeared despite DOOBTUBE-0's no-contract ownership decision"
)
assert not (ROOT / "contracts" / "src" / "video").exists(), (
    "parallel 420Video contract namespace appeared despite canonical DoobTube/420Media boundary"
)

for text, source in [
    (name, "name decision"),
    (architecture, "architecture"),
    (audit, "audit"),
    (roadmap, "roadmap"),
]:
    for forbidden in [
        "DoobTube is deployed",
        "DoobTube is Genesis-ready",
        "DoobTube is production-ready",
        "DoobTube is testnet-ready",
    ]:
        assert forbidden not in text, f"{source}: forbidden readiness claim {forbidden!r}"

for invariant in [
    "DoobTube does not replace or rename `420Media`",
    "`420/service/media/v1` remains the canonical Media service identity",
    "DoobTube creates no second Media protocol/service authority",
    "DOOBTUBE-0 allocates no frozen/reserved address",
    "DOOBTUBE-0 requires no DoobTube-owned smart contract",
    "DoobTube is non-custodial by default",
    "Wallet/private signing material remains outside DoobTube",
    "raw media and high-volume transport data remain off-chain",
]:
    assert invariant in architecture, f"architecture invariant missing: {invariant!r}"

product = need("docs/DOOBTUBE-PRODUCT-SCOPE.md", [
    "Roadmap step: **DOOBTUBE-1 — Product scope and canonical user workflows**",
    "Status: **ADOPTED**",
    "DT-PROD-001",
    "DT-ACCOUNT-001",
    "DT-ACCOUNT-003",
    "DT-CHANNEL-001",
    "DT-MEDIA-001",
    "DT-MEDIA-005",
    "DT-PLAY-001",
    "DT-DISC-001",
    "DT-LIVE-001",
    "DT-SUB-001",
    "DT-SOCIAL-001",
    "DT-SOCIAL-003",
    "DT-MONEY-001",
    "DT-RIGHTS-001",
    "DT-PRIV-001",
    "DT-MOD-001",
    "DT-MOD-003",
    "DT-DATA-001",
    "DT-DATA-003",
    "DT-UX-001",
    "DT-UX-004",
    "## 17. Canonical V1 routes / surfaces",
    "## 18. Product state machines",
    "## 19. V1 non-goals",
    "## 20. Acceptance matrix",
    "Next canonical roadmap step: DOOBTUBE-2 — Dependency and trust-boundary freeze",
])

# Canonical GEN-SVC vocabulary consumed by the V1 product definition must remain available.
canonical_objects = set(svc.get("canonical_objects", []))
for obj in {"MediaAsset", "Stream", "Subscription"}:
    assert obj in canonical_objects, f"required canonical object disappeared: {obj}"
visibility = set(svc.get("visibility_scopes", []))
for v in {"PUBLIC", "UNLISTED", "PRIVATE"}:
    assert v in visibility, f"required V1 visibility disappeared: {v}"
moderation = set(svc.get("moderation_actions", []))
for action in {"REPORT", "HIDE", "SUSPEND", "APPEAL", "MODERATOR_DECISION", "RESTORE", "LOCK"}:
    assert action in moderation, f"required moderation vocabulary disappeared: {action}"

# Every original DOOBTUBE-1 roadmap category must be explicitly decided.
for category in [
    "Account, Wallet and optional Identity",
    "Creator/channel presentation model",
    "Upload, publication and creator library",
    "Playback",
    "Discovery, feed and Search",
    "Livestreaming",
    "Creator subscriptions / following",
    "Comments, reactions and sharing",
    "Monetization",
    "Rights and provenance",
    "Privacy and visibility",
    "Reporting, moderation and appeals",
    "Delete, retention and export",
    "Accessibility and responsive UX",
]:
    assert category in product, f"DOOBTUBE-1 category missing: {category!r}"

# Explicit non-goals prevent accidental scope inflation before later architecture decisions.
for required_non_goal in [
    "comments or threaded discussion",
    "likes/dislikes/reaction counters",
    "creator paid subscriptions",
    "pay-per-view",
    "creator tipping/donations",
    "advertising marketplace or revenue sharing",
    "token-gated media",
    "mandatory real-name/420Identity use",
    "permanent/raw-media storage on-chain",
    "mobile native apps in the initial V1",
]:
    assert required_non_goal in product, f"V1 non-goal missing: {required_non_goal!r}"

for state_machine in [
    "Session / authority state",
    "Upload/publication state",
    "Playback state",
    "Livestream state",
    "Subscription state",
    "Report / moderation / appeal state",
    "Delete state",
]:
    assert state_machine in product, f"state machine missing: {state_machine!r}"

for phrase in [
    "Public viewing without forced identity",
    "Wallet only when authority is required",
    "Identity remains optional",
    "Canonical service state wins",
    "Privacy is fail-closed",
    "transport acceptance alone is never displayed as completed publication/readiness",
    "Subscription state is a replaceable preference, not access entitlement",
    "DoobTube never holds viewer or creator funds in V1",
    "DoobTube presentation must never widen canonical visibility",
    "Appeals preserve prior decision history",
    "DoobTube does not promise erasure beyond authoritative service semantics",
]:
    assert phrase in product, f"product invariant missing: {phrase!r}"

assert "**Status: COMPLETE (Level 1).** Canonical V1 product definition" in roadmap
assert "docs/DOOBTUBE-PRODUCT-SCOPE.md" in roadmap
assert "DOOBTUBE-0 through DOOBTUBE-3 are complete" in audit

dependencies = need("docs/DOOBTUBE-DEPENDENCIES-TRUST.md", [
    "Roadmap step: **DOOBTUBE-2 — Dependency and trust-boundary freeze**",
    "Status: **ADOPTED**",
    "420/service/protocol-registry/v1",
    "420/service/media/v1",
    "420/service/identity/v1",
    "420/service/rights/v1",
    "420/service/resource-protocol/v1",
    "420/service/search/v1",
    "420/service/notifications/v1",
    "420/service/pay/v1",
    "420/service/compute-market/v1",
    "## 16. Authority matrix",
    "## 18. Threat model for dependency boundaries",
    "## 19. Failure and degraded-mode matrix",
    "DT-DEP-INV-001",
    "DT-DEP-INV-012",
    "Next canonical roadmap step: DOOBTUBE-3 — Data, storage, media-processing and lifecycle architecture",
])

service_ids = need("contracts/src/libraries/ServiceIds420.sol", [
    'PROTOCOL_REGISTRY = keccak256("420/service/protocol-registry/v1")',
    'SEARCH = keccak256("420/service/search/v1")',
    'NOTIFICATIONS = keccak256("420/service/notifications/v1")',
    'IDENTITY = keccak256("420/service/identity/v1")',
    'RESOURCE_PROTOCOL = keccak256("420/service/resource-protocol/v1")',
    'RIGHTS = keccak256("420/service/rights/v1")',
    'PAY = keccak256("420/service/pay/v1")',
    'COMPUTE_MARKET = keccak256("420/service/compute-market/v1")',
])

# The canonical Media consumer-service graph must continue to own its qualified dependencies.
expected_media_dependencies = {
    "420 Identity",
    "420 Rights",
    "420 Storage",
    "420 Search",
    "420 Notifications",
    "420 Pay",
    "420 Compute Protocol",
}
assert set(media.get("depends_on", [])) == expected_media_dependencies, "canonical 420Media dependency graph drifted"

# Required direct/optional dependencies and transitive Media dependencies must remain explicit.
for phrase in [
    "ProtocolRegistry / 420 Registry",
    "420 Wallet / Smart Accounts",
    "420Media",
    "420Identity (optional)",
    "420Rights",
    "420Storage / Resource Protocol",
    "420Search",
    "420Notifications",
    "420Pay",
    "420 Compute Market",
    "TRANSITIVE_MEDIA",
    "NOT_ADOPTED_V1",
]:
    assert phrase in dependencies, f"dependency classification missing: {phrase!r}"

# Required failure/degraded modes.
for phrase in [
    "READ_ONLY_STALE_PRESENTATION_ALLOWED / AUTHORITY_MUTATIONS_BLOCKED",
    "PUBLIC_READ_ONLY",
    "STALE_PUBLIC_PRESENTATION_ONLY",
    "WALLET_ONLY_PSEUDONYMOUS",
    "NON_PUBLIC / RIGHTS_REVALIDATION_REQUIRED",
    "PLAYBACK_IF_ALREADY_AUTHORIZED / NO_NEW_STORAGE_MUTATIONS",
    "DIRECT_REFERENCE_AND_CREATOR_WORKFLOWS_ONLY",
    "MEDIA_FULL / NOTIFICATION_PREFERENCES_UNAVAILABLE",
]:
    assert phrase in dependencies, f"degraded mode missing: {phrase!r}"

# Explicit V1 non-adoption prevents dependency creep.
for phrase in [
    "420 Names",
    "420 Explorer",
    "420 Analytics",
    "420 Verify",
    "420 Arbitration",
    "420 AppStore",
    "Governance",
    "Treasury",
    "Bridge",
    "AI",
    "Oracle Interface Layer",
    "Stake",
    "Token",
    "Swap",
    "Attention",
    "Gaming Protocol",
]:
    assert phrase in dependencies, f"not-adopted dependency decision missing: {phrase!r}"

# Trust and threat boundaries must remain explicit.
for phrase in [
    "browser/client state is hostile/non-authoritative input",
    "Wallet connection is identity context, not blanket authorization",
    "Registry discovery proves service binding, not user/content authority",
    "Pay and Compute remain transitive through Media for V1",
    "Malicious or stale service discovery",
    "Actor substitution",
    "Derived-state poisoning",
    "Dependency downgrade/fail-open",
    "Transitive-dependency bypass",
    "Privacy leakage",
    "Confused-deputy moderation",
]:
    assert phrase in dependencies, f"trust/threat boundary missing: {phrase!r}"

assert "**Status: COMPLETE (Level 1).** Canonical dependency/trust definition" in roadmap
assert "docs/DOOBTUBE-DEPENDENCIES-TRUST.md" in roadmap
assert "DOOBTUBE-0 through DOOBTUBE-3 are complete" in audit

lifecycle = need("docs/DOOBTUBE-DATA-LIFECYCLE.md", [
    "Roadmap step: **DOOBTUBE-3 — Data, storage, media-processing and lifecycle architecture**",
    "Status: **ADOPTED**",
    "DT-DATA-OBJ-001",
    "DT-STORAGE-001",
    "DT-INTEGRITY-001",
    "DT-DERIV-001",
    "DT-PLAYDATA-001",
    "DT-PRIVDATA-001",
    "DT-DELETE-001",
    "DT-STREAM-001",
    "DT-PROJ-001",
    "DT-IDEMP-001",
    "DT-REC-001",
    "DT-LIFE-INV-001",
    "DT-LIFE-INV-014",
    "Next canonical roadmap step: DOOBTUBE-4 — Contracts and protocol adapters",
])

media_storage = need("docs/420-MEDIA-STORAGE-LIFECYCLE.md", [
    "DRAFT", "PREPARED", "UPLOADED", "READY", "DELETED",
    "object_id", "manifest_id", "shard_index", "shard_root", "size_bytes", "commitment_id",
    "MEDIA-STORAGE-INV-001", "MEDIA-STORAGE-INV-014",
])
media_compute = need("docs/420-MEDIA-PAY-COMPUTE.md", [
    "MediaPayComputeAdapter420",
    "Compute Market owns canonical request/job/match/provider/funding/entitlement/settlement/refund state",
    "Media owns only its application lifecycle and mirrors canonical external evidence into that lifecycle",
    "MEDIA-ECON-INV-012",
])
media_live = need("docs/420-MEDIA-LIVESTREAM-SERVICE.md", [
    "MediaStreamRegistry420 remains authoritative for stream controller ownership",
    "persist desired/live session state across process restart",
    "recover persisted desired-live sessions after restart",
    "Raw media, stream payloads and resolved credentials remain outside this service state",
])
media_proj = need("docs/420-MEDIA-PROJECTIONS.md", [
    "deterministic full rebuild",
    "finalized history",
    "public",
])

# Every original DOOBTUBE-3 category must be decided.
for phrase in [
    "MediaAsset",
    "upload preparation",
    "complete Storage object identity",
    "Integrity and provenance",
    "Transcodes, thumbnails, posters and previews",
    "Playback locators and manifests",
    "Visibility and privacy lifecycle",
    "Delete and retention lifecycle",
    "Livestream identity and session lifecycle",
    "Processing-job lifecycle",
    "Search/index/projection lifecycle",
    "Persistence classes",
    "Idempotency model",
    "Recovery model",
    "Schemas frozen by DOOBTUBE-3",
]:
    assert phrase in lifecycle, f"DOOBTUBE-3 category missing: {phrase!r}"

# Exact Storage identity vocabulary must remain complete.
for field in ["object_id","manifest_id","shard_index","shard_root","size_bytes","commitment_id"]:
    assert field in lifecycle, f"Storage object identity field missing: {field}"

# Adopted Media lifecycle must not drift.
for state in ["DRAFT","PREPARED","UPLOADED","READY","DELETED"]:
    assert state in lifecycle, f"asset lifecycle state missing: {state}"

# Required lifecycle/recovery boundaries.
for phrase in [
    "UPLOADED is **not** canonical readiness",
    "DoobTube does not directly schedule Compute providers in V1",
    "Compute completion alone cannot make derivative output READY",
    "A `playback_url` or manifest locator is non-authoritative transport/presentation metadata",
    "A copied URL does not convert UNLISTED to PUBLIC",
    "Delete failure cannot tombstone a still-live asset",
    "A locally persisted controller is not sufficient",
    "deterministically rebuildable",
    "Provider failure must not cause DoobTube to silently rotate object identity",
    "Asset remains UPLOADED",
]:
    assert phrase in lifecycle, f"lifecycle boundary missing: {phrase!r}"

# Logical schemas required by the exit criterion.
for schema in ["MediaAssetView","StorageObjectRef","UploadRetryContext","ProcessingView","LivestreamView","ProjectionView"]:
    assert schema in lifecycle, f"logical schema missing: {schema}"

assert "**Status: COMPLETE (Level 1).** Canonical data/lifecycle definition" in roadmap
assert "docs/DOOBTUBE-DATA-LIFECYCLE.md" in roadmap
assert "DOOBTUBE-0 through DOOBTUBE-3 are complete" in audit

print("DOOBTUBE-3 Level 1 data/lifecycle verification: PASS")
