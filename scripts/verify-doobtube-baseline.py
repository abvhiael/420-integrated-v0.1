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
    "The application referred to in the current audit request as **420Video** is named **DoobTube**.",
    "does **not** by itself",
    "420/service/media/v1",
])
audit = need("docs/DOOBTUBE-AUDIT.md", [
    "DoobTube is **not currently an implemented or canonically specified application in this repository**.",
    "DoobTube is NOT COMPLETE",
    "CODE COMPLETE: **NO**",
    "PRODUCTION READY: **NO**",
    "420/service/media/v1",
])
roadmap = need("docs/DOOBTUBE-ROADMAP.md", [
    "DOOBTUBE-0",
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
assert media["name"] == "420Media", "DoobTube baseline must not silently rename 420Media"
assert media["genesis_target"] == "video_uploads_basic_livestreaming"
assert media["authority"] == "REPLACEABLE_APPLICATION"

apps = json.loads(need("config/genesis-applications.json"))
assert all(x["name"] not in {"DoobTube", "420Video"} for x in apps["apps"]), (
    "DoobTube/420Video was added to frozen Genesis catalog without reconciling baseline"
)

# This phase intentionally creates no runtime namespace.
assert not (ROOT / "doobtube").exists(), "runtime appeared before DOOBTUBE-0 architecture closeout"
assert not (ROOT / "contracts" / "src" / "doobtube").exists(), (
    "DoobTube contracts appeared before contract responsibility was canonically decided"
)

# Guard against false readiness claims in baseline governance documents.
for text, source in [(name, "name decision"), (audit, "audit"), (roadmap, "roadmap")]:
    for forbidden in [
        "DoobTube is deployed",
        "DoobTube is Genesis-ready",
        "DoobTube is production-ready",
        "DoobTube is testnet-ready",
    ]:
        assert forbidden not in text, f"{source}: forbidden readiness claim {forbidden!r}"

print("DoobTube baseline verification: PASS")
