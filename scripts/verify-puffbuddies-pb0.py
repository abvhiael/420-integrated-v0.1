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
BOUNDARY = ROOT / "docs/puffbuddies/PB-0.3-BLOCKCHAIN-OFFCHAIN-BOUNDARY.md"
EVIDENCE_03 = ROOT / "docs/puffbuddies/PB-0.3-QUALIFICATION.md"
PRIVACY = ROOT / "docs/puffbuddies/PB-0.4-PRIVACY-INVARIANTS.md"
EVIDENCE_04 = ROOT / "docs/puffbuddies/PB-0.4-QUALIFICATION.md"
CONSENT = ROOT / "docs/puffbuddies/PB-0.5-CONSENT-INVARIANTS.md"
EVIDENCE_05 = ROOT / "docs/puffbuddies/PB-0.5-QUALIFICATION.md"
ELIG = ROOT / "docs/puffbuddies/PB-0.6-ADULT-ELIGIBILITY-POLICY.md"
EVIDENCE_06 = ROOT / "docs/puffbuddies/PB-0.6-QUALIFICATION.md"
THREAT = ROOT / "docs/puffbuddies/PB-0.7-THREAT-TRUST-MODEL.md"
EVIDENCE_07 = ROOT / "docs/puffbuddies/PB-0.7-QUALIFICATION.md"
DEPS = ROOT / "docs/puffbuddies/PB-0.8-ECOSYSTEM-DEPENDENCIES.md"
EVIDENCE_08 = ROOT / "docs/puffbuddies/PB-0.8-QUALIFICATION.md"
STATE = ROOT / "docs/puffbuddies/PB-0.9-STATE-OWNERSHIP.md"
EVIDENCE_09 = ROOT / "docs/puffbuddies/PB-0.9-QUALIFICATION.md"
SAFETY = ROOT / "docs/puffbuddies/PB-0.10-SAFETY-MODERATION-PRINCIPLES.md"
EVIDENCE_10 = ROOT / "docs/puffbuddies/PB-0.10-QUALIFICATION.md"
DATA = ROOT / "docs/puffbuddies/PB-0.11-DATA-LIFECYCLE-DELETION.md"
EVIDENCE_11 = ROOT / "docs/puffbuddies/PB-0.11-QUALIFICATION.md"
LIFE = ROOT / "docs/puffbuddies/PB-0.12-USER-LIFECYCLE.md"
EVIDENCE_12 = ROOT / "docs/puffbuddies/PB-0.12-QUALIFICATION.md"
MATCHING = ROOT / "docs/puffbuddies/PB-0.13-MATCHING-PRINCIPLES.md"
EVIDENCE_13 = ROOT / "docs/puffbuddies/PB-0.13-QUALIFICATION.md"
CANNABIS = ROOT / "docs/puffbuddies/PB-0.14-CANNABIS-TAXONOMY.md"
EVIDENCE_14 = ROOT / "docs/puffbuddies/PB-0.14-QUALIFICATION.md"
VISIBILITY = ROOT / "docs/puffbuddies/PB-0.15-VISIBILITY-MODEL.md"
EVIDENCE_15 = ROOT / "docs/puffbuddies/PB-0.15-QUALIFICATION.md"
NONGOALS = ROOT / "docs/puffbuddies/PB-0.16-NON-GOALS-RECONCILIATION.md"
EVIDENCE_16 = ROOT / "docs/puffbuddies/PB-0.16-QUALIFICATION.md"
STRUCTURE = ROOT / "docs/puffbuddies/PB-0.17-REPOSITORY-STRUCTURE.md"
EVIDENCE_17 = ROOT / "docs/puffbuddies/PB-0.17-QUALIFICATION.md"
DOCINV = ROOT / "docs/puffbuddies/PB-0.18-DOCUMENTATION-INVARIANT-TESTS.md"
EVIDENCE_18 = ROOT / "docs/puffbuddies/PB-0.18-QUALIFICATION.md"

errors = []

def need(condition, message):
    if not condition:
        errors.append(message)

for path in (APP, ROAD, EVIDENCE_01, SCOPE, EVIDENCE_02, BOUNDARY, EVIDENCE_03, PRIVACY, EVIDENCE_04, CONSENT, EVIDENCE_05, ELIG, EVIDENCE_06, THREAT, EVIDENCE_07, DEPS, EVIDENCE_08, STATE, EVIDENCE_09, SAFETY, EVIDENCE_10, DATA, EVIDENCE_11, LIFE, EVIDENCE_12, MATCHING, EVIDENCE_13, CANNABIS, EVIDENCE_14, VISIBILITY, EVIDENCE_15, NONGOALS, EVIDENCE_16, STRUCTURE, EVIDENCE_17, DOCINV, EVIDENCE_18):
    need(path.exists(), f"missing required PuffBuddies PB-0 file: {path.relative_to(ROOT)}")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(1)

app = APP.read_text(encoding="utf-8")
road = ROAD.read_text(encoding="utf-8")
evidence_01 = EVIDENCE_01.read_text(encoding="utf-8")
scope = SCOPE.read_text(encoding="utf-8")
evidence_02 = EVIDENCE_02.read_text(encoding="utf-8")
boundary = BOUNDARY.read_text(encoding="utf-8")
evidence_03 = EVIDENCE_03.read_text(encoding="utf-8")
privacy = PRIVACY.read_text(encoding="utf-8")
evidence_04 = EVIDENCE_04.read_text(encoding="utf-8")
consent = CONSENT.read_text(encoding="utf-8")
evidence_05 = EVIDENCE_05.read_text(encoding="utf-8")
elig = ELIG.read_text(encoding="utf-8")
evidence_06 = EVIDENCE_06.read_text(encoding="utf-8")
threat = THREAT.read_text(encoding="utf-8")
evidence_07 = EVIDENCE_07.read_text(encoding="utf-8")
deps = DEPS.read_text(encoding="utf-8")
evidence_08 = EVIDENCE_08.read_text(encoding="utf-8")
state = STATE.read_text(encoding="utf-8")
evidence_09 = EVIDENCE_09.read_text(encoding="utf-8")
safety = SAFETY.read_text(encoding="utf-8")
evidence_10 = EVIDENCE_10.read_text(encoding="utf-8")
data = DATA.read_text(encoding="utf-8")
evidence_11 = EVIDENCE_11.read_text(encoding="utf-8")
life = LIFE.read_text(encoding="utf-8")
evidence_12 = EVIDENCE_12.read_text(encoding="utf-8")
matching = MATCHING.read_text(encoding="utf-8")
evidence_13 = EVIDENCE_13.read_text(encoding="utf-8")
cannabis = CANNABIS.read_text(encoding="utf-8")
evidence_14 = EVIDENCE_14.read_text(encoding="utf-8")
visibility = VISIBILITY.read_text(encoding="utf-8")
evidence_15 = EVIDENCE_15.read_text(encoding="utf-8")
nongoals = NONGOALS.read_text(encoding="utf-8")
evidence_16 = EVIDENCE_16.read_text(encoding="utf-8")
structure = STRUCTURE.read_text(encoding="utf-8")
evidence_17 = EVIDENCE_17.read_text(encoding="utf-8")
docinv = DOCINV.read_text(encoding="utf-8")
evidence_18 = EVIDENCE_18.read_text(encoding="utf-8")

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
    "PB-BOUNDARY-001 through PB-BOUNDARY-018",
    "**Milestone relationship:** PB-0.3 is not a Level 2 integration milestone",
    "### PB-0.4 — Privacy invariants",
    "PB-PRIV-001 through PB-PRIV-020",
    "**Milestone relationship:** PB-0.4 is not a Level 2 integration milestone",
    "### PB-0.5 — Consent invariants",
    "PB-CONSENT-001 through PB-CONSENT-020",
    "**Milestone relationship:** PB-0.5 is not a Level 2 integration milestone",
    "### PB-0.6 — Adult eligibility policy",
    "PB-ELIG-001 through PB-ELIG-020",
    "**Milestone relationship:** PB-0.6 is not a Level 2 integration milestone",
    "### PB-0.7 — Threat/trust model",
    "PB-THREAT-001 through PB-THREAT-040",
    "**Milestone relationship:** PB-0.7 is not a Level 2 integration milestone",
    "### PB-0.8 — Ecosystem dependencies",
    "PB-DEP-001 through PB-DEP-024",
    "**Milestone relationship:** PB-0.8 is not a Level 2 integration milestone",
    "### PB-0.9 — State ownership",
    "PB-STATE-001 through PB-STATE-040",
    "**Milestone relationship:** PB-0.9 is not a Level 2 integration milestone",
    "### PB-0.10 — Safety/moderation principles",
    "PB-SAFETY-001 through PB-SAFETY-040",
    "**Milestone relationship:** PB-0.10 is not a Level 2 integration milestone",
    "### PB-0.11 — Data lifecycle/deletion",
    "PB-DATA-001 through PB-DATA-036",
    "**Milestone relationship:** PB-0.11 is not a Level 2 integration milestone",
    "### PB-0.12 — User lifecycle",
    "PB-LIFE-001 through PB-LIFE-040",
    "**Milestone relationship:** PB-0.12 is not treated as a Level 2 integration milestone",
    "### PB-0.13 — Matching principles",
    "PB-MATCH-001 through PB-MATCH-040",
    "**Milestone relationship:** PB-0.13 is not a Level 2 integration milestone",
    "### PB-0.14 — Cannabis taxonomy",
    "PB-CANNABIS-001 through PB-CANNABIS-040",
    "**Milestone relationship:** PB-0.14 is not a Level 2 integration milestone",
    "### PB-0.15 — Visibility model",
    "PB-VIS-001 through PB-VIS-040",
    "**Milestone relationship:** PB-0.15 is not a Level 2 integration milestone",
    "### PB-0.16 — Non-goals reconciliation",
    "PB-NONGOAL-001 through PB-NONGOAL-040",
    "**Milestone relationship:** PB-0.16 is not a Level 2 integration milestone",
    "### PB-0.17 — Repository structure",
    "PB-STRUCT-001 through PB-STRUCT-020",
    "**Milestone relationship:** PB-0.17 is not a Level 2 integration milestone",
    "### PB-0.18 — Documentation/invariant tests",
    "PB-DOCINV-001 through PB-DOCINV-020",
    "**Milestone relationship:** PB-0.18 is not a Level 2 integration milestone",
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

# PB-0.3 — blockchain/off-chain boundary
for token in [
    "# PuffBuddies PB-0.3 blockchain/off-chain boundary",
    "## Trust zones",
    "### Zone A — Public-chain authority",
    "### Zone B — Private PuffBuddies application state",
    "### Zone C — Encrypted communication state",
    "### Zone D — Minimal-disclosure attestations and commitments",
    "## Canonical state classification",
    "## State matrix",
    "## Public-chain leakage prohibitions",
    "## Wallet and identity separation",
    "## Indexer, Explorer, Search, and analytics boundary",
    "## Security consequences",
    "## PB-0.3 completion boundary",
    "Likes and passes must not be written to public chain state",
    "match graph",
    "Block relationships must not be public blockchain records",
    "Precise coordinates",
    "Private message content",
    "Sexual, romantic, gender, cannabis, lifestyle",
    "wallet address or 420Name",
    "Hashing does not automatically make sensitive state safe",
    "Off-chain does not mean unauthenticated",
]:
    need(token in boundary, f"PB-0.3 boundary missing token: {token}")

boundary_ids = re.findall(r"^### (PB-BOUNDARY-\d{3})\b", boundary, flags=re.MULTILINE)
need(boundary_ids == [f"PB-BOUNDARY-{i:03d}" for i in range(1, 19)], f"PB-BOUNDARY sequence drift: {boundary_ids}")
need(len(boundary_ids) == len(set(boundary_ids)), "duplicate PB-BOUNDARY identifier")

for prohibited in [
    "Liked(userA,userB)",
    "Matched(userA,userB)",
    'target account in a public "block" transaction event',
    "encoding discovery filters in calldata",
    "publishing exact geohashes",
    "message conversation IDs whose participants can be publicly resolved",
    "payment memo fields to identify a match",
]:
    need(prohibited in boundary, f"PB-0.3 missing public-leakage prohibition example: {prohibited}")

need("may use public-chain authority" in boundary, "PB-0.3 must distinguish permitted from required on-chain use")
need("must not be placed on public chain solely because an attestation is needed" in boundary,
     "PB-0.3 minimum-disclosure attestation boundary drift")
need("must not, by itself, provide a canonical public mechanism to enumerate or discover" in boundary,
     "PB-0.3 wallet/profile unlinkability drift")
need("must not encode who a user liked, matched, blocked, reported, messaged" in boundary,
     "PB-0.3 payment privacy boundary drift")

for forbidden_boundary_claim in [
    "PuffBuddies contract is deployed",
    "PuffBuddies service ID is",
    "PuffBuddies fixed address",
    "PuffBuddies storage is implemented",
    "420Messenger integration is live",
]:
    need(forbidden_boundary_claim not in boundary, f"PB-0.3 unsupported implementation/live claim: {forbidden_boundary_claim}")

need(re.search(r"0x[a-fA-F0-9]{40}", boundary) is None, "PB-0.3 must not assign an on-chain address")
need("420/service/puff" not in boundary.lower(), "PB-0.3 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.3 qualification evidence",
    "**PB-0.3 — Blockchain/off-chain boundary**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-BOUNDARY-001 through PB-BOUNDARY-018",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.4 — Privacy invariants**",
]:
    need(token in evidence_03, f"PB-0.3 evidence record missing token: {token}")

# PB-0.4 — privacy invariants
for token in [
    "# PuffBuddies PB-0.4 privacy invariants",
    "## Privacy principles",
    "## Canonical privacy invariants",
    "## Privacy inference threats",
    "## Privacy by surface",
    "## Data disclosure decision rule",
    "## PB-0.4 completion boundary",
    "Adult eligibility without public birth data",
    "Precise location confidentiality",
    "Like and pass confidentiality",
    "Match confidentiality",
    "Message confidentiality",
    "Preference confidentiality",
    "Wallet/profile unlinkability",
    "PuffBuddies deletion independence",
    "Minimum disclosure by default",
    "No privacy downgrade through metadata",
    "No hidden public correlation identifier",
    "No deterministic sensitive-data confirmation",
    "Private safety actions",
    "Notification privacy",
    "Analytics minimization",
    "Search and discovery cannot become public enumeration",
    "Access follows least privilege",
    "Backups and derived data preserve privacy semantics",
    "Retention must have a stated purpose",
    "No privacy sale or consent bypass",
]:
    need(token in privacy, f"PB-0.4 privacy invariant document missing token: {token}")

privacy_ids = re.findall(r"^### (PB-PRIV-\d{3})\b", privacy, flags=re.MULTILINE)
need(privacy_ids == [f"PB-PRIV-{i:03d}" for i in range(1, 21)], f"PB-PRIV sequence drift: {privacy_ids}")
need(len(privacy_ids) == len(set(privacy_ids)), "duplicate PB-PRIV identifier")

for sensitive in [
    "date of birth",
    "Exact coordinates",
    "like or pass history",
    "match graph",
    "Private message content",
    "Sexual, romantic, gender",
    "public wallet address",
    "delete or deactivate PuffBuddies participation",
    "minimum data required",
    "metadata as well as primary content",
]:
    need(sensitive in privacy, f"PB-0.4 missing sensitive-data guarantee: {sensitive}")

for inference in [
    "triangulate location",
    "infer conversation partners",
    "correlating payment timestamps",
    "predictable profile IDs",
    "response-time differences",
    "notification timing",
    "stale caches, indexes, analytics, or backups",
]:
    need(inference in privacy, f"PB-0.4 missing inference/correlation threat: {inference}")

need("Client-side hiding is not a privacy boundary" in privacy,
     "PB-0.4 must require server-side privacy enforcement")
need("must not create a stable public identifier" in privacy,
     "PB-0.4 public correlation identifier boundary drift")
need("must not be protected solely by deterministic unsalted hashes" in privacy,
     "PB-0.4 deterministic hash privacy boundary drift")
need("must not receive unrestricted access to all PuffBuddies private data" in privacy,
     "PB-0.4 least-privilege operator boundary drift")
need("If the purpose can be satisfied with less disclosure, the less-disclosing design is canonical" in privacy,
     "PB-0.4 minimum-disclosure decision rule drift")

for forbidden_privacy_claim in [
    "PuffBuddies privacy storage is implemented",
    "PuffBuddies database is deployed",
    "PuffBuddies encryption is live",
    "420Messenger privacy integration is live",
    "420Notifications privacy integration is live",
]:
    need(forbidden_privacy_claim not in privacy, f"PB-0.4 unsupported implementation/live claim: {forbidden_privacy_claim}")

need(re.search(r"0x[a-fA-F0-9]{40}", privacy) is None, "PB-0.4 must not assign an on-chain address")
need("420/service/puff" not in privacy.lower(), "PB-0.4 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.4 qualification evidence",
    "**PB-0.4 — Privacy invariants**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-PRIV-001 through PB-PRIV-020",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.5 — Consent invariants**",
]:
    need(token in evidence_04, f"PB-0.4 evidence record missing token: {token}")

# PB-0.5 — consent invariants
for token in [
    "# PuffBuddies PB-0.5 consent invariants",
    "## Consent principles",
    "## Canonical consent invariants",
    "## Consent state implications",
    "## Failure-path expectations",
    "## PB-0.5 completion boundary",
    "Mutual match before ordinary private messaging",
    "Likes do not equal messaging consent",
    "Mutual matches require independent reciprocal intent",
    "Unmatch is unilateral and immediate",
    "Block supremacy",
    "Consent is revocable",
    "Stale authorization must fail closed",
    "Payment cannot create consent",
    "Premium features may enhance tools, not access to people",
    "Administrative roles cannot fabricate romantic/social consent",
    "Moderation authority may restrict, not compel",
    "Consent is scoped to the specific action",
    "Discovery visibility is not messaging consent",
    "Match consent does not waive privacy",
    "Consent does not survive account-ineligible states by default",
    "Safety revocation outranks convenience and delivery",
    "No consent from inactivity or silence",
    "No consent inference from economic or reputation signals",
    "Consent changes must be auditable without becoming public relationship records",
]:
    need(token in consent, f"PB-0.5 consent invariant document missing token: {token}")

consent_ids = re.findall(r"^### (PB-CONSENT-\d{3})\b", consent, flags=re.MULTILINE)
need(consent_ids == [f"PB-CONSENT-{i:03d}" for i in range(1, 21)], f"PB-CONSENT sequence drift: {consent_ids}")
need(len(consent_ids) == len(set(consent_ids)), "duplicate PB-CONSENT identifier")

for guarantee in [
    "requires a currently valid mutual match",
    "must not by itself create ordinary private messaging authority",
    "Either participant may unmatch without approval",
    "A block overrides:",
    "No payment, subscription, $420 transfer",
    "must not create a mutual match or private relationship authorization on behalf of two users",
    "Where authorization freshness is uncertain",
    "must not be interpreted as positive consent",
]:
    need(guarantee in consent, f"PB-0.5 missing consent guarantee: {guarantee}")

for failure_path in [
    "stale cache says matched after authoritative unmatch",
    "queued message attempts delivery after block",
    "premium entitlement remains active after block",
    "retry worker replays a pre-block interaction",
    "one-sided like attempts to open a conversation",
    "admin/support attempts to force a match",
    "payment tries to unlock unmatched messaging",
    "deleted/deactivated user remains in a cached interaction list",
]:
    need(failure_path in consent, f"PB-0.5 missing failure-path class: {failure_path}")

need("No later feature may silently route around a current block" in consent,
     "PB-0.5 block supremacy drift")
need("They must not convert another person's private profile, attention, communication, location, preferences, or safety boundaries into a purchasable entitlement" in consent,
     "PB-0.5 purchased-access boundary drift")
need("Prior authorization must not be treated as permanent" in consent,
     "PB-0.5 revocability drift")
need("Auditability must not create a public match/block/unmatch graph" in consent,
     "PB-0.5 audit/privacy boundary drift")

for forbidden_consent_claim in [
    "PuffBuddies matching engine is implemented",
    "PuffBuddies messaging runtime is implemented",
    "PuffBuddies payment runtime is implemented",
    "PuffBuddies consent contract is deployed",
    "420Messenger consent integration is live",
]:
    need(forbidden_consent_claim not in consent, f"PB-0.5 unsupported implementation/live claim: {forbidden_consent_claim}")

need(re.search(r"0x[a-fA-F0-9]{40}", consent) is None, "PB-0.5 must not assign an on-chain address")
need("420/service/puff" not in consent.lower(), "PB-0.5 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.5 qualification evidence",
    "**PB-0.5 — Consent invariants**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-CONSENT-001 through PB-CONSENT-020",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.6 — Adult eligibility policy**",
]:
    need(token in evidence_05, f"PB-0.5 evidence record missing token: {token}")

# PB-0.6 — adult eligibility policy
for token in [
    "# PuffBuddies PB-0.6 adult eligibility policy",
    "## Canonical baseline",
    "18 years of age or older",
    "## Eligibility interface",
    "isEligibleForPuffBuddies(subject, policyContext) -> ELIGIBLE | INELIGIBLE | UNKNOWN",
    "## Eligibility states",
    "UNKNOWN must fail closed",
    "## Canonical eligibility invariants",
    "## Dependency on canonical identity/attestation authority",
    "## Conceptual eligibility decision",
    "## Failure and adversarial cases",
    "## Privacy boundary",
    "## PB-0.6 completion boundary",
]:
    need(token in elig, f"PB-0.6 eligibility policy missing token: {token}")

elig_ids = re.findall(r"^### (PB-ELIG-\d{3})\b", elig, flags=re.MULTILINE)
need(elig_ids == [f"PB-ELIG-{i:03d}" for i in range(1, 21)], f"PB-ELIG sequence drift: {elig_ids}")
need(len(elig_ids) == len(set(elig_ids)), "duplicate PB-ELIG identifier")

for guarantee in [
    "must not lower the floor below 18",
    "Date of birth remains private",
    "UNKNOWN fails closed",
    "Eligibility is time-sensitive",
    "Revocation removes ordinary participation authority",
    "Suspension and ban override eligibility",
    "Eligibility does not create consent",
    "Eligibility does not imply public membership",
    "Reverification is required when authoritative evidence is stale",
    "Policy-version changes can require reevaluation",
    "Issuer/provider failure is not eligibility",
    "Economic state cannot establish age eligibility",
    "Moderators cannot manually fabricate eligibility",
    "Eligibility evidence access follows least privilege",
]:
    need(guarantee in elig, f"PB-0.6 missing eligibility guarantee: {guarantee}")

for failure_path in [
    "credential expired between login and protected action",
    "credential revoked after an active match exists",
    "issuer becomes unavailable",
    "policy version changes after prior eligibility",
    "stale cache still says ELIGIBLE after revocation",
    "replay of another user's eligibility proof",
    "subject-binding mismatch",
    "premium/payment path attempts to bypass eligibility",
    "moderator/support attempts manual eligibility override",
]:
    need(failure_path in elig, f"PB-0.6 missing failure/adversarial case: {failure_path}")

need("must never lower the canonical PuffBuddies adult floor below 18" in elig,
     "PB-0.6 jurisdiction age-floor drift")
need("Failure of an identity provider, attestation service, RPC, registry, or verifier does not itself prove eligibility" in elig,
     "PB-0.6 fail-open provider behavior drift")
need("PuffBuddies must not create a competing general-purpose identity system" in elig,
     "PB-0.6 duplicate identity authority drift")

for forbidden_elig_claim in [
    "420Identity integration is implemented",
    "PuffBuddies eligibility contract is deployed",
    "PuffBuddies eligibility service ID is",
    "PuffBuddies live age verification",
]:
    need(forbidden_elig_claim not in elig, f"PB-0.6 unsupported implementation/live claim: {forbidden_elig_claim}")

need(re.search(r"0x[a-fA-F0-9]{40}", elig) is None, "PB-0.6 must not assign an on-chain address")
need("420/service/puff" not in elig.lower(), "PB-0.6 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.6 qualification evidence",
    "**PB-0.6 — Adult eligibility policy**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-ELIG-001 through PB-ELIG-020",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.7 — Threat/trust model**",
]:
    need(token in evidence_06, f"PB-0.6 evidence record missing token: {token}")

# PB-0.7 — threat/trust model
for token in [
    "# PuffBuddies PB-0.7 threat/trust model",
    "## Protected assets",
    "## Actor classes",
    "## Trust boundaries",
    "## Canonical abuse cases",
    "## Authority ownership principles",
    "## Security control expectations",
    "## Threat acceptance rule",
    "## PB-0.7 completion boundary",
    "Ordinary authenticated user",
    "Malicious or abusive user",
    "Sybil / multi-account adversary",
    "Compromised account adversary",
    "Curious or malicious operator",
    "Compromised backend/service",
    "Compromised client",
    "External integration failure/adversary",
    "Public-chain observer",
    "Network observer",
    "Data-breach adversary",
    "Automation/bot adversary",
    "Client/server boundary",
    "PuffBuddies / 420Identity boundary",
    "PuffBuddies / 420Messenger boundary",
    "PuffBuddies / 420Notifications boundary",
    "PuffBuddies / 420Pay boundary",
    "PuffBuddies / public-chain boundary",
    "PuffBuddies / Search-Indexer-Explorer boundary",
    "Operator / private-data boundary",
    "Location triangulation",
    "Relationship graph reconstruction",
    "Wallet/profile correlation",
    "Block bypass / ban evasion",
    "Messaging after revocation",
    "Eligibility bypass",
    "Profile scraping and enumeration",
    "Impersonation and identity deception",
    "Report/moderation abuse",
    "Privileged insider misuse",
    "Metadata leakage",
    "Data-remanence after deletion",
    "Secret/session compromise",
    "Rate-limit and resource abuse",
    "Dependency compromise/failure",
    "Replay and stale-state attacks",
    "One authority per decision class",
    "Safety and consent fail closed",
    "External services are capability-limited",
    "Auditability without public exposure",
]:
    need(token in threat, f"PB-0.7 threat model missing token: {token}")

threat_ids = re.findall(r"^### (PB-THREAT-\d{3})\b", threat, flags=re.MULTILINE)
need(threat_ids == [f"PB-THREAT-{i:03d}" for i in range(1, 41)], f"PB-THREAT sequence drift: {threat_ids}")
need(len(threat_ids) == len(set(threat_ids)), "duplicate PB-THREAT identifier")

for guarantee in [
    "Client-side checks are never the sole authority boundary",
    "must not independently manufacture PuffBuddies consent",
    "Payments may establish entitlement state but are not trusted to establish consent",
    "must fail closed rather than infer permission from stale or missing state",
    "Compromise of one dependency should not automatically expose all PuffBuddies private data or authorities",
    "Convenience, cost, or \"blockchain transparency\" alone is not sufficient justification",
]:
    need(guarantee in threat, f"PB-0.7 missing threat-model guarantee: {guarantee}")

for forbidden in [
    "PuffBuddies WAF is implemented",
    "PuffBuddies rate limiter is deployed",
    "PuffBuddies security contract is deployed",
    "PuffBuddies threat service ID is",
]:
    need(forbidden not in threat, f"PB-0.7 unsupported implementation/live claim: {forbidden}")

need(re.search(r"0x[a-fA-F0-9]{40}", threat) is None, "PB-0.7 must not assign an on-chain address")
need("420/service/puff" not in threat.lower(), "PB-0.7 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.7 qualification evidence",
    "**PB-0.7 — Threat/trust model**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-THREAT-001 through PB-THREAT-040",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.8 — Ecosystem dependencies**",
]:
    need(token in evidence_07, f"PB-0.7 evidence record missing token: {token}")

# PB-0.8 — ecosystem dependencies
for token in [
    "# PuffBuddies PB-0.8 ecosystem dependencies",
    "## Governing integration rule",
    "## Canonical dependency roles",
    "## Dependency matrix",
    "## Integration decision rule",
    "## PB-0.8 completion boundary",
    "420Wallet owns wallet authentication/signing surfaces",
    "420Wallet is not PuffBuddies profile or relationship authority",
    "420Identity owns canonical identity-profile and credential lifecycle",
    "420Identity does not automatically prove legal identity or PuffBuddies authorization",
    "420Names owns .420 presentation-name ownership and resolution",
    "420Names is not identity proof or dating membership proof",
    "420Messenger owns canonical private-messaging coordination state",
    "PuffBuddies owns the dating/social authorization handed to Messenger",
    "420Notifications is a non-canonical delivery/presentation dependency",
    "Notification failure cannot broaden access",
    "420Pay owns canonical payment/settlement and approved entitlement evidence",
    "420Pay cannot purchase interpersonal authority",
    "420Registry owns canonical service identity/version discovery",
    "Registry publication does not grant application authority",
    "420AppStore is discovery/presentation, not canonical protocol authority",
    "AppStore cannot mutate Registry truth",
    "420Analytics is derived and non-canonical",
    "Analytics must not ingest protected PuffBuddies payloads",
    "420Indexer is a rebuildable observation/projection dependency",
    "Explorer and Search are derived public discovery surfaces only",
    "420Verify may verify protocol/deployment evidence, not interpersonal identity by default",
    "Dependencies do not inherit each other's authority",
    "Dependency failure must preserve the owning authority",
    "PuffBuddies-specific private state remains PuffBuddies-owned unless explicitly delegated",
]:
    need(token in deps, f"PB-0.8 dependency document missing token: {token}")

dep_ids = re.findall(r"^### (PB-DEP-\d{3})\b", deps, flags=re.MULTILINE)
need(dep_ids == [f"PB-DEP-{i:03d}" for i in range(1, 25)], f"PB-DEP sequence drift: {dep_ids}")
need(len(dep_ids) == len(set(dep_ids)), "duplicate PB-DEP identifier")

for guarantee in [
    "PuffBuddies must not receive private signing keys",
    "Wallet connection must not itself establish PuffBuddies membership",
    "PuffBuddies adult-eligibility integration should consume a minimum-disclosure policy conclusion",
    "A .420 name does not prove legal identity",
    "Messenger must consume current PuffBuddies authorization rather than manufacture a match",
    "A Messenger-native block is an additional deny condition",
    "Notification delivery, retries, acknowledgement, or provider state must not become authority",
    "A successful payment is not consent from another user",
    "A service being registered does not grant custody, signing, spending, governance, profile, consent, match, safety, or execution authority",
    "AppStore catalogue state as a replacement for ProtocolRegistry",
    "Analytics outputs are rebuildable derived data",
    "Indexer is not canonical authority",
    "No dependency output becomes authority in another dependency's domain",
]:
    need(guarantee in deps, f"PB-0.8 missing dependency authority guarantee: {guarantee}")

for protected in [
    "private message content",
    "precise location",
    "private preferences",
    "match graph",
    "block graph",
    "report evidence",
    "raw identity evidence",
]:
    need(protected in deps, f"PB-0.8 analytics/privacy boundary missing protected payload: {protected}")

for decision in [
    "the exact canonical authority owned by the dependency",
    "the minimum data PuffBuddies sends",
    "freshness/finality/revocation requirements",
    "whether compromise can broaden PuffBuddies authority",
    "how the dependency is discovered/version-checked",
    "how the integration is disabled or failed closed",
]:
    need(decision in deps, f"PB-0.8 integration decision rule missing: {decision}")

for forbidden in [
    "PuffBuddies Wallet integration is live",
    "PuffBuddies Messenger integration is live",
    "PuffBuddies Pay integration is live",
    "PuffBuddies Registry service ID is",
    "PuffBuddies AppStore integration is deployed",
]:
    need(forbidden not in deps, f"PB-0.8 unsupported implementation/live claim: {forbidden}")

need(re.search(r"0x[a-fA-F0-9]{40}", deps) is None, "PB-0.8 must not assign an on-chain address")
need("420/service/puff" not in deps.lower(), "PB-0.8 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.8 qualification evidence",
    "**PB-0.8 — Ecosystem dependencies**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-DEP-001 through PB-DEP-024",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.9 — State ownership**",
]:
    need(token in evidence_08, f"PB-0.8 evidence record missing token: {token}")

# PB-0.9 — state ownership
for token in [
    "# PuffBuddies PB-0.9 state ownership",
    "## Ownership principles",
    "## Canonical state ownership",
    "## Canonical ownership matrix",
    "## Conflict-resolution rule",
    "## PB-0.9 completion boundary",
    "Wallet/account-control state",
    "PuffBuddies application membership state",
    "Adult eligibility evidence source state",
    "PuffBuddies eligibility decision state",
    "PuffBuddies profile state",
    "Discovery preference state",
    "Precise location state",
    "Discovery candidate/result state",
    "Like state",
    "Pass state",
    "Match state",
    "Unmatch state",
    "PuffBuddies block state",
    "Messenger-native block state",
    "Conversation authorization state",
    "Message coordination/envelope state",
    "Message plaintext/content state",
    "Notification event intent state",
    "Notification delivery/presentation state",
    "Report state",
    "Moderation evidence and case-history state",
    "Suspension/ban state",
    "Account activation/deactivation state",
    "PuffBuddies deletion state",
    "Identity profile/credential state",
    ".420 name state",
    "Service identity/version state",
    "AppStore catalogue/presentation state",
    "Payment settlement state",
    "PuffBuddies premium entitlement state",
    "Public chain/protocol observation state",
    "Indexer projection state",
    "Search/Explorer presentation state",
    "PuffBuddies analytics event/aggregate state",
    "420Analytics outputs",
    "Client/UI state",
    "Session/access-token state",
    "Rate-limit/anti-abuse operational state",
    "Configuration/policy-version state",
    "Audit/security evidence state",
]:
    need(token in state, f"PB-0.9 state-ownership document missing token: {token}")

state_ids = re.findall(r"^### (PB-STATE-\d{3})\b", state, flags=re.MULTILINE)
need(state_ids == [f"PB-STATE-{i:03d}" for i in range(1, 41)], f"PB-STATE sequence drift: {state_ids}")
need(len(state_ids) == len(set(state_ids)), "duplicate PB-STATE identifier")

for guarantee in [
    "Every security-relevant state class must have one canonical authority owner",
    "A cache, projection, index, analytics view, notification, client copy, or payment record does not become canonical",
    "Conflicts resolve in favor of the canonical authority",
    "PuffBuddies consumes only the minimum approved eligibility conclusion",
    "Messenger conversations, notification events, payment state, AppStore state, or cached client state must not manufacture or restore a match",
    "A Messenger-native block is an additional deny condition",
    "The effective permission to send a PuffBuddies matched-user message is the intersection of both authorities",
    "Deletion does not delete unrelated 420Wallet, 420Identity, or 420Names state",
    "Entitlement never owns consent, block, eligibility, or another user's private-data access",
    "Indexer is not canonical authority",
    "Security-sensitive actions must recheck authoritative server/protocol state",
]:
    need(guarantee in state, f"PB-0.9 missing ownership guarantee: {guarantee}")

for conflict in [
    "identify the canonical owner of the state class",
    "reject stale or unauthorized derived copies",
    "re-resolve current canonical state",
    "apply revocation/finality/freshness rules",
    "fail closed where the protected decision remains uncertain",
]:
    need(conflict in state, f"PB-0.9 conflict-resolution rule missing: {conflict}")

for forbidden in [
    "PuffBuddies database is implemented",
    "PuffBuddies state API is deployed",
    "PuffBuddies state contract is deployed",
    "PuffBuddies state service ID is",
]:
    need(forbidden not in state, f"PB-0.9 unsupported implementation/live claim: {forbidden}")

need(re.search(r"0x[a-fA-F0-9]{40}", state) is None, "PB-0.9 must not assign an on-chain address")
need("420/service/puff" not in state.lower(), "PB-0.9 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.9 qualification evidence",
    "**PB-0.9 — State ownership**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-STATE-001 through PB-STATE-040",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.10 — Safety and moderation principles**",
]:
    need(token in evidence_09, f"PB-0.9 evidence record missing token: {token}")

# PB-0.10 — safety and moderation principles
for token in [
    "# PuffBuddies PB-0.10 safety and moderation principles",
    "## Safety principles",
    "## Canonical report classes",
    "## Canonical moderation states",
    "## Canonical safety invariants",
    "## Escalation boundaries",
    "## Safety action classes",
    "## Appeals and restoration principles",
    "## PB-0.10 completion boundary",
    "Harassment, threats, and abusive conduct",
    "Stalking, doxxing, and location-safety abuse",
    "Impersonation, deceptive identity, and catfishing",
    "Minor / adult-eligibility concern",
    "Sexual exploitation and non-consensual sexual content",
    "Fraud, scam, financial coercion, and extortion",
    "Hate, targeted dehumanization, and severe discriminatory abuse",
    "Spam, botting, scraping, and platform manipulation",
    "Block/ban evasion and unauthorized contact",
    "Dangerous or unlawful conduct requiring special review",
    "Cannabis-related coercion or unsafe transactional conduct",
    "Other / policy-unclear safety concern",
    "RECEIVED",
    "TRIAGED",
    "REVIEWING",
    "RESTRICTED_PENDING_REVIEW",
    "ACTIONED",
    "NO_ACTION",
    "APPEALED",
    "CLOSED",
    "Block is immediate and independent",
    "Report and block are separate authorities",
    "Report count is not guilt",
    "Safety action may restrict but never compel consent",
    "Reporter identity and evidence remain private",
    "No retaliation enablement",
    "Safety actions override convenience and monetization",
    "Stale authorization fails closed after safety action",
    "Safety actions are scoped and auditable",
    "Moderator access follows least privilege",
    "Payments and status cannot buy safety exceptions",
    "Safety state remains private and non-enumerable",
    "Automated systems cannot be sole irreversible adjudicator by default",
    "Evidence integrity matters",
    "Safety outcomes do not create public reputation scores",
    "Account compromise is considered in moderation",
    "Standard moderation escalation",
    "High-priority safety escalation",
    "Emergency / external-authority boundary",
    "Cross-service escalation is capability-limited",
]:
    need(token in safety, f"PB-0.10 safety document missing token: {token}")

safety_ids = re.findall(r"^### (PB-SAFETY-\d{3})\b", safety, flags=re.MULTILINE)
need(safety_ids == [f"PB-SAFETY-{i:03d}" for i in range(1, 41)], f"PB-SAFETY sequence drift: {safety_ids}")
need(len(safety_ids) == len(set(safety_ids)), "duplicate PB-SAFETY identifier")

for guarantee in [
    "A user may block without waiting for moderation review",
    "Block effectiveness must not depend on reporter proof",
    "Number of reports, popularity, reputation, payment status, or engagement score must not be treated as conclusive proof of misconduct",
    "They must not force a like, match, unblock, rematch, message, profile disclosure, or interpersonal contact",
    "Reporter linkage, report content, evidence, moderation notes, internal risk signals, and case history are private safety state",
    "Current block, suspension, ban, eligibility hold, or communication restriction outranks premium entitlement",
    "must not preserve interaction authority after canonical PuffBuddies safety state revokes it",
    "must not bypass a block, suspension, ban, eligibility hold, report handling, or evidence rule",
    "must not silently become a public desirability, trust, social-credit, or dating-ranking score",
    "PuffBuddies moderation is not itself emergency response or law enforcement",
    "A cross-service safety request must not grant PuffBuddies or moderators ambient authority",
]:
    need(guarantee in safety, f"PB-0.10 missing safety guarantee: {guarantee}")

for appeal in [
    "must not gain access to reporter identity",
    "restoration must explicitly re-evaluate current block, eligibility, lifecycle, Messenger, and other deny states",
    "does not force another user to unblock, rematch, restore a conversation, or resume contact",
    "does not create a restoration entitlement to another person",
]:
    need(appeal in safety, f"PB-0.10 appeal/restoration boundary missing: {appeal}")

for forbidden in [
    "PuffBuddies moderation runtime is implemented",
    "PuffBuddies moderation console is deployed",
    "PuffBuddies safety classifier is live",
    "PuffBuddies moderation service ID is",
]:
    need(forbidden not in safety, f"PB-0.10 unsupported implementation/live claim: {forbidden}")

need(re.search(r"0x[a-fA-F0-9]{40}", safety) is None, "PB-0.10 must not assign an on-chain address")
need("420/service/puff" not in safety.lower(), "PB-0.10 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.10 qualification evidence",
    "**PB-0.10 — Safety/moderation principles**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-SAFETY-001 through PB-SAFETY-040",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.11 — Data lifecycle/deletion**",
]:
    need(token in evidence_10, f"PB-0.10 evidence record missing token: {token}")

# PB-0.11 — data lifecycle and deletion
for token in [
    "# PuffBuddies PB-0.11 data lifecycle and deletion",
    "## Lifecycle principles",
    "## Canonical data-lifecycle invariants",
    "## Lifecycle state model",
    "## Retention decision rule",
    "## Deletion-surface checklist",
    "## PB-0.11 completion boundary",
    "Deactivation is not deletion",
    "Deactivation revokes ordinary participation authority",
    "Deactivation does not imply ecosystem-account deletion",
    "Deletion is PuffBuddies-scoped",
    "Delete request immediately closes ordinary participation",
    "Deletion must not be blocked by payment status",
    "Deletion must not require interpersonal consent",
    "Profile and preference data are deletion targets",
    "Private relationship state is a deletion target subject to safety/audit exceptions",
    "Precise location data requires aggressive minimization",
    "Message-content deletion is bounded by participant and Messenger authority",
    "Notification data follows source lifecycle",
    "Session and access state is revoked on deletion",
    "Cached copies cannot preserve deleted authority",
    "Search and discovery removal follows deletion",
    "Analytics cannot become a deletion bypass",
    "Backups are not ordinary active storage",
    "Backup retention must be bounded",
    "Logs require purpose and minimization",
    "Derived data inherits source privacy",
    "De-identification must resist practical relinking",
    "Moderation evidence may outlive ordinary profile deletion only for a narrow purpose",
    "Safety retention cannot recreate ordinary participation",
    "Retained evidence remains least-privilege",
    "Ban-evasion controls may retain minimum necessary identifiers",
    "Legal/regulatory retention requires explicit authority",
    "Retention expiry requires deletion or reauthorization",
    "Processor/dependency copies require lifecycle contracts",
    "Ecosystem canonical state remains independently owned",
    "Public-chain immutability is an explicit limitation",
    "Public-chain use must minimize future deletion conflict",
    "Deletion cannot rely on encrypt-and-forget alone without policy",
    "Account identifiers must not be silently recycled",
    "Re-registration is a new lifecycle decision",
    "Deletion completion must have honest semantics",
    "Deletion evidence must not recreate deleted private state",
]:
    need(token in data, f"PB-0.11 lifecycle document missing token: {token}")

data_ids = re.findall(r"^### (PB-DATA-\d{3})\b", data, flags=re.MULTILINE)
need(data_ids == [f"PB-DATA-{i:03d}" for i in range(1, 37)], f"PB-DATA sequence drift: {data_ids}")
need(len(data_ids) == len(set(data_ids)), "duplicate PB-DATA identifier")

for guarantee in [
    "Deactivation and deletion are distinct actions",
    "A deletion request must immediately stop ordinary participation before asynchronous cleanup can finish",
    "Backups, caches, indexes, analytics, logs, derived copies, and external processors must preserve the same deletion/privacy semantics as the source data",
    "PuffBuddies must never promise erasure of public-chain records that the protocol cannot actually erase",
    "Deleted data restored from backup must re-enter deletion processing before it can return to ordinary application use",
    "Replacing a user identifier with a stable hash, wallet address, profile ID, deterministic token, or other reversible/correlatable identifier is not sufficient",
    "PuffBuddies deletion must not falsely claim to erase them",
    "Completed deletion does not guarantee restoration of prior profile, matches, preferences, premium state, or interpersonal consent",
    "The product must not claim \"everything everywhere is erased\" when known external/immutable/backup exceptions remain",
]:
    need(guarantee in data, f"PB-0.11 missing lifecycle guarantee: {guarantee}")

for state_token in [
    "ACTIVE",
    "DEACTIVATED",
    "DELETE_REQUESTED",
    "DELETION_IN_PROGRESS",
    "DELETION_COMPLETE",
]:
    need(state_token in data, f"PB-0.11 lifecycle state model missing: {state_token}")

for retention in [
    "data class",
    "canonical owner",
    "minimum fields retained",
    "duration or review/expiry condition",
    "deletion/anonymization trigger",
    "backup/replica/processor handling",
    "whether the retained form can be practically relinked to the user",
]:
    need(retention in data, f"PB-0.11 retention decision rule missing: {retention}")

for forbidden in [
    "PuffBuddies deletion worker is implemented",
    "PuffBuddies retention scheduler is deployed",
    "PuffBuddies database deletion is live",
    "PuffBuddies deletion service ID is",
]:
    need(forbidden not in data, f"PB-0.11 unsupported implementation/live claim: {forbidden}")

need(re.search(r"0x[a-fA-F0-9]{40}", data) is None, "PB-0.11 must not assign an on-chain address")
need("420/service/puff" not in data.lower(), "PB-0.11 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.11 qualification evidence",
    "**PB-0.11 — Data lifecycle/deletion**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-DATA-001 through PB-DATA-036",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.12 — User lifecycle**",
]:
    need(token in evidence_11, f"PB-0.11 evidence record missing token: {token}")

# PB-0.12 — user lifecycle
for token in [
    "# PuffBuddies PB-0.12 user lifecycle",
    "## Lifecycle principles",
    "## Canonical lifecycle states",
    "## Canonical transition invariants",
    "## Canonical transition matrix",
    "## Transition authorization rule",
    "## PB-0.12 completion boundary",
    "UNREGISTERED",
    "ELIGIBILITY_PENDING",
    "ELIGIBILITY_FAILED",
    "PROFILE_INCOMPLETE",
    "ACTIVE",
    "DEACTIVATED",
    "RESTRICTED",
    "SUSPENDED",
    "BANNED",
    "DELETE_REQUESTED",
    "DELETION_IN_PROGRESS",
    "DELETION_COMPLETE",
    "RETAINED_EVIDENCE_ONLY",
    "APPEAL_REVIEW",
    "Entry starts from UNREGISTERED",
    "Eligibility gates ordinary account activation",
    "Profile completion gates ordinary discovery",
    "ACTIVE can voluntarily transition to DEACTIVATED",
    "DEACTIVATED reactivation requires current checks",
    "Safety authority may transition into RESTRICTED",
    "Safety authority may transition into SUSPENDED",
    "Safety authority may transition into BANNED",
    "Appeal transition does not restore access",
    "Restriction removal requires explicit canonical transition",
    "Eligibility loss can revoke ACTIVE participation",
    "Delete request is user-authorized and terminal for ordinary participation",
    "DELETE_REQUESTED advances through deletion processing",
    "DELETION_COMPLETE does not reactivate",
    "Retained evidence never becomes ordinary participation",
    "New registration after deletion is not state restoration",
    "Block and match state do not own lifecycle",
    "Payment/entitlement state does not own lifecycle",
    "Wallet and identity state do not own PuffBuddies lifecycle",
    "Sessions follow lifecycle authority",
    "Notifications and queues cannot transition lifecycle",
    "Client state cannot transition protected lifecycle by itself",
    "Conflicting lifecycle state fails closed",
    "Lifecycle changes invalidate stale derived state",
    "Lifecycle state remains private",
    "Lifecycle transitions are protected and auditable",
]:
    need(token in life, f"PB-0.12 lifecycle document missing token: {token}")

life_ids = re.findall(r"^### (PB-LIFE-\d{3})\b", life, flags=re.MULTILINE)
need(life_ids == [f"PB-LIFE-{i:03d}" for i in range(1, 41)], f"PB-LIFE sequence drift: {life_ids}")
need(len(life_ids) == len(set(life_ids)), "duplicate PB-LIFE identifier")

for guarantee in [
    "Lifecycle authority is separate from Wallet, Identity, Names, Messenger, Notifications, Pay, Registry, and AppStore authority",
    "Eligibility is necessary for ordinary participation but is not itself the PuffBuddies lifecycle state",
    "Stale clients, sessions, queues, notifications, matches, premium state, or downstream dependencies must not preserve permissions revoked by lifecycle state",
    "UNREGISTERED or ELIGIBILITY_PENDING may advance toward PROFILE_INCOMPLETE/ACTIVE only after a current authoritative ELIGIBLE result",
    "Prior ACTIVE status is not permanent authorization",
    "Suspension revokes ordinary participation regardless of current match/payment/session state",
    "No dependency may independently manufacture or reverse the PuffBuddies ban state",
    "APPEAL_REVIEW preserves the applicable deny/restriction unless a canonical review outcome explicitly changes it",
    "DELETION_COMPLETE cannot transition directly back to ACTIVE",
    "Payment/entitlement state does not own lifecycle",
    "A valid-looking token must fail authorization when canonical lifecycle state no longer permits the requested action",
    "If current state cannot be established, ordinary participation fails closed",
]:
    need(guarantee in life, f"PB-0.12 missing lifecycle guarantee: {guarantee}")

for transition_req in [
    "source state(s)",
    "destination state",
    "authenticated actor or canonical authority",
    "preconditions",
    "eligibility effect",
    "safety/moderation effect",
    "consent/match/messaging effect",
    "session/token invalidation effect",
    "visibility/discovery effect",
    "retention/deletion effect",
    "dependency notifications or capability revocations",
    "audit evidence",
    "failure/stale-state behavior",
]:
    need(transition_req in life, f"PB-0.12 transition authorization rule missing: {transition_req}")

for forbidden in [
    "PuffBuddies lifecycle service is implemented",
    "PuffBuddies lifecycle database is deployed",
    "PuffBuddies lifecycle worker is live",
    "PuffBuddies lifecycle service ID is",
]:
    need(forbidden not in life, f"PB-0.12 unsupported implementation/live claim: {forbidden}")

need(re.search(r"0x[a-fA-F0-9]{40}", life) is None, "PB-0.12 must not assign an on-chain address")
need("420/service/puff" not in life.lower(), "PB-0.12 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.12 qualification evidence",
    "**PB-0.12 — User lifecycle**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-LIFE-001 through PB-LIFE-040",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.13 — Matching principles**",
]:
    need(token in evidence_12, f"PB-0.12 evidence record missing token: {token}")

# PB-0.13 — matching principles
for token in [
    "# PuffBuddies PB-0.13 matching principles",
    "## Matching principles",
    "## Allowed matching inputs",
    "## Hard exclusions",
    "## Ranking constraints",
    "## Match formation and economic influence",
    "## Allowed-input decision rule",
    "## PB-0.13 completion boundary",
    "Explicit user mode is allowed",
    "Explicit discovery preferences are allowed",
    "Age-range compatibility may be used after eligibility",
    "Gender/orientation compatibility may use explicit private preferences",
    "Cannabis compatibility may be used",
    "Lifestyle and relationship preferences may be used",
    "Coarse proximity may be used",
    "Activity freshness may be used narrowly",
    "Profile completeness may be used only within lifecycle policy",
    "User-controlled verification indicators may be used narrowly",
    "Current block is a hard exclusion",
    "Ineligible lifecycle state is a hard exclusion",
    "Adult-eligibility failure is a hard exclusion",
    "Visibility denial is a hard exclusion",
    "Safety restriction is a hard exclusion within its scope",
    "Deletion state is a hard exclusion",
    "Existing deny state cannot be bypassed by alternate economic path",
    "Self-matching is excluded",
    "Canonical pair state must prevent stale rematch",
    "Unknown protected authority fails closed",
    "Ranking is non-canonical",
    "Ranking cannot manufacture a match",
    "Ranking must respect action-scoped consent",
    "Ranking inputs require current authoritative source state",
    "Stale ranking output cannot preserve authorization",
    "Ranking should minimize sensitive inference",
    "Ranking must be purpose-limited",
    "Ranking must not expose private scores",
    "Ranking experiments cannot weaken invariants",
    "Engagement optimization is subordinate to user control",
    "Ranking must preserve mode compatibility",
    "Ranking must not rely on exact wealth or token value",
    "Ranking must not use payment to alter another user's consent surface",
    "Ranking must not convert moderation history into desirability",
    "Ranking must be reproducibly policy-bounded",
    "Ranking failure must degrade safely",
    "Like remains unilateral intent only",
    "Mutual match requires reciprocal authorized intent",
    "Economic influence cannot create or restore consent",
    "Administrative and algorithmic systems cannot fabricate consent",
]:
    need(token in matching, f"PB-0.13 matching document missing token: {token}")

match_ids = re.findall(r"^### (PB-MATCH-\d{3})\b", matching, flags=re.MULTILINE)
need(match_ids == [f"PB-MATCH-{i:03d}" for i in range(1, 41)], f"PB-MATCH sequence drift: {match_ids}")
need(len(match_ids) == len(set(match_ids)), "duplicate PB-MATCH identifier")

for guarantee in [
    "A mutual match requires independent reciprocal user intent under PB-0.5",
    "Hard safety, lifecycle, eligibility, block, and visibility exclusions outrank ranking",
    "Money, token holdings, payment status, staking, or premium purchase cannot buy another person's match or consent",
    "Derived scores are non-canonical and must never become public social-credit or desirability scores",
    "No ranking score, payment, boost, or stale cache may override the block",
    "A mutual match must come from independent authorized user intent",
    "must not bypass block, consent, eligibility, safety, lifecycle, visibility, or privacy rules",
    "Wallet balance, token holdings, NFT value, stake, transaction history, payment volume, or portfolio value must not be used as ordinary dating desirability inputs",
    "It must not force placement into a specific other user's feed, bypass that user's filters/blocks, or compel reciprocal visibility",
    "A one-sided like may contribute to match formation but does not itself authorize ordinary private messaging",
]:
    need(guarantee in matching, f"PB-0.13 missing matching guarantee: {guarantee}")

for decision in [
    "the input's canonical source",
    "whether it is user-declared, derived, or authoritative",
    "the product purpose",
    "privacy classification",
    "freshness/revocation requirements",
    "whether it can expose or infer sensitive data",
    "whether it can affect hard exclusions",
    "whether the user can control or correct it where appropriate",
    "retention/deletion behavior",
    "whether economic influence can alter it",
    "how failure/staleness behaves",
]:
    need(decision in matching, f"PB-0.13 allowed-input decision rule missing: {decision}")

for forbidden in [
    "PuffBuddies matching engine is implemented",
    "PuffBuddies recommendation service is live",
    "PuffBuddies ranking model is deployed",
    "PuffBuddies matching service ID is",
]:
    need(forbidden not in matching, f"PB-0.13 unsupported implementation/live claim: {forbidden}")

need(re.search(r"0x[a-fA-F0-9]{40}", matching) is None, "PB-0.13 must not assign an on-chain address")
need("420/service/puff" not in matching.lower(), "PB-0.13 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.13 qualification evidence",
    "**PB-0.13 — Matching principles**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-MATCH-001 through PB-MATCH-040",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.14 — Cannabis taxonomy**",
]:
    need(token in evidence_13, f"PB-0.13 evidence record missing token: {token}")

# PB-0.14 — cannabis taxonomy
for token in [
    "# PuffBuddies PB-0.14 cannabis taxonomy",
    "## Taxonomy principles",
    "## Canonical cannabis-compatibility vocabulary",
    "## Privacy and identity boundaries",
    "## Matching and consent boundaries",
    "## Economic and tokenization boundaries",
    "## Safety, legality, and health boundaries",
    "## Taxonomy field decision rule",
    "## PB-0.14 completion boundary",
    "Use-status vocabulary",
    "NON_USER is first-class",
    "Frequency is approximate self-description",
    "PREFER_NOT_TO_SAY is supported",
    "Method vocabulary is multi-select and optional",
    "No method implies consent",
    "Social-context vocabulary",
    "Environment-boundary vocabulary",
    "Partner-compatibility vocabulary",
    "Cannabis interest vocabulary is distinct from use",
    "Cultivation interest is not production authority",
    "Knowledge/enthusiasm is not expertise credential",
    "Cannabis fields are private by default",
    "Wallet ownership must not reveal cannabis identity",
    "420Identity must not become a public cannabis registry",
    "420Names must not encode cannabis profile state",
    "Registry/AppStore/Search/Explorer must not enumerate cannabis profiles",
    "Analytics cannot become a shadow cannabis registry",
    "Deterministic hashes do not make cannabis identity public-safe",
    "Cannabis fields follow deletion and lifecycle rules",
    "Cannabis compatibility may influence ranking only as private user preference",
    "Cannabis compatibility is not a hard universal desirability score",
    "Non-use must remain matchable",
    "Cannabis fields cannot override hard exclusions",
    "Cannabis similarity does not create consent",
    "Cannabis mismatch does not justify harassment",
    "Consumption boundaries outrank compatibility",
    "Recommendation systems must not infer hidden substance-use traits by default",
    "Token holdings do not prove cannabis use",
    "Cannabis identity must not be tokenized",
    "Payment cannot alter another user's cannabis boundaries",
    "Cannabis compatibility must not become a marketplace entitlement",
    "Cannabis compatibility is not legal advice",
    "Cannabis compatibility is not medical advice",
    "Cannabis compatibility is not impairment evidence",
    "Coercion is prohibited",
    "Unauthorized commerce is out of scope",
    "Minor-oriented cannabis matching is prohibited",
    "Safety reporting may reference cannabis context without public identity",
    "Taxonomy extensions require bounded review",
]:
    need(token in cannabis, f"PB-0.14 cannabis taxonomy missing token: {token}")

cannabis_ids = re.findall(r"^### (PB-CANNABIS-\d{3})\b", cannabis, flags=re.MULTILINE)
need(cannabis_ids == [f"PB-CANNABIS-{i:03d}" for i in range(1, 41)], f"PB-CANNABIS sequence drift: {cannabis_ids}")
need(len(cannabis_ids) == len(set(cannabis_ids)), "duplicate PB-CANNABIS identifier")

for guarantee in [
    "Cannabis use is optional; non-use is a valid first-class state",
    "Cannabis compatibility never creates consent to consume, purchase, sell, transport, share, or use cannabis",
    "Economic/token state must not create or certify cannabis identity",
    "NON_USER must not be treated as lower-quality, less compatible in general, or ineligible merely for non-use",
    "Declining disclosure must not become a public negative signal or automatic safety/reputation penalty",
    "Cannabis fields are private PuffBuddies state",
    "A wallet address, signature, balance, token holding, transaction history, or connected-account state must not by itself reveal or infer a PuffBuddies cannabis profile",
    "Holding $420 or any token/NFT does not prove cannabis use",
    "PuffBuddies must not require or issue transferable tokens/NFTs whose ownership is the canonical proof",
    "Shared use status, method, strain interest, lifestyle, or compatibility score does not create a like, match, messaging permission, or consent to consume together",
    "Use status/frequency alone must not be treated as proof that a user is currently impaired",
]:
    need(guarantee in cannabis, f"PB-0.14 missing cannabis boundary guarantee: {guarantee}")

for decision in [
    "canonical field name",
    "user-facing meaning",
    "whether it is use, interest, method, context, preference, or boundary",
    "whether it is single-select, multi-select, optional, or free-form",
    "privacy classification",
    "visibility/disclosure rules",
    "matching/ranking purpose",
    "prohibited inferences",
    "retention/deletion behavior",
    "safety/legal/health caveats",
    "whether economic/token state can influence it",
    "whether it can be represented publicly",
]:
    need(decision in cannabis, f"PB-0.14 taxonomy decision rule missing: {decision}")

for forbidden in [
    "PuffBuddies cannabis profile is implemented",
    "PuffBuddies cannabis registry is live",
    "PuffBuddies cannabis NFT is deployed",
    "PuffBuddies cannabis service ID is",
]:
    need(forbidden not in cannabis, f"PB-0.14 unsupported implementation/live claim: {forbidden}")

need(re.search(r"0x[a-fA-F0-9]{40}", cannabis) is None, "PB-0.14 must not assign an on-chain address")
need("420/service/puff" not in cannabis.lower(), "PB-0.14 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.14 qualification evidence",
    "**PB-0.14 — Cannabis taxonomy**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-CANNABIS-001 through PB-CANNABIS-040",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.15 — Visibility model**",
]:
    need(token in evidence_14, f"PB-0.14 evidence record missing token: {token}")

# PB-0.15 — visibility model
for token in [
    "# PuffBuddies PB-0.15 visibility model",
    "## Visibility principles",
    "## Canonical visibility invariants",
    "## Canonical field audience rules",
    "## Visibility interaction invariants",
    "## Field-classification decision rule",
    "## PB-0.15 completion boundary",
    "PRIVATE_SELF audience",
    "DISCOVERABLE audience",
    "MATCHED audience",
    "PARTICIPANT_ONLY audience",
    "MODERATOR_ONLY audience",
    "SERVICE_MINIMUM audience",
    "AGGREGATE_ONLY audience",
    "PUBLIC_EXPLICIT audience",
    "NEVER_PUBLIC audience",
    "Default deny for undefined audience",
    "Membership is not publicly enumerable",
    "Core profile presentation may be DISCOVERABLE",
    "Discovery preferences are PRIVATE_SELF",
    "Cannabis use/preferences are private by default",
    "Precise location is NEVER_PUBLIC",
    "Coarse location may be DISCOVERABLE",
    "Likes and passes are private intent",
    "Match state is PARTICIPANT_ONLY",
    "Blocks are PRIVATE_SELF / MODERATOR_ONLY",
    "Reports and moderation evidence are MODERATOR_ONLY",
    "Messages are PARTICIPANT_ONLY",
    "Eligibility source evidence is NEVER_PUBLIC",
    "Eligibility conclusion is SERVICE_MINIMUM",
    "Wallet/account linkage is NEVER_PUBLIC by default",
    "Payment details are not profile visibility",
    "Lifecycle state is private",
    "Safety status is not a public badge",
    "Internal ranking scores are NEVER_PUBLIC",
    "Session/security data is NEVER_PUBLIC",
    "Audit evidence is protected",
    "Block revokes discovery/matched visibility",
    "Lifecycle revocation removes ordinary visibility",
    "Unmatch revokes MATCHED-only fields",
    "Deletion removes active visibility",
    "Visibility changes invalidate stale copies",
    "Client hiding is not authorization",
    "Notification surfaces receive minimum presentation data",
    "Search/Explorer cannot turn DISCOVERABLE into public",
    "Economic state cannot buy visibility into another user",
    "Visibility changes must be auditable without publishing them",
]:
    need(token in visibility, f"PB-0.15 visibility document missing token: {token}")

vis_ids = re.findall(r"^### (PB-VIS-\d{3})\b", visibility, flags=re.MULTILINE)
need(vis_ids == [f"PB-VIS-{i:03d}" for i in range(1, 41)], f"PB-VIS sequence drift: {vis_ids}")
need(len(vis_ids) == len(set(vis_ids)), "duplicate PB-VIS identifier")

for guarantee in [
    "DISCOVERABLE does not imply unauthenticated, public, Search, Explorer, wallet, or chain visibility",
    "A prior match, stale cache, or archived conversation does not preserve MATCHED visibility after canonical revocation",
    "PUBLIC_EXPLICIT does not authorize public disclosure of fields classified NEVER_PUBLIC",
    "A PuffBuddies field without an explicit visibility classification must not be exposed",
    "The match graph is NEVER_PUBLIC",
    "The blocked person must not receive private block metadata beyond the minimum behavior necessary to enforce the deny state",
    "Backend/service authorization must prevent unauthorized field disclosure",
    "must not ingest or expose private PuffBuddies DISCOVERABLE/MATCHED data merely because it is visible inside the app",
    "cannot unlock PRIVATE_SELF, MATCHED, PARTICIPANT_ONLY, MODERATOR_ONLY, or NEVER_PUBLIC fields belonging to another user",
]:
    need(guarantee in visibility, f"PB-0.15 missing visibility guarantee: {guarantee}")

for decision in [
    "canonical field name",
    "canonical owner",
    "default audience",
    "allowed audience transitions",
    "who may change visibility",
    "discovery/match/participant implications",
    "block/safety/lifecycle/deletion overrides",
    "service-minimum disclosure needs",
    "public-enumeration risk",
    "inference/correlation risk",
    "retention/deletion behavior",
    "stale-cache invalidation behavior",
    "audit requirements",
]:
    need(decision in visibility, f"PB-0.15 field-classification rule missing: {decision}")

for forbidden in [
    "PuffBuddies ACL engine is implemented",
    "PuffBuddies visibility API is deployed",
    "PuffBuddies profile schema is live",
    "PuffBuddies visibility service ID is",
]:
    need(forbidden not in visibility, f"PB-0.15 unsupported implementation/live claim: {forbidden}")

need(re.search(r"0x[a-fA-F0-9]{40}", visibility) is None, "PB-0.15 must not assign an on-chain address")
need("420/service/puff" not in visibility.lower(), "PB-0.15 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.15 qualification evidence",
    "**PB-0.15 — Visibility model**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-VIS-001 through PB-VIS-040",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.16 — Non-goals reconciliation**",
]:
    need(token in evidence_15, f"PB-0.15 evidence record missing token: {token}")

# PB-0.16 — non-goals reconciliation
for token in [
    "# PuffBuddies PB-0.16 non-goals reconciliation",
    "## Reconciliation principles",
    "## Canonical reconciled non-goals",
    "## Deferred but not prohibited",
    "## Reconciliation matrix",
    "## Non-goal change-control rule",
    "## PB-0.16 completion boundary",
    "No public relationship graph",
    "No public cannabis-use registry",
    "No public sexual/romantic preference registry",
    "No wallet-to-dating-profile public directory",
    "No everything-on-chain dating system",
    "No NFT/tokenized dating identity",
    "No purchased consent",
    "No pay-to-message unmatched strangers",
    "No paid block bypass",
    "No administrator-manufactured mutual consent",
    "No algorithm/AI-manufactured consent",
    "No escrow marketplace for dates",
    "No cannabis marketplace entitlement",
    "No gambling/wagering/prediction dating product",
    "No wallet-wealth dating ranking",
    "No public social-credit/desirability score",
    "No moderation-derived public reputation",
    "No public precise-location discovery",
    "No public-member search engine",
    "No public match-history/profile archive",
    "No sale of protected visibility",
    "No premium safety/consent bypass",
    "No hidden inferred sensitive profile as a product goal",
    "No public lifecycle/suspension/ban registry",
    "No public safety/report registry",
    "No replacement for emergency/law-enforcement/crisis services",
    "No medical cannabis authority",
    "No legal cannabis authority",
    "No impairment determination from cannabis profile",
    "No minor participation",
    "No identity-provider takeover of PuffBuddies consent",
    "No Messenger takeover of dating authority",
    "No payment-system takeover of relationship authority",
    "No Registry/AppStore authority expansion",
    "No derived-service authority promotion",
    "No privacy downgrade through hashing/commitments",
    "No deletion theater",
    "No stale-state resurrection",
    "No client-only privacy/security boundary",
    "No implied implementation from PB-0 documentation",
]:
    need(token in nongoals, f"PB-0.16 non-goals document missing token: {token}")

nongoal_ids = re.findall(r"^### (PB-NONGOAL-\d{3})\b", nongoals, flags=re.MULTILINE)
need(nongoal_ids == [f"PB-NONGOAL-{i:03d}" for i in range(1, 41)], f"PB-NONGOAL sequence drift: {nongoal_ids}")
need(len(nongoal_ids) == len(set(nongoal_ids)), "duplicate PB-NONGOAL identifier")

for guarantee in [
    "A deferred feature is not automatically a prohibited non-goal",
    "A prohibited non-goal cannot be reintroduced merely by renaming it as premium, experimental, AI-assisted, tokenized, administrative, or cross-app functionality",
    "Economic, blockchain, moderation, identity, or ranking systems cannot manufacture interpersonal authority that PuffBuddies does not canonically own",
    "A deferred feature becoming later in-scope requires an explicit canonical roadmap/architecture definition",
    "Silent erosion of a non-goal through implementation is not canonical",
]:
    need(guarantee in nongoals, f"PB-0.16 missing reconciliation guarantee: {guarantee}")

for change_req in [
    "which PB-NONGOAL invariant is affected",
    "which earlier PB-0 invariant(s) are affected",
    "why the behavior is necessary",
    "privacy, consent, safety, lifecycle, deletion, and authority consequences",
    "whether the proposal changes product identity",
    "whether the change requires a canonical roadmap revision",
    "new adversarial/negative tests",
    "migration/compatibility implications",
    "whether public-chain or public-index exposure changes",
    "whether the proposal introduces economic influence over another user's rights",
]:
    need(change_req in nongoals, f"PB-0.16 change-control rule missing: {change_req}")

for forbidden in [
    "PuffBuddies non-goal runtime is implemented",
    "PuffBuddies non-goal service is deployed",
    "PuffBuddies non-goal contract is live",
    "PuffBuddies non-goal service ID is",
]:
    need(forbidden not in nongoals, f"PB-0.16 unsupported implementation/live claim: {forbidden}")

need(re.search(r"0x[a-fA-F0-9]{40}", nongoals) is None, "PB-0.16 must not assign an on-chain address")
need("420/service/puff" not in nongoals.lower(), "PB-0.16 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.16 qualification evidence",
    "**PB-0.16 — Non-goals reconciliation**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-NONGOAL-001 through PB-NONGOAL-040",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.17 — Repository structure**",
]:
    need(token in evidence_16, f"PB-0.16 evidence record missing token: {token}")

# PB-0.17 — repository structure
for token in [
    "# PuffBuddies PB-0.17 repository structure",
    "## Canonical layout",
    "## Dependency direction",
    "## Canonical structure invariants",
    "## Source-control rules",
    "## Structure change-control rule",
    "## PB-0.17 completion boundary",
    "puffbuddies/web/",
    "puffbuddies/api/",
    "puffbuddies/domain/",
    "puffbuddies/storage/",
    "puffbuddies/integrations/",
    "puffbuddies/workers/",
    "puffbuddies/tests/",
    "contracts/src/puffbuddies/",
    "Reserved does not mean implemented",
    "No parallel deployment authority",
]:
    need(token in structure, f"PB-0.17 repository-structure document missing token: {token}")

struct_ids = re.findall(r"^### (PB-STRUCT-\d{3})\b", structure, flags=re.MULTILINE)
need(struct_ids == [f"PB-STRUCT-{i:03d}" for i in range(1, 21)], f"PB-STRUCT sequence drift: {struct_ids}")
need(len(struct_ids) == len(set(struct_ids)), "duplicate PB-STRUCT identifier")

for guarantee in [
    "browser/client state is not canonical security or relationship authority",
    "cannot expand a dependency's canonical authority",
    "No repository area may create a shadow canonical owner",
    "Credentials, signing material, production secrets",
    "A path named in PB-0.17 is a reserved architecture location only",
    "A directory move or adapter split cannot silently transfer canonical authority",
]:
    need(guarantee in structure, f"PB-0.17 missing structure guarantee: {guarantee}")

for forbidden in [
    "PuffBuddies web client is implemented",
    "PuffBuddies API is deployed",
    "PuffBuddies database is live",
    "PuffBuddies contract is deployed",
    "PuffBuddies service ID is",
]:
    need(forbidden not in structure, f"PB-0.17 unsupported implementation/live claim: {forbidden}")

need(re.search(r"0x[a-fA-F0-9]{40}", structure) is None, "PB-0.17 must not assign an on-chain address")
need("420/service/puff" not in structure.lower(), "PB-0.17 must not invent a PuffBuddies service ID")

for token in [
    "# PB-0.17 qualification evidence",
    "**PB-0.17 — Repository structure**",
    "**Level 1 — per-roadmap-step fast qualification**",
    "PB-STRUCT-001 through PB-STRUCT-020",
    "PuffBuddies PB-0 Qualification",
    "## Milestone status",
    "## Intentionally deferred checks",
    "**PB-0.18 — Documentation/invariant tests**",
]:
    need(token in evidence_17, f"PB-0.17 evidence record missing token: {token}")

# PB-0.18 — documentation/invariant tests
for token in ["# PuffBuddies PB-0.18 documentation/invariant tests","## Canonical test inventory","## Canonical documentation/invariant-test invariants","## Cross-step invariant matrix","## Adversarial mutation contract","## PB-0.18 completion boundary"]:
    need(token in docinv, f"PB-0.18 document missing token: {token}")
docinv_ids=re.findall(r"^### (PB-DOCINV-\d{3})\b",docinv,flags=re.MULTILINE)
need(docinv_ids==[f"PB-DOCINV-{i:03d}" for i in range(1,21)],f"PB-DOCINV sequence drift: {docinv_ids}")
families=[identity_ids,mvp_ids,scope_ids,boundary_ids,privacy_ids,consent_ids,elig_ids,threat_ids,dep_ids,state_ids,safety_ids,data_ids,life_ids,match_ids,cannabis_ids,vis_ids,nongoal_ids,struct_ids,docinv_ids]
all_ids=[x for family in families for x in family]
need(len(all_ids)==len(set(all_ids)),"PB-0 invariant identifiers are not globally unique")
for step in range(1,18):
    pos=road.find(f"### PB-0.{step} —")
    need(pos>=0,f"roadmap missing PB-0.{step}")
    if pos>=0:
        line=road[pos:road.find("\n",pos)]
        need("— COMPLETE" in line,f"roadmap completion continuity broken at PB-0.{step}")
records=[evidence_01,evidence_02,evidence_03,evidence_04,evidence_05,evidence_06,evidence_07,evidence_08,evidence_09,evidence_10,evidence_11,evidence_12,evidence_13,evidence_14,evidence_15,evidence_16,evidence_17]
for step,record in enumerate(records,1):
    need(f"**PB-0.{step} —" in record,f"PB-0.{step} evidence does not identify its step")
    need("COMPLETE" in record,f"PB-0.{step} evidence does not record COMPLETE")
cross=[
("adult identity","adult dating and social discovery" in app),
("modes",all(x in app for x in ("Dating","Buddy","Both"))),
("wallet unlinkability","wallet ownership or wallet address alone must not publicly reveal" in app),
("mutual messaging","ordinary private dating/social communication requires reciprocal authorized interest" in consent),
("block supremacy","blocking overrides prior relationship or payment state" in consent),
("private offchain","Sensitive dating, relationship, preference, location, safety, and communication state remains private/off-chain" in boundary),
("discoverable not public","DISCOVERABLE does not imply unauthenticated, public, Search, Explorer, wallet, or chain visibility" in visibility),
("client hiding","PB-VIS-036 — Client hiding is not authorization" in visibility),
("single owner","one canonical authority owner" in state.lower()),
("deactivation deletion","Deactivation and deletion are distinct actions" in data),
("one sided like","one-sided like" in matching.lower() and "messaging consent" in matching.lower()),
("stale resurrection","No stale-state resurrection" in nongoals),
("reserved path","A path named in PB-0.17 is a reserved architecture location only" in structure),
]
for name,ok in cross: need(ok,f"PB-0.18 cross-step invariant failed: {name}")
canonical=[app,scope,boundary,privacy,consent,elig,threat,deps,state,safety,data,life,matching,cannabis,visibility,nongoals,structure,docinv]
for i,value in enumerate(canonical,1):
    need(re.search(r"0x[a-fA-F0-9]{40}",value) is None,f"PB-0.18 canonical document {i} assigns address")
    need("420/service/puff" not in value.lower(),f"PB-0.18 canonical document {i} invents service ID")
for token in ["# PB-0.18 qualification evidence","**PB-0.18 — Documentation/invariant tests**","**Level 1 — per-roadmap-step fast qualification**","PB-DOCINV-001 through PB-DOCINV-020","PuffBuddies PB-0 Qualification","## Security/adversarial/invariant results","## Intentionally deferred checks","**PB-0.19 — Master implementation roadmap**"]:
    need(token in evidence_18,f"PB-0.18 evidence missing token: {token}")

if errors:
    print(json.dumps({"pass": False, "step": "PB-0.18", "errors": errors}, indent=2))
    raise SystemExit(1)

print(json.dumps({
    "pass": True,
    "step": "PB-0.18",
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
    "pb03": {
        "boundaryInvariants": boundary_ids,
        "publicChainZonesDefined": True,
        "privateDatingStateOffChain": True,
        "encryptedMessagingOffChain": True,
        "minimumDisclosureAttestations": True,
        "walletProfileUnlinkability": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    },
    "pb04": {
        "privacyInvariants": privacy_ids,
        "minimumDisclosure": True,
        "relationshipConfidentiality": True,
        "walletProfileUnlinkability": True,
        "deletionIndependence": True,
        "metadataProtected": True,
        "leastPrivilege": True,
        "inferenceThreatsCovered": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    },
    "pb05": {
        "consentInvariants": consent_ids,
        "mutualMatchRequired": True,
        "unmatchUnilateral": True,
        "blockSupremacy": True,
        "revocable": True,
        "noPurchasedAccess": True,
        "noAdministrativeFabrication": True,
        "staleAuthorizationFailsClosed": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    },
    "pb06": {
        "eligibilityInvariants": elig_ids,
        "adultFloor": 18,
        "unknownFailsClosed": True,
        "minimumDisclosure": True,
        "revocationAndReverification": True,
        "jurisdictionCanOnlyTighten": True,
        "noEconomicBypass": True,
        "noAdminFabrication": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    },
    "pb07": {
        "threatInvariants": threat_ids,
        "actorsDefined": True,
        "trustBoundariesDefined": True,
        "abuseCasesDefined": True,
        "authorityOwnersRequired": True,
        "failClosed": True,
        "capabilityLimitedDependencies": True,
        "residualRiskRuleDefined": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    },
    "pb08": {
        "dependencyInvariants": dep_ids,
        "walletBounded": True,
        "identityBounded": True,
        "namesBounded": True,
        "messengerConsentExternal": True,
        "notificationsNonCanonical": True,
        "payCannotPurchaseConsent": True,
        "registryDiscoveryOnly": True,
        "appStoreNonCanonical": True,
        "analyticsNonCanonical": True,
        "derivedServicesSubordinate": True,
        "noAuthorityInheritance": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    },
    "pb09": {
        "stateInvariants": state_ids,
        "singleCanonicalOwnerPerClass": True,
        "derivedCopiesNonCanonical": True,
        "eligibilityEvidenceSeparatedFromDecision": True,
        "paymentSeparatedFromEntitlement": True,
        "messengerSeparatedFromRelationshipAuthority": True,
        "conflictsResolveToCanonical": True,
        "staleCopiesFailClosed": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    },
    "pb10": {
        "safetyInvariants": safety_ids,
        "reportClassesDefined": True,
        "moderationStatesDefined": True,
        "blockIndependent": True,
        "reportBlockSeparated": True,
        "reportCountNotGuilt": True,
        "noPurchasedSafetyException": True,
        "noManufacturedConsent": True,
        "privateModerationState": True,
        "leastPrivilege": True,
        "staleAuthorizationFailsClosed": True,
        "escalationBoundariesDefined": True,
        "appealsDoNotRestoreConsent": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    },
    "pb11": {
        "dataInvariants": data_ids,
        "deactivationDistinctFromDeletion": True,
        "deletionRevokesParticipationImmediately": True,
        "retentionPurposeBounded": True,
        "backupsBounded": True,
        "restoreReappliesDeletion": True,
        "derivedCopiesFollowLifecycle": True,
        "moderationRetentionNarrow": True,
        "dependenciesRemainIndependent": True,
        "immutableChainLimitationExplicit": True,
        "honestDeletionCompletion": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    },
    "pb12": {
        "lifecycleInvariants": life_ids,
        "statesDefined": True,
        "transitionsDefined": True,
        "eligibilityGatesActivation": True,
        "deactivationRevokesParticipation": True,
        "safetyOverridesParticipation": True,
        "appealDoesNotRestoreAccess": True,
        "postDeletionRequiresNewRegistration": True,
        "dependenciesDoNotOwnLifecycle": True,
        "staleAuthorizationInvalidated": True,
        "unknownLifecycleFailsClosed": True,
        "privateAndAuditable": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    },
    "pb13": {
        "matchingInvariants": match_ids,
        "allowedInputsDefined": True,
        "hardExclusionsDefined": True,
        "rankingNonCanonical": True,
        "staleRankingRevoked": True,
        "sensitiveInferenceMinimized": True,
        "economicInfluenceCannotCreateConsent": True,
        "oneSidedLikeNotMessagingConsent": True,
        "mutualMatchRequiresReciprocalIntent": True,
        "adminAlgorithmCannotFabricateConsent": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    },
    "pb14": {
        "cannabisInvariants": cannabis_ids,
        "nonUseFirstClass": True,
        "preferNotToSaySupported": True,
        "privateByDefault": True,
        "notPublicIdentity": True,
        "notTokenizedIdentity": True,
        "notMedicalLegalImpairmentProof": True,
        "noMarketplaceEntitlement": True,
        "noCoercion": True,
        "matchingConsentBoundariesPreserved": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    },
    "pb15": {
        "visibilityInvariants": vis_ids,
        "audiencesDefined": True,
        "discoverableNotPublic": True,
        "fieldAudiencesDefined": True,
        "staleVisibilityRevoked": True,
        "clientHidingNotAuthorization": True,
        "searchExplorerCannotPromote": True,
        "economicStateCannotBuyVisibility": True,
        "privateAndAuditable": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    },
    "pb16": {
        "nonGoalInvariants": nongoal_ids,
        "reconcilesPb01ThroughPb15": True,
        "deferredSeparatedFromProhibited": True,
        "economicAdminAlgorithmicBypassProhibited": True,
        "dependencyAuthorityPreserved": True,
        "deletionHonestyPreserved": True,
        "staleStateResurrectionProhibited": True,
        "changeControlDefined": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    },
    "pb17": {
        "structureInvariants": struct_ids,
        "reservedPathsNotImplementation": True,
        "inwardDependencyDirection": True,
        "singleCanonicalOwner": True,
        "sourceControlRulesDefined": True,
        "revocationCrossesBoundaries": True,
        "changeControlDefined": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    },,
    "pb18": {
        "documentationInvariantIds": docinv_ids,
        "globalInvariantIdsUnique": True,
        "roadmapContinuityThroughPb017": True,
        "evidenceContinuityThroughPb017": True,
        "crossStepInvariantsChecked": True,
        "adversarialMutationHarnessRequired": True,
        "assignsFixedAddress": False,
        "inventsServiceId": False,
        "claimsImplementation": False,
    }
}, indent=2))
