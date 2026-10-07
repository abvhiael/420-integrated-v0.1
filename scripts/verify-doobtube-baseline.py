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
    "Current remediation state: **DOOBTUBE-0 through DOOBTUBE-9 complete**",
    "repository-qualified DoobTube V1 application/client through DOOBTUBE-9",
    "DOOBTUBE-0 through DOOBTUBE-10 are complete",
    "SECURITY QUALIFIED: **YES for current app repository scope**",
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

# DOOBTUBE-4 authorizes only the bounded adapter/test package; backend/web/runtime remain later steps.
allowed_doobtube_files = {
    "doobtube/__init__.py",
    "doobtube/integrations/__init__.py",
    "doobtube/integrations/ecosystem.py",
    "doobtube/tests/__init__.py",
    "doobtube/tests/test_doobtube_adapters.py",
    "doobtube/api/__init__.py",
    "doobtube/api/errors.py",
    "doobtube/api/types.py",
    "doobtube/api/persistence.py",
    "doobtube/api/service.py",
    "doobtube/tests/test_doobtube_backend.py",
    "doobtube/media/__init__.py",
    "doobtube/media/types.py",
    "doobtube/media/security.py",
    "doobtube/media/service.py",
    "doobtube/tests/test_doobtube_media.py",
    "doobtube/web/package.json",
    "doobtube/web/runtime-config.json",
    "doobtube/web/runtime-config.example.json",
    "doobtube/web/security-headers.json",
    "doobtube/web/brand.svg",
    "doobtube/web/styles.css",
    "doobtube/web/index.html",
    "doobtube/web/app.js",
    "doobtube/web/core/config.js",
    "doobtube/web/core/wallet.js",
    "doobtube/web/core/routes.js",
    "doobtube/web/core/state.js",
    "doobtube/web/core/service.js",
    "doobtube/web/scripts/build.mjs",
    "doobtube/web/scripts/check.mjs",
    "doobtube/web/test/web.test.js",
    "doobtube/integration/__init__.py",
    "doobtube/integration/milestone.py",
    "doobtube/tests/test_doobtube_level2_integration.py",
    "doobtube/security/__init__.py",
    "doobtube/security/policy.py",
    "doobtube/tests/test_doobtube_security.py",
    "doobtube/README.md",
    "doobtube/ops/__init__.py",
    "doobtube/ops/config.py",
    "doobtube/ops/server.py",
    "doobtube/deploy/nonproduction.example.json",
    "doobtube/release/manifest-v1.json",
    "doobtube/tests/test_doobtube_ops.py",
}
if (ROOT / "doobtube").exists():
    observed = {str(p.relative_to(ROOT)).replace("\\", "/") for p in (ROOT / "doobtube").rglob("*") if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc" and "dist" not in p.parts}
    assert observed == allowed_doobtube_files, f"unexpected DoobTube runtime files outside qualified inventory: {sorted(observed ^ allowed_doobtube_files)}"
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
assert "DOOBTUBE-0 through DOOBTUBE-10 are complete" in audit

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
assert "DOOBTUBE-0 through DOOBTUBE-10 are complete" in audit

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
    "`MediaStreamRegistry420` remains authoritative for stream controller ownership.",
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
assert "DOOBTUBE-0 through DOOBTUBE-10 are complete" in audit

adapters_doc = need("docs/DOOBTUBE-CONTRACTS-ADAPTERS.md", [
    "Roadmap step: **DOOBTUBE-4 — Contracts and protocol adapters**",
    "Status: **ADOPTED / IMPLEMENTED**",
    "no DoobTube-owned smart contract is required for V1",
    "doobtube/integrations/ecosystem.py",
    "DT-ADAPT-REG-001",
    "DT-ADAPT-MEDIA-001",
    "DT-ADAPT-STORAGE-001",
    "DT-ADAPT-SEARCH-001",
    "DT-ADAPT-NOTIFY-001",
    "DT-ADAPT-ECON-001",
    "DT-ADAPT-INV-001",
    "DT-ADAPT-INV-012",
    "Next canonical roadmap step: DOOBTUBE-5 — Backend/API/indexing/service control plane",
])
adapter_code = need("doobtube/integrations/ecosystem.py", [
    "class DependencyMode",
    "DIRECT_REQUIRED",
    "DIRECT_OPTIONAL",
    "TRANSITIVE_MEDIA",
    "420/service/protocol-registry/v1",
    "420/service/wallet/v1",
    "420/service/smart-accounts/v1",
    "420/service/media/v1",
    "420/service/identity/v1",
    "420/service/rights/v1",
    "420/service/resource-protocol/v1",
    "420/service/search/v1",
    "420/service/notifications/v1",
    "420/service/pay/v1",
    "420/service/compute-market/v1",
    "def admit_registry_snapshot",
    "def admit_media_compatibility",
    "def admit_storage_ready",
    "def admit_public_projection",
    "def admit_notification_subscription",
    "def assert_direct_call_allowed",
    "def assert_no_shadow_authority",
    "def doobtube_contracts_required",
    "def doobtube_service_id",
])
adapter_tests = need("doobtube/tests/test_doobtube_adapters.py", [
    "test_no_doobtube_contract_or_service_identity",
    "test_registry_snapshot_rejects_wrong_id_chain_stale_inactive_and_deprecated",
    "test_media_compatibility_is_fail_closed",
    "test_storage_ready_requires_complete_live_canonical_state",
    "test_search_projection_cannot_widen_visibility_or_authority",
    "test_notifications_cannot_become_entitlement_or_wallet_authority",
    "test_pay_and_compute_are_transitive_only",
    "test_shadow_authority_fails_closed",
])
media_api = need("media/api/types.go", [
    'ServiceID          = "420/service/media/v1"',
    'SigningDomain      = "420/MEDIA/API/SIGNING/V1"',
])

# Repository canonical service-ID declarations used by the adapter must remain unchanged.
for value in [
    'PROTOCOL_REGISTRY = keccak256("420/service/protocol-registry/v1")',
    'WALLET = keccak256("420/service/wallet/v1")',
    'SMART_ACCOUNTS = keccak256("420/service/smart-accounts/v1")',
    'IDENTITY = keccak256("420/service/identity/v1")',
    'RESOURCE_PROTOCOL = keccak256("420/service/resource-protocol/v1")',
    'RIGHTS = keccak256("420/service/rights/v1")',
    'SEARCH = keccak256("420/service/search/v1")',
    'NOTIFICATIONS = keccak256("420/service/notifications/v1")',
    'PAY = keccak256("420/service/pay/v1")',
    'COMPUTE_MARKET = keccak256("420/service/compute-market/v1")',
]:
    assert value in service_ids, f"canonical service ID drifted: {value}"

# Contract-free V1 remains mandatory.
assert not (ROOT / "contracts" / "src" / "doobtube").exists()
assert not (ROOT / "contracts" / "src" / "video").exists()
assert "return False" in adapter_code, "DoobTube contract requirement must remain false"
assert "return None" in adapter_code, "DoobTube service ID must remain absent"
assert "**Status: COMPLETE (Level 1).** Canonical contract/adapter definition" in roadmap
assert "docs/DOOBTUBE-CONTRACTS-ADAPTERS.md" in roadmap
assert "DOOBTUBE-0 through DOOBTUBE-10 are complete" in audit

backend_doc = need("docs/DOOBTUBE-BACKEND-CONTROL-PLANE.md", [
    "Roadmap step: **DOOBTUBE-5 — Backend/API/indexing/service control plane**",
    "Status: **ADOPTED / IMPLEMENTED**",
    "DT-API-001",
    "DT-AUTH-001",
    "DT-IDEMP-API-001",
    "DT-PAGE-001",
    "DT-PERSIST-001",
    "DT-JOB-001",
    "DT-INDEX-001",
    "DT-RECOVERY-001",
    "DT-SECRET-001",
    "DT-OBS-001",
    "DT-HEALTH-001",
    "DT-API-INV-001",
    "DT-API-INV-012",
    "Next canonical roadmap step: DOOBTUBE-6 — Media processing, delivery and livestream integration",
])
backend_service = need("doobtube/api/service.py", [
    "class RuntimeConfig",
    "class Backend",
    '"/v1/health"',
    '"/v1/readiness"',
    '"/v1/feed"',
    '"/v1/preferences"',
    '"/v1/control/rebuild"',
    '"/v1/metrics"',
    "def _idempotent",
    "def apply_projection",
    "def rebuild_projection",
    "def run_due_jobs",
    "raw secrets may not be stored in DoobTube runtime config",
])
backend_types = need("doobtube/api/types.py", [
    'API_VERSION = "v1"',
    "MAX_PAGE_LIMIT = 100",
    "def encode_cursor",
    "def decode_cursor",
    "def rfc3339",
    "class AuthContext",
    "class ProjectionEvent",
])
backend_store = need("doobtube/api/persistence.py", [
    "SCHEMA_VERSION = 2",
    "CREATE TABLE IF NOT EXISTS idempotency",
    "CREATE TABLE IF NOT EXISTS preferences",
    "CREATE TABLE IF NOT EXISTS jobs",
    "CREATE TABLE IF NOT EXISTS projection_blocks",
    "CREATE TABLE IF NOT EXISTS feed_items",
    "CREATE TABLE IF NOT EXISTS media_sessions",
    "database schema is newer than runtime",
])
backend_tests = need("doobtube/tests/test_doobtube_backend.py", [
    "test_health_and_dependency_aware_readiness",
    "test_versioned_api_and_stable_errors",
    "test_mutation_requires_wallet_chain_network_and_capability",
    "test_idempotency_exact_replay_and_conflict",
    "test_preferences_persist_across_restart",
    "test_projection_public_only_pagination_and_opaque_cursor",
    "test_finalized_history_conflict_fails_closed",
    "test_nonfinalized_replacement_and_rebuild",
    "test_rebuild_job_is_replay_safe",
    "test_bounded_job_retry_terminal_failure",
    "test_secrets_boundary_rejects_raw_secret",
    "test_metrics_are_operator_protected",
    "test_migration_version_is_durable",
])

# DOOBTUBE-5 canonical runtime requirements must remain present.
for phrase in [
    "versioned API",
    "Authentication and authorization",
    "Idempotency and replay",
    "Pagination and timestamps",
    "Stable errors",
    "Persistence and migrations",
    "Bounded retries and replay-safe jobs",
    "Indexing / projection control plane",
    "Recovery and rebuild",
    "Secrets boundary",
    "Observability",
    "Health and readiness",
]:
    assert phrase in backend_doc, f"DOOBTUBE-5 requirement missing: {phrase!r}"

# Control-plane routes stay versioned and bounded.
for route in ["/v1/health","/v1/readiness","/v1/feed","/v1/preferences","/v1/control/rebuild","/v1/metrics"]:
    assert route in backend_service, f"backend route missing: {route}"

assert "**Status: COMPLETE (Level 1).** Canonical backend/control-plane definition" in roadmap
assert "docs/DOOBTUBE-BACKEND-CONTROL-PLANE.md" in roadmap
assert "DOOBTUBE-0 through DOOBTUBE-10 are complete" in audit

media_doc = need("docs/DOOBTUBE-MEDIA-INTEGRATION.md", [
    "Roadmap step: **DOOBTUBE-6 — Media processing, delivery and livestream integration**",
    "Status: **ADOPTED / IMPLEMENTED**",
    "DT-MEDIA-001",
    "DT-EGRESS-001",
    "DT-MANIFEST-001",
    "DT-PLAYBACK-001",
    "DT-PROCESS-001",
    "DT-PROVIDER-001",
    "DT-LIVE-001",
    "DT-MEDIA-INV-001",
    "DT-MEDIA-INV-014",
    "Next canonical roadmap step: DOOBTUBE-7 — User-facing web application",
])
media_types = need("doobtube/media/types.py", [
    "MAX_UPLOAD_BYTES = 8 << 30",
    "MAX_SESSION_SECONDS = 24 * 60 * 60",
    "class UploadInspection",
    "class StorageManifest",
    "class ProcessingProfile",
    "class ProviderSnapshot",
    "class PlaybackLocator",
    "class LivestreamSpec",
])
media_security = need("doobtube/media/security.py", [
    "def validate_upload",
    "def validate_endpoint",
    "DNS-aware resolver required",
    "def validate_manifest",
    "def validate_profile",
    "def validate_livestream",
    'ALLOWED_ENGINES = {"ffmpeg", "gstreamer"}',
])
media_service = need("doobtube/media/service.py", [
    "class MediaIntegration",
    "def prepare_upload",
    "def confirm_ready",
    "def admit_playback",
    "def validate_provider",
    "def process",
    "def create_livestream",
    "def start_livestream",
    "def stop_livestream",
    "def recover_livestreams",
    "recovery=True",
])
media_tests = need("doobtube/tests/test_doobtube_media.py", [
    "test_malformed_malicious_media_rejected",
    "test_scanner_quarantine_and_reject_fail_closed",
    "test_ssrf_and_embedded_credentials_denied",
    "test_dns_aware_resolution_required",
    "test_stale_invalid_manifest_rejected",
    "test_verified_playback_rejects_stale_manifest_and_unsafe_url",
    "test_processing_static_profile_and_resource_bounds",
    "test_provider_compromise_and_stale_evidence_rejected",
    "test_processing_result_substitution_and_deadline_rejected",
    "test_livestream_secrets_and_ssrf_fail_closed",
    "test_livestream_controller_authority_and_recovery",
    "test_interrupted_livestream_retry_is_bounded",
])

# Required repository Media security model remains the baseline for DoobTube integration.
media_security_go = need("media/security/policy.go", [
    "MaxUploadBytes: 8 << 30",
    "ValidateResolvedEndpoint",
    "ErrContentQuarantined",
    "ErrContentRejected",
])
media_processor_go = need("media/node/mediaprocessor/processor.go", [
    "Implementations MUST NOT invoke a shell",
    "MaxRuntime",
    "ffmpeg",
    "gstreamer",
])
media_live_go = need("media/node/livegateway/gateway.go", [
    "MaxEndpointBytes = 4096",
    "MaxCredentialRefBytes = 256",
    "MaxSessionDuration = 24 * time.Hour",
    "credentials must not be embedded in endpoint",
])
security_profile = need("media/deploy/security-profile.json", [
    '"content_scanner_required": true',
    '"dns_resolution_validation_required": true',
    '"shell_execution_forbidden": true',
    '"max_parallel_jobs": 4',
    '"opaque_credential_refs_only": true',
])

# DOOBTUBE-6 original adversarial categories must all be explicitly covered.
for phrase in [
    "malformed/non-video uploads",
    "scanner quarantine/rejection",
    "SSRF",
    "embedded URL credentials",
    "stale/mismatched/unsealed/unretrievable/dead manifests",
    "excessive runtime/memory/CPU/PIDs",
    "inactive/unverified/stale/substituted provider",
    "processing deadline expiry",
    "controller drift",
    "bounded retry exhaustion",
    "restart recovery",
]:
    assert phrase in media_doc, f"DOOBTUBE-6 adversarial category missing: {phrase!r}"

assert "**Status: COMPLETE (Level 1).** Canonical media integration definition" in roadmap
assert "docs/DOOBTUBE-MEDIA-INTEGRATION.md" in roadmap
assert "DOOBTUBE-0 through DOOBTUBE-10 are complete" in audit

web_doc = need("docs/DOOBTUBE-WEB-APPLICATION.md", [
    "Roadmap step: **DOOBTUBE-7 — User-facing web application**",
    "Status: **ADOPTED / IMPLEMENTED**",
    "DT-WEB-001",
    "DT-WEB-WALLET-001",
    "DT-WEB-PLAY-001",
    "DT-WEB-INV-001",
    "DT-WEB-INV-014",
    "Next canonical roadmap step: DOOBTUBE-8 — Ecosystem integration milestone",
])
web_index = need("doobtube/web/index.html", [
    "DoobTube",
    'data-view="home"',
    'data-view="search"',
    'data-view="watch"',
    'data-view="creator"',
    'data-view="library"',
    'data-view="upload"',
    'data-view="live"',
    'data-view="subscriptions"',
    'data-view="moderation"',
    'data-view="data"',
    'data-view="status"',
    "aria-live",
    "player",
])
web_app = need("doobtube/web/app.js", [
    "loadFeed", "search", "loadAsset", "renderCreator", "loadLibrary",
    "prepareUpload", "retryUpload", "createLive", "liveAction",
    "subscribeCreator", "report", "appeal", "renderStatus",
    "connectWallet", "safeMediaURL",
])
web_config = need("doobtube/web/runtime-config.json", [
    '"schema":"doobtube-web-runtime-v1"',
    '"serviceId":"420/service/media/v1"',
    '"serviceId":"420/service/search/v1"',
    '"serviceId":"420/service/notifications/v1"',
    '"productionOrigin":null',
    '"status":"DISABLED_UNTIL_CANONICAL_RUNTIME_RESOLVED"',
])
web_check = need("doobtube/web/scripts/check.mjs", [
    "authority-sensitive state must not be browser-persistent",
    "dynamic innerHTML forbidden",
    "DoobTube web structural check PASS",
])
web_tests = need("doobtube/web/test/web.test.js", [
    "runtime config is fail-closed and canonical service IDs are exact",
    "wallet connection blocks wrong network without blocking anonymous routes",
    "canonical route set includes all V1 user surfaces",
    "safe playback rejects script/credential URLs",
    "fixture browser flow composes DoobTube feed and exact Media API routes",
    "upload transport and mutation idempotency remain safe",
    "retry state is memory-only and resets on authority invalidation",
])

# All original DOOBTUBE-7 categories must be concretely represented.
for phrase in [
    "Canonical user surfaces",
    "Wallet connection is requested only for authority-bearing",
    "Loading, empty, error and pagination states are explicit",
    "Retry reuses the exact prepared request/idempotency identity",
    "Media detail / safe rendering",
    "Accessibility",
    "Responsive behavior",
    "Branding / assets",
    "Fail-closed runtime configuration",
    "No private-key custody",
]:
    assert phrase.lower() in web_doc.lower(), f"DOOBTUBE-7 category missing: {phrase!r}"

assert "**Status: COMPLETE (Level 1).** Canonical web definition" in roadmap
assert "docs/DOOBTUBE-WEB-APPLICATION.md" in roadmap
assert "DOOBTUBE-0 through DOOBTUBE-10 are complete" in audit

integration_doc = need("docs/DOOBTUBE-ECOSYSTEM-INTEGRATION.md", [
    "Roadmap step: **DOOBTUBE-8 — Ecosystem integration milestone**",
    "Qualification level: **Level 2 — retained app integration milestone**",
    "DT-INT-REG-001", "DT-INT-AUTH-001", "DT-INT-MEDIA-001",
    "DT-INT-RIGHTS-001", "DT-INT-STORAGE-001", "DT-INT-SEARCH-001",
    "DT-INT-NOTIFY-001", "DT-INT-INV-001", "DT-INT-INV-012",
    "Next canonical roadmap step: DOOBTUBE-9 — Security, abuse and moderation qualification",
])
integration_module = need("doobtube/integration/milestone.py", [
    "DIRECT_REQUIRED", "DIRECT_OPTIONAL", "TRANSITIVE_ONLY", "NOT_ADOPTED_V1",
    "class EcosystemMilestone", "def qualify",
    '"420Registry"', '"420Wallet"', '"420SmartAccounts"', '"420Media"',
    '"420Rights"', '"420Storage"', '"420Search"', '"420Notifications"',
    '"420Identity"', '"420Pay"', '"420Compute"',
])
integration_tests = need("doobtube/tests/test_doobtube_level2_integration.py", [
    "test_full_adopted_stack_qualifies_together",
    "test_optional_identity_can_degrade_to_wallet_only",
    "test_registry_stale_wrong_chain_inactive_and_service_substitution_fail_closed",
    "test_rights_revocation_or_provenance_identity_mismatch_blocks_public_flow",
    "test_storage_unready_blocks_integrated_public_flow",
    "test_search_cannot_widen_visibility_claim_authority_or_substitute_service",
    "test_notifications_cannot_become_entitlement_marketing_or_wallet_authority",
    "test_pay_compute_remain_media_transitive_and_unadopted_services_remain_non_authoritative",
    "test_shadow_authority_transfer_fails_closed",
])
level2_verifier = need("scripts/verify-doobtube-level2.py", [
    "DOOBTUBE-8 Level 2 ecosystem integration verification: PASS",
    "420Media dependency set drifted",
    "direct Pay route appeared",
    "unadopted service became runtime dependency",
])
level2_workflow = need(".github/workflows/doobtube-integration.yml", [
    "name: DoobTube Level 2 integration",
    "Assert exact implementation SHA",
    "Run Level 2 ecosystem integration suite",
    "Retain web application qualification",
    "Verify Level 2 ecosystem integration",
])

assert "**Status: COMPLETE (Level 2).** Canonical milestone definition" in roadmap
assert "docs/DOOBTUBE-ECOSYSTEM-INTEGRATION.md" in roadmap
assert "DOOBTUBE-0 through DOOBTUBE-10 are complete" in audit

security_doc = need("docs/DOOBTUBE-SECURITY-ABUSE-MODERATION.md", [
    "Roadmap step: **DOOBTUBE-9 — Security, abuse and moderation qualification**",
    "Qualification level: **Level 1 — app-scoped security qualification**",
    "Broken access control", "Privilege escalation", "Signature / authorization replay",
    "Nonce / domain mistakes", "Reentrancy / external-call risk",
    "Accounting / custody / refund errors", "Front-running / MEV",
    "Stale oracle / bridge risk", "Content-rights abuse", "Moderation abuse",
    "Spam / Sybil behavior", "Malicious uploads", "Rate / resource exhaustion",
    "Webhook replay", "Operator / provider compromise", "Secrets / logging / privacy leakage",
    "DT-SEC-INV-001", "DT-SEC-INV-014",
    "Next canonical roadmap step: DOOBTUBE-10 — Documentation, deployment and operator closeout",
])
security_policy = need("doobtube/security/policy.py", [
    "class AbusePolicy", "class AbuseGuard", "def redact_sensitive_text",
    "def assert_no_secret_fields", "preferences.write", "control.rebuild", "operator.metrics",
])
security_tests = need("doobtube/tests/test_doobtube_security.py", [
    "test_broken_access_control_and_privilege_escalation_fail_closed",
    "test_actor_operation_rate_limit_and_window_reset",
    "test_replay_same_key_does_not_consume_second_abuse_slot",
    "test_rebuild_spam_is_bounded",
    "test_job_error_persistence_redacts_sensitive_exception_text",
    "test_content_rights_abuse_cannot_publish_revoked_asset",
])
security_verifier = need("scripts/verify-doobtube-security.py", [
    "DOOBTUBE-9 Level 1 security/abuse/moderation verification: PASS",
    "media/security/session.go", "media/security/moderation.go",
    "media/security/webhook.go", "media/security/policy.go",
])
assert "**Status: COMPLETE (Level 1).** Canonical security definition" in roadmap
assert "docs/DOOBTUBE-SECURITY-ABUSE-MODERATION.md" in roadmap
assert "DOOBTUBE-0 through DOOBTUBE-10 are complete" in audit

docs_closeout = need("doobtube/README.md", [
    "Clean build and qualification", "Non-production deployment",
    "docs/DOOBTUBE-OPERATOR-GUIDE.md", "DOOBTUBE-11",
])
need("docs/DOOBTUBE-REFERENCE.md", ["Architecture/component map","Roles and permissions","Registry and service identities","Known limitations"])
need("docs/DOOBTUBE-USER-GUIDE.md", ["Wallet connection","Upload","Reports and appeals"])
need("docs/DOOBTUBE-DEVELOPER-GUIDE.md", ["Clean checkout qualification","Database migrations","Pull request qualification"])
need("docs/DOOBTUBE-OPERATOR-GUIDE.md", ["Preflight","Configuration reference","Monitoring / SLOs","Troubleshooting","Release manifest"])
need("doobtube/deploy/nonproduction.example.json", ['"schema":"doobtube-nonproduction-v1"','"production":false'])
need("doobtube/release/manifest-v1.json", ['"schema":"doobtube-release-manifest-v1"','"source_sha":"MATERIALIZE_AT_RELEASE"'])
assert "**Status: COMPLETE (Level 1).** Canonical documentation/operator definition" in roadmap
assert "DOOBTUBE-0 through DOOBTUBE-10 are complete" in audit
print("DOOBTUBE-10 Level 1 documentation/operator baseline verification: PASS")
