# PuffBuddies PB-0.6 adult eligibility policy

## Purpose

PB-0.6 defines the canonical eligibility contract for entering and remaining eligible to participate in PuffBuddies as an adult dating/social-discovery application.

This step establishes **what PuffBuddies needs to know**, **what it must not learn or expose unnecessarily**, **how eligibility can become invalid**, and **how later identity/attestation integration must behave**.

PB-0.6 does not implement 420Identity integration, choose a proof provider, deploy an attestation contract, assign an address, define a jurisdiction database, or claim live verification.

## Canonical baseline

The PuffBuddies baseline eligibility floor is **18 years of age or older**, subject to later jurisdiction-specific policy that may require a higher minimum or additional restrictions.

A jurisdiction-specific rule may make a person ineligible even if they are 18+.

A jurisdiction-specific rule must never lower the canonical PuffBuddies adult floor below 18.

## Eligibility interface

PuffBuddies should consume the minimum conclusion needed to authorize product participation.

Preferred conceptual interface:

```text
isEligibleForPuffBuddies(subject, policyContext) -> ELIGIBLE | INELIGIBLE | UNKNOWN
```

The canonical interface must **not** require PuffBuddies to retrieve or publicly expose raw date of birth, government identity documents, legal name, exact home address, or other source evidence merely to determine eligibility.

Where later architecture permits, the authoritative identity/attestation layer should answer the eligibility question rather than handing PuffBuddies the underlying evidence.

## Eligibility states

PB-0.6 defines three policy-level eligibility conclusions:

- **ELIGIBLE** — current authoritative evidence satisfies PuffBuddies adult/jurisdiction policy.
- **INELIGIBLE** — current authoritative evidence affirmatively fails PuffBuddies policy.
- **UNKNOWN** — PuffBuddies cannot establish current eligibility with sufficient authoritative evidence.

UNKNOWN must fail closed for ordinary PuffBuddies participation until eligibility is established.

These are policy conclusions, not the full later user-lifecycle state machine.

## Canonical eligibility invariants

### PB-ELIG-001 — Adult floor is 18

PuffBuddies requires users to be at least 18 years old.

Later jurisdiction-specific policy may require an older minimum or additional restrictions, but must not lower the floor below 18.

### PB-ELIG-002 — Eligibility is a conclusion, not raw identity data

PuffBuddies should consume an eligibility conclusion rather than raw date of birth or identity evidence whenever the canonical identity/attestation layer can provide that conclusion.

### PB-ELIG-003 — Date of birth remains private

Date of birth, identity-document images, government identifiers, and equivalent source evidence must not become public PuffBuddies state or ordinary profile data.

### PB-ELIG-004 — UNKNOWN fails closed

If authoritative eligibility cannot be established, ordinary PuffBuddies participation must not be granted.

Network failure, unavailable provider, missing attestation, unreadable evidence, expired proof, or ambiguous policy must not silently become ELIGIBLE.

### PB-ELIG-005 — Jurisdiction may tighten, not weaken, the adult floor

A jurisdiction-specific rule may raise the age threshold or impose other lawful participation restrictions.

It must not reduce the canonical PuffBuddies age floor below 18.

### PB-ELIG-006 — Eligibility is time-sensitive

Eligibility is not assumed permanent.

A proof or attestation may expire, be revoked, become stale, or cease to satisfy a changed jurisdiction/policy context.

### PB-ELIG-007 — Revocation removes ordinary participation authority

If authoritative eligibility is revoked or becomes affirmatively INELIGIBLE, ordinary PuffBuddies discovery, matching, and messaging participation must no longer be authorized.

Later lifecycle steps define exact transition mechanics and any narrow read-only/account-recovery behavior.

### PB-ELIG-008 — Suspension and ban override eligibility

An age/identity eligibility conclusion of ELIGIBLE does not override a PuffBuddies suspension, ban, block, deletion, deactivation, or other later-defined safety/lifecycle restriction.

Eligibility is necessary but not sufficient for full product participation.

### PB-ELIG-009 — Eligibility does not create consent

Being ELIGIBLE does not create a match, messaging right, discoverability right, visibility override, private-data right, or consent from another user.

PB-0.5 remains authoritative for interpersonal consent.

### PB-ELIG-010 — Eligibility does not imply public membership

An eligibility attestation or identity record must not provide a canonical public lookup proving that a wallet/person operates a PuffBuddies profile.

### PB-ELIG-011 — Minimal disclosure applies to jurisdiction

If jurisdiction affects eligibility, PuffBuddies should consume the minimum policy conclusion necessary.

Exact address or precise location must not be required or exposed when a coarser jurisdiction/policy assertion is sufficient.

### PB-ELIG-012 — Reverification is required when authoritative evidence is stale

Later implementation must support reverification when an eligibility credential expires, is revoked, changes issuer status, changes policy version, or otherwise becomes stale.

Stale evidence must not be treated as permanently valid.

### PB-ELIG-013 — Policy-version changes can require reevaluation

If the canonical eligibility policy changes, existing eligibility may require reevaluation.

A prior ELIGIBLE result under an older policy version must not automatically override a newer incompatible policy.

### PB-ELIG-014 — Issuer/provider failure is not eligibility

Failure of an identity provider, attestation service, RPC, registry, or verifier does not itself prove eligibility.

Fail-open behavior is prohibited for ordinary eligibility gating.

### PB-ELIG-015 — Self-assertion alone is insufficient where authoritative proof is required

A user-entered age or checkbox may be part of onboarding UX, but where canonical policy requires authoritative adult verification, self-assertion alone must not satisfy that requirement.

### PB-ELIG-016 — Economic state cannot establish age eligibility

Wallet balance, token holdings, payment history, NFT ownership, staking, subscription, premium tier, or reputation score must not substitute for adult eligibility evidence.

### PB-ELIG-017 — Moderators cannot manually fabricate eligibility

Moderators, support staff, administrators, or operators must not manually override authoritative INELIGIBLE/UNKNOWN state into ELIGIBLE merely for convenience or customer support.

A later exception/review process, if any, must obtain valid authoritative evidence rather than inventing eligibility.

### PB-ELIG-018 — Eligibility evidence access follows least privilege

Raw identity/eligibility evidence, where any system must process it, must be limited to the minimum authorized services/personnel and must preserve PB-0.4 privacy guarantees.

Ordinary PuffBuddies clients, unrelated services, analytics, Search, Explorer, and public APIs must not receive the source evidence.

### PB-ELIG-019 — Eligibility checks must be auditable without exposing identity evidence

Later implementation must record enough protected internal evidence to diagnose eligibility decisions, revocation, expiry, and policy-version behavior without publishing raw identity documents, birth data, or a public PuffBuddies membership graph.

### PB-ELIG-020 — Deletion of PuffBuddies does not delete canonical identity

Deleting a PuffBuddies profile must not require deletion of 420Identity or unrelated canonical identity evidence.

Conversely, deletion/revocation of required canonical identity authority may cause PuffBuddies eligibility to become UNKNOWN or INELIGIBLE.

## Dependency on canonical identity/attestation authority

PuffBuddies must not create a competing general-purpose identity system merely to prove adulthood.

Later PB-0.8/PB-2 work should bind PuffBuddies to the canonical 420Integrated identity/attestation authority, expected to be 420Identity or its approved successor/interface.

The later integration must define:

- authoritative issuer/verifier;
- subject binding;
- policy/version binding;
- expiration semantics;
- revocation semantics;
- replay resistance;
- jurisdiction-policy assertion;
- freshness requirements;
- failure behavior;
- privacy/minimum-disclosure behavior.

PB-0.6 defines these requirements but does not claim that interface is implemented today.

## Conceptual eligibility decision

A future implementation should behave conceptually like:

```text
if account is banned/suspended/deleted/deactivated:
    deny ordinary participation

result = identityAuthority.evaluatePuffBuddiesEligibility(
    subject,
    currentPolicyVersion,
    requiredJurisdictionContext
)

if result is not current, authentic, unrevoked, and policy-compatible:
    return UNKNOWN or INELIGIBLE

if result concludes eligible:
    return ELIGIBLE

return INELIGIBLE
```

The exact API, credential format, storage, and transport remain later implementation scope.

## Failure and adversarial cases

Later implementation/qualification must explicitly cover at least:

- user claims age 18+ but has no authoritative proof where proof is required;
- credential expired between login and protected action;
- credential revoked after an active match exists;
- issuer becomes unavailable;
- issuer key/authority changes;
- policy version changes after prior eligibility;
- jurisdiction threshold becomes more restrictive;
- stale cache still says ELIGIBLE after revocation;
- replay of another user's eligibility proof;
- subject-binding mismatch;
- premium/payment path attempts to bypass eligibility;
- moderator/support attempts manual eligibility override;
- identity evidence exists but PuffBuddies receives only UNKNOWN due to verification failure;
- user deletes required identity authority while PuffBuddies remains active;
- exact DOB/address accidentally appears in logs, analytics, or public metadata.

## Privacy boundary

PB-0.6 must be interpreted together with PB-0.3 and PB-0.4:

- raw identity evidence is private/off-chain application or identity-authority data;
- only the minimum eligibility conclusion may be exposed where necessary;
- public eligibility artifacts must not enumerate PuffBuddies membership;
- exact DOB and exact residence are not PuffBuddies profile attributes;
- eligibility logs and caches inherit the sensitivity of the decision/evidence they reference.

## PB-0.6 completion boundary

PB-0.6 is satisfied when the repository:

- establishes 18+ as the canonical floor;
- defines ELIGIBLE, INELIGIBLE, and UNKNOWN with UNKNOWN failing closed;
- records PB-ELIG-001 through PB-ELIG-020 exactly once and in sequence;
- defines minimum-disclosure eligibility consumption;
- defines expiration, revocation, staleness, reverification, and policy-version reevaluation;
- defines jurisdiction tightening without lowering the 18+ floor;
- makes eligibility necessary but not sufficient for participation;
- prohibits payment, tokens, admin convenience, or self-assertion from replacing authoritative proof where required;
- defines dependency requirements for canonical identity/attestation authority without implementing a duplicate identity system;
- defines failure/adversarial cases for later implementation testing;
- preserves PB-0.1 through PB-0.5;
- introduces no identity contract, fixed address, service ID, provider integration, deployment, or false live-verification claim.
