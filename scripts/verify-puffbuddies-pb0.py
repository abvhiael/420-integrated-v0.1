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

errors = []

def need(condition, message):
    if not condition:
        errors.append(message)

for path in (APP, ROAD, EVIDENCE_01, SCOPE, EVIDENCE_02, BOUNDARY, EVIDENCE_03, PRIVACY, EVIDENCE_04, CONSENT, EVIDENCE_05, ELIG, EVIDENCE_06, THREAT, EVIDENCE_07):
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

if errors:
    print(json.dumps({"pass": False, "step": "PB-0.3", "errors": errors}, indent=2))
    raise SystemExit(1)

print(json.dumps({
    "pass": True,
    "step": "PB-0.7",
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
}, indent=2))
