# 420Media — Identity, Rights and ownership/provenance integration

Roadmap step: **MEDIA-AUDIT-6 — Identity, Rights and ownership/provenance integration**

## Purpose

420Media must not become an Identity or Rights authority.

This step binds Media creator/controller actions to the canonical wallet/Identity boundary and binds rights-bearing publication/reuse to live canonical 420Rights state.

The integration preserves the repository's established semantics:

- wallet control is the base actor authority;
- 420Identity profiles are optional and pseudonymous;
- supplying a profile adds a canonical ownership check rather than becoming mandatory account identity;
- 420Rights records claims, licenses and provenance commitments but does not adjudicate external legal truth;
- Media never creates, supersedes, transfers, revokes or fabricates Identity/Rights state.

## Canonical dependencies

### 420Identity

Canonical authority: `Identity420`.

Media reads the canonical `profiles(profileId)` mapping through the existing Media JSON-RPC abstraction.

When an actor supplies a nonzero profile ID, Media requires:

1. the profile exists as decodable canonical state;
2. the profile is active;
3. its canonical controller equals the actor wallet.

A zero profile ID means wallet-only pseudonymous operation and **does not trigger an Identity lookup**.

This preserves optional Identity semantics.

### Wallet authorization

Media never receives wallet keys or signing authority.

The actor is represented by an externally supplied wallet address. That wallet must still satisfy the underlying Media authority check:

- livestream controller actions remain bound to the canonical `MediaStreamRegistry420` controller;
- publication ownership checks remain bound to the current 420Rights claim holder;
- licensed reuse remains bound to the exact canonical licensee through `RightsRouter420.canUse`.

An optional Identity profile can narrow authorization but cannot widen wallet authority.

### 420Rights

Canonical reads:

- `RightsAssetRegistry420.subject(subjectId)`;
- `RightsClaimRegistry420.claim(rightId)`;
- `RightsRouter420.isRightEffective(rightId)`;
- `RightsRouter420.canUse(licenseId, actor, scopeHash)`.

Addresses and selectors are injected from qualified deployment/Registry configuration. This step does not invent fixed Rights addresses.

## Media actor model

```text
Actor
- wallet      required nonzero EVM address
- profile_id  optional bytes32
```

Wallet-only actors are valid.

When `profile_id != 0`, the canonical Identity profile must be active and wallet-controlled at authorization time.

Local Media data never becomes sufficient evidence of profile ownership.

## Rights binding

A Media rights binding contains:

```text
subject_id
provenance_hash
right_id
license_id   optional for holder publication; required for licensed reuse
scope_hash   required for licensed reuse
```

Media does not infer missing identifiers.

### Holder publication

For a rights-bearing public projection, Media requires:

1. actor authorization;
2. a nonzero Rights subject, provenance hash and right ID;
3. the canonical Rights subject provenance hash exactly matches the supplied provenance hash;
4. the canonical claim references the same subject;
5. the right is currently effective through `RightsRouter420`;
6. the current canonical right holder equals the actor wallet;
7. no license ID is supplied as a substitute for holder publication.

A local `visibility=PUBLIC` value alone is not publication authorization.

`CanProjectPublic` remains only a local state/visibility predicate. Actual publication/projection must use `AuthorizePublicProjection`.

### Licensed reuse / derivatives

For rights-bearing reuse, Media first preserves its existing local derivative integrity checks, then requires:

1. actor authorization;
2. exact canonical Rights subject/provenance match;
3. exact right-to-subject match;
4. currently effective right;
5. nonzero license ID and scope hash;
6. `RightsRouter420.canUse(licenseId, actor.wallet, scopeHash) == true`.

The current right holder need not equal the actor for licensed reuse.

A locally valid derivative relationship never substitutes for a canonical license.

## Livestream controller integration

The livestream service now exposes Identity-aware controller helpers:

- `CreateForActor`
- `StartForActor`
- `StopForActor`
- `StatusForActor`

These first apply optional Identity profile authorization and then execute the already-qualified wallet/controller flow.

The original wallet-only flows remain valid and represent the canonical pseudonymous path.

A profile cannot authorize a wallet that is not the canonical stream controller.

## Failure semantics

All authority dependencies fail closed.

Media does not fall back to local state when:

- Identity RPC fails;
- the supplied profile is inactive;
- profile controller differs from wallet;
- Rights subject/claim data is malformed;
- canonical provenance differs;
- right subject differs;
- right is ineffective;
- publication wallet is not the current holder;
- license use is denied;
- Rights RPC fails.

No failed external authority check mutates canonical Identity or Rights state.

## Security invariants

- **MEDIA-AUTH-INV-001:** optional Identity means zero profile is permitted; supplied profile must be active and wallet-controlled.
- **MEDIA-AUTH-INV-002:** Identity context can only narrow authorization; it cannot confer wallet/controller authority.
- **MEDIA-AUTH-INV-003:** Media never stores or exercises wallet signing keys.
- **MEDIA-AUTH-INV-004:** local Media ownership/provenance strings are non-authoritative.
- **MEDIA-AUTH-INV-005:** holder publication requires an exact live Rights subject/provenance/right/holder match.
- **MEDIA-AUTH-INV-006:** licensed reuse requires exact live `canUse` authorization for actor and scope.
- **MEDIA-AUTH-INV-007:** ineffective/superseded/expired rights fail closed through the canonical Rights router.
- **MEDIA-AUTH-INV-008:** a valid derivative relationship cannot bypass Rights licensing.
- **MEDIA-AUTH-INV-009:** public visibility cannot bypass Rights publication authorization.
- **MEDIA-AUTH-INV-010:** RPC/malformed dependency state never falls back to cached/local authority.
- **MEDIA-AUTH-INV-011:** Media cannot create, transfer, supersede, license or revoke Rights state.
- **MEDIA-AUTH-INV-012:** 420Rights remains a claim/license protocol and is not represented by Media as external legal adjudication.

## Qualification level

MEDIA-AUDIT-6 is an ordinary roadmap step.

Required qualification is **Level 1 app-scoped fast qualification**.

The previous MEDIA-AUDIT-5 Level 2 milestone remains valid. This step does not create a new documented Level 2 boundary.

Level 3 repository-wide Solidity, Genesis/address-authority, global qualification and Docs reconciliation remain deferred to app-phase closeout.

## Deferred work

- public API request/signature schema and typed client — MEDIA-AUDIT-9;
- frontend Wallet profile selection/signing UX — MEDIA-AUDIT-10;
- broader content-rights abuse/moderation closeout — MEDIA-AUDIT-11;
- live Identity/Rights deployment/address/Registry evidence — MEDIA-AUDIT-12/13.

Repository qualification proves the integration semantics and canonical read boundaries; it does not fabricate live testnet deployment evidence.
