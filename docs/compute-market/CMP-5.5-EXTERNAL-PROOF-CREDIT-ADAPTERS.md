# CMP-5.5 — External proof/credit adapters

Status: **COMPLETE — LEVEL 1 + SECOND CMP-5 LEVEL 2 EXACT-HEAD QUALIFIED ON `41b3f7e9c84226c8b294f2b7a5af730c928ece61`.**

Canonical roadmap step: **CMP-5.5 — External proof/credit adapters**.

## Purpose

CMP-5.5 adds the shared normalization layer that lets already-supported external compute families attach provider-specific proof and credit records to an exact external contribution identity.

It does **not** decide whether an external issuer is trustworthy, whether a proof is true, whether credit is economically redeemable, or whether the same work has already been rewarded.

## External source binding

Every proof or credit record binds:

- external adapter kind;
- external system identity;
- external contribution identity.

The resulting source binding is domain-separated, so the same contribution commitment presented under Folding-at-home, BOINC, research-cluster or university/HPC identities cannot collide.

## Proof records

Proof normalization binds:

- exact external source;
- proof scheme commitment;
- issuer identity commitment;
- proof commitment;
- observation timestamp;
- optional expiry timestamp;
- evidence commitment.

The stable proof identifier excludes observation/expiry/evidence metadata, while the full record commitment binds them. Expiry `0` explicitly means non-expiring; any nonzero expiry before observation fails closed.

## Credit records

Credit normalization binds:

- exact external source;
- credit scheme commitment;
- issuer identity commitment;
- credit unit commitment;
- positive credit amount;
- observation timestamp;
- evidence commitment.

The stable credit identifier binds source/scheme/issuer/unit; the full record commitment additionally binds amount/time/evidence.

## Authority boundaries

CMP-5.5 does not:

- validate issuer credentials;
- query an external provider;
- verify a proof cryptographically or scientifically;
- assert external truth;
- create canonical verifier state;
- create reward entitlement;
- reserve, release, settle or refund Vault value;
- slash stake;
- prevent duplicate rewards;
- create an authoritative external issuer registry.

CMP-5.6 owns **double-reward prevention**.  
CMP-5.7 owns **external-result attestation**.  
CMP-6 owns useful-computation reward economics.

## Qualification milestone

CMP-5.5 is Level 1 for its own implementation and the **second CMP-5 Level 2 milestone** because the previously separate adapter families now converge into one shared proof/credit normalization surface.

Required exact-head qualification includes the Compute Market build, dedicated proof/credit tests, four-family source-domain integration, retained Compute Solidity suite, verifier compilation, retained CMP-5.1 through CMP-5.4 verifiers, and the CMP-5.5 mechanical verifier.

Repository-wide Level 3 remains reserved for CMP-5.8.

## Exit criteria

All machine-readable CMP-5.5 exit criteria passed on exact implementation SHA `41b3f7e9c84226c8b294f2b7a5af730c928ece61`.

Durable evidence: [CMP-5.5 qualification](CMP-5.5-QUALIFICATION-EVIDENCE.md).

## Next canonical step

**CMP-5.6 — Double-reward prevention**
