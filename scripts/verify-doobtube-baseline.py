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
    "not added to \`config/genesis-applications.json\`",
    "not added to \`config/genesis-consumer-services.json\`",
    "no DoobTube-owned smart contract requirement",
    "DoobTube is **non-custodial by architecture**",
    "DOOBTUBE-ARCH-001",
    "DOOBTUBE-ARCH-012",
    "Next canonical roadmap step: DOOBTUBE-1 — Product scope and canonical user workflows",
])
audit = need("docs/DOOBTUBE-AUDIT.md", [
    "DoobTube has **no runtime implementation yet**",
    "DOOBTUBE-0 now canonically specifies",
    "DOOBTUBE-0 is complete",
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
    "DoobTube does not replace or rename \`420Media\`",
    "\`420/service/media/v1\` remains the canonical Media service identity",
    "DoobTube creates no second Media protocol/service authority",
    "DOOBTUBE-0 allocates no frozen/reserved address",
    "DOOBTUBE-0 requires no DoobTube-owned smart contract",
    "DoobTube is non-custodial by default",
    "Wallet/private signing material remains outside DoobTube",
    "raw media and high-volume transport data remain off-chain",
]:
    assert invariant in architecture, f"architecture invariant missing: {invariant!r}"

print("DOOBTUBE-0 Level 1 architecture verification: PASS")
