#!/usr/bin/env python3
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "docs/puffbuddies/PUFFBUDDIES.md"
ROAD = ROOT / "docs/puffbuddies/PUFFBUDDIES-ROADMAP.md"

errors = []

def need(condition, message):
    if not condition:
        errors.append(message)

for path in (APP, ROAD):
    need(path.exists(), f"missing required PB-0.1 file: {path.relative_to(ROOT)}")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(1)

app = APP.read_text(encoding="utf-8")
road = ROAD.read_text(encoding="utf-8")

required_app_tokens = [
    "# PuffBuddies",
    "## Canonical application identity",
    "**Canonical name:** PuffBuddies",
    "**Ecosystem:** 420Integrated",
    "**Application class:** adult dating and social discovery",
    "**Primary modes:** Dating, Buddy, Both",
    "cannabis compatibility is a first-class discovery dimension",
    "wallet ownership or wallet address alone must not publicly reveal",
    "## PB-0.1 authority boundary",
    "## Canonical identity invariants",
    "PB-ID-001",
    "PB-ID-002",
    "PB-ID-003",
    "PB-ID-004",
    "PB-ID-005",
    "PB-ID-006",
    "PB-ID-007",
    "PB-ID-008",
    "## Non-goals fixed by PB-0.1",
    "a public on-chain relationship graph",
    "a public list of cannabis consumers",
    "a pay-to-message strangers service",
    "a social-credit or dating-desirability score",
    "documentation authority only",
]
for token in required_app_tokens:
    need(token in app, f"canonical app identity missing token: {token}")

required_road_tokens = [
    "# PuffBuddies roadmap",
    "### PB-0.1 — Canonical app identity — COMPLETE",
    "**Qualification level:** Level 1.",
    "**Milestone relationship:** PB-0.1 is the first PB-0 step",
    "**Exit criteria:**",
    "PB-ID-001 through PB-ID-008",
    "the exact-head PuffBuddies PB-0 workflow passes",
    "### PB-0.2 — MVP scope",
    "### PB-0.20 — PB-0 qualification and formal closeout",
]
for token in required_road_tokens:
    need(token in road, f"canonical roadmap missing token: {token}")

ids = re.findall(r"^### (PB-ID-\d{3})\b", app, flags=re.MULTILINE)
need(ids == [f"PB-ID-{i:03d}" for i in range(1, 9)], f"PB-ID invariant sequence drift: {ids}")
need(len(ids) == len(set(ids)), "duplicate PB-ID invariant identifier")

for forbidden_claim in [
    "PuffBuddies is deployed",
    "PuffBuddies contract address",
    "frozen PuffBuddies address",
    "PuffBuddies is testnet ready",
    "PuffBuddies is production ready",
]:
    need(forbidden_claim not in app, f"PB-0.1 contains unsupported implementation/readiness claim: {forbidden_claim}")

# PB-0.1 must not assign a fixed 0x address or claim a PuffBuddies service id.
need(re.search(r"0x[a-fA-F0-9]{40}", app) is None, "PB-0.1 must not assign an on-chain address")
need("420/service/puff" not in app.lower(), "PB-0.1 must not invent a PuffBuddies service ID")

if errors:
    print(json.dumps({"pass": False, "step": "PB-0.1", "errors": errors}, indent=2))
    raise SystemExit(1)

print(json.dumps({
    "pass": True,
    "step": "PB-0.1",
    "qualificationLevel": 1,
    "canonicalName": "PuffBuddies",
    "applicationClass": "adult dating and social discovery",
    "intentModes": ["Dating", "Buddy", "Both"],
    "identityInvariants": ids,
    "claimsImplementation": False,
    "assignsFixedAddress": False,
}, indent=2))
