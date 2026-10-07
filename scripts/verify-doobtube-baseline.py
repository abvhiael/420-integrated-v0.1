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
    "DOOBTUBE-0 and DOOBTUBE-1 are complete",
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
assert "DOOBTUBE-0 and DOOBTUBE-1 are complete" in audit

print("DOOBTUBE-1 Level 1 product-scope verification: PASS")
