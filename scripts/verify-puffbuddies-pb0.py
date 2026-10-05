#!/usr/bin/env python3
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "docs/puffbuddies/PUFFBUDDIES.md"
ROAD = ROOT / "docs/puffbuddies/PUFFBUDDIES-ROADMAP.md"
EVIDENCE_01 = ROOT / "docs/puffbuddies/PB-0.1-QUALIFICATION.md"
SCOPE = ROOT / "docs/puffbuddies/PB-0.2-MVP-SCOPE.md"
EVIDENCE_02 = ROOT / "docs/puffbuddies/PB-0.2-QUALIFICATION.md"

errors = []

def need(condition, message):
    if not condition:
        errors.append(message)

for path in (APP, ROAD, EVIDENCE_01, SCOPE, EVIDENCE_02):
    need(path.exists(), f"missing required PuffBuddies PB-0 file: {path.relative_to(ROOT)}")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(1)

app = APP.read_text(encoding="utf-8")
road = ROAD.read_text(encoding="utf-8")
evidence_01 = EVIDENCE_01.read_text(encoding="utf-8")
scope = SCOPE.read_text(encoding="utf-8")
evidence_02 = EVIDENCE_02.read_text(encoding="utf-8")

# PB-0.1 — canonical app identity
for token in [
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
    "## Non-goals fixed by PB-0.1",
    "a public on-chain relationship graph",
    "a pay-to-message strangers service",
    "a social-credit or dating-desirability score",
    "documentation authority only",
]:
    need(token in app, f"PB-0.1 canonical identity missing token: {token}")

identity_ids = re.findall(r"^### (PB-ID-\d{3})\b", app, flags=re.MULTILINE)
need(identity_ids == [f"PB-ID-{i:03d}" for i in range(1, 9)], f"PB-ID invariant sequence drift: {identity_ids}")
need(len(identity_ids) == len(set(identity_ids)), "duplicate PB-ID invariant identifier")

for token in [
    "# PB-0.1 qualification evidence",
    "**PB-0.1 — Canonical app identity**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "**PB-0.1 — COMPLETE**",
    "**PB-0.2 — MVP scope**",
]:
    need(token in evidence_01, f"PB-0.1 evidence record missing token: {token}")

for forbidden_claim in [
    "PuffBuddies is deployed",
    "PuffBuddies contract address",
    "frozen PuffBuddies address",
    "PuffBuddies is testnet ready",
    "PuffBuddies is production ready",
]:
    need(forbidden_claim not in app, f"PB-0.1 unsupported implementation/readiness claim: {forbidden_claim}")

need(re.search(r"0x[a-fA-F0-9]{40}", app) is None, "PB-0.1 must not assign an on-chain address")
need("420/service/puff" not in app.lower(), "PB-0.1 must not invent a PuffBuddies service ID")

# Canonical roadmap cumulative requirements
for token in [
    "# PuffBuddies roadmap",
    "### PB-0.1 — Canonical app identity — COMPLETE",
    "### PB-0.2 — MVP scope",
    "PB-MVP-001 through PB-MVP-015",
    "PB-SCOPE-001 through PB-SCOPE-008",
    "**Qualification level:** Level 1.",
    "**Milestone relationship:** PB-0.2 is not a Level 2 integration milestone",
    "**Dependencies:** PB-0.1 must remain COMPLETE",
    "**Exit criteria:**",
    "### PB-0.3 — Blockchain/off-chain boundary",
    "### PB-0.20 — PB-0 qualification and formal closeout",
]:
    need(token in road, f"canonical roadmap missing token: {token}")

# PB-0.2 — MVP scope
for token in [
    "# PuffBuddies PB-0.2 MVP scope",
    "## MVP product objective",
    "## Canonical MVP capabilities",
    "## MVP release surfaces",
    "## Explicit post-MVP deferrals",
    "## MVP exclusions",
    "## Scope invariants",
    "## PB-0.2 completion boundary",
    "web application",
    "Native iOS and Android applications are post-MVP",
    "buying or forcing a match",
    "paying to bypass a block",
    "paying to send unsolicited private messages to unmatched users",
    "public wallet-address-to-PuffBuddies-profile enumeration",
    "administrator-manufactured mutual consent",
]:
    need(token in scope, f"PB-0.2 MVP scope missing token: {token}")

mvp_ids = re.findall(r"^### (PB-MVP-\d{3})\b", scope, flags=re.MULTILINE)
need(mvp_ids == [f"PB-MVP-{i:03d}" for i in range(1, 16)], f"PB-MVP sequence drift: {mvp_ids}")
need(len(mvp_ids) == len(set(mvp_ids)), "duplicate PB-MVP identifier")

scope_ids = re.findall(r"^### (PB-SCOPE-\d{3})\b", scope, flags=re.MULTILINE)
need(scope_ids == [f"PB-SCOPE-{i:03d}" for i in range(1, 9)], f"PB-SCOPE sequence drift: {scope_ids}")
need(len(scope_ids) == len(set(scope_ids)), "duplicate PB-SCOPE identifier")

for core in [
    "Eligibility-gated entry",
    "Profile creation and editing",
    "Profile media",
    "Discovery",
    "Like and pass",
    "Mutual matching",
    "Private matched-user messaging",
    "Notifications",
    "Unmatch",
    "Block",
    "Report",
    "Account and profile controls",
    "Pause/deactivate",
    "Delete PuffBuddies profile",
    "Core safety is not premium",
]:
    need(core in scope, f"PB-0.2 missing MVP capability heading: {core}")

for deferred in [
    "video profiles",
    "live video calling",
    "group dating",
    "AI-generated match recommendations",
    "boosts",
    "travel mode",
    "subscriptions",
    "photo/liveness verification",
    "iOS application",
    "Android application",
    "public activity feeds",
]:
    need(deferred in scope, f"PB-0.2 missing explicit post-MVP deferral: {deferred}")

need("blocking, reporting, unmatching, account deactivation/deletion" in scope,
     "PB-0.2 must keep core safety/account-exit capabilities in baseline scope")
need("must not be defined as deletion of 420Identity or the user's wallet" in scope,
     "PB-0.2 deletion boundary drift")
need("These features are not categorically forbidden" in scope,
     "PB-0.2 must distinguish deferrals from categorical prohibitions")

for forbidden_scope_claim in [
    "PuffBuddies web application is implemented",
    "PuffBuddies iOS application is implemented",
    "PuffBuddies Android application is implemented",
    "PuffBuddies premium subscriptions are implemented",
    "PuffBuddies is MVP ready",
]:
    need(forbidden_scope_claim not in scope, f"PB-0.2 unsupported implementation/readiness claim: {forbidden_scope_claim}")

need(re.search(r"0x[a-fA-F0-9]{40}", scope) is None, "PB-0.2 must not assign an on-chain address")
need("420/service/puff" not in scope.lower(), "PB-0.2 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.2 qualification evidence",
    "**PB-0.2 — MVP scope**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-MVP-001 through PB-MVP-015",
    "PB-SCOPE-001 through PB-SCOPE-008",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.3 — Blockchain/off-chain boundary**",
]:
    need(token in evidence_02, f"PB-0.2 evidence record missing token: {token}")

if errors:
    print(json.dumps({"pass": False, "step": "PB-0.2", "errors": errors}, indent=2))
    raise SystemExit(1)

print(json.dumps({
    "pass": True,
    "step": "PB-0.2",
    "qualificationLevel": 1,
    "pb01": {
        "canonicalName": "PuffBuddies",
        "identityInvariants": identity_ids,
        "complete": True,
    },
    "pb02": {
        "mvpCapabilities": mvp_ids,
        "scopeInvariants": scope_ids,
        "webFirst": True,
        "nativeMobileDeferred": True,
        "claimsImplementation": False,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
    },
}, indent=2))
