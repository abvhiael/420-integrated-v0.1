# CMP-5.7 — External-result attestation

Status: **COMPLETE — LEVEL 1 + FOURTH CMP-5 LEVEL 2 EXACT-HEAD QUALIFIED ON `e04d6baa0e636a361ef7dd8d046f5a31ff2f72d4`.**

Canonical roadmap step: **CMP-5.7 — External-result attestation**.

## Purpose

CMP-5.7 establishes the trusted external-result truth boundary that CMP-5.6 intentionally lacks.

It binds a normalized external source, one external result commitment, normalized proof and/or credit record commitments, and an auditable evidence envelope to one canonical external-work commitment.

The resulting canonical-work identity is the identity downstream reward logic must present to the CMP-5.6 one-time consumption guard.

## Trusted attesters

Governance explicitly manages trusted external-result attesters.

Only currently trusted attesters may publish new attestations. Trust withdrawal makes historical attestations unacceptable for new resolution while preserving the immutable record for audit.

An attester may revoke its own attestation; governance may revoke any attestation.

## Canonical-work mapping

Each attestation binds:

- CMP-5.5 normalized external source binding;
- external result commitment;
- proof record commitment and/or credit record commitment;
- canonical external-work commitment;
- attestation-scheme commitment;
- evidence commitment;
- observation and validity timestamps;
- attester identity.

Equivalent external source wrappers may intentionally map to the same canonical-work commitment. This is required so multiple representations of one real external computation converge before CMP-5.6 duplicate consumption.

However, once any of the following are bound, they cannot later be remapped to a conflicting canonical-work identity:

- external source binding;
- exact source/result identity;
- normalized proof/credit evidence binding.

Identical publication is idempotent and returns the same attestation identity.

## Evidence requirements

At least one normalized external proof or credit record commitment is mandatory.

CMP-5.7 does not itself parse or validate provider-specific proof semantics. CMP-5.5 owns normalization of those records; trusted external attesters are responsible for independently validating external evidence before publication.

## Validity and fail-closed behavior

Claims fail closed when:

- source binding is invalid;
- result commitment is zero;
- canonical-work commitment is zero;
- attestation-scheme commitment is zero;
- evidence commitment is zero;
- both normalized proof and credit commitments are absent;
- observation time is zero or in the future;
- validity begins before observation;
- expiry is not strictly after validity start;
- expiry is already reached;
- caller is not a trusted attester.

A published attestation is acceptable only while:

- it exists;
- it is not revoked;
- its attester remains trusted;
- current time is within its validity window;
- its source/result/evidence bindings still resolve to the recorded canonical work.

## Relationship to CMP-5.6

CMP-5.7 establishes the authoritative external-result -> canonical-work mapping.

CMP-5.6 remains the owner of one-time consumption. It does not re-attest truth and does not attempt to infer whether two external representations describe the same work.

The intended downstream sequence is:

1. normalize proof/credit evidence with CMP-5.5;
2. obtain trusted result attestation with CMP-5.7;
3. resolve the canonical external-work commitment;
4. consume that commitment exactly once with CMP-5.6;
5. apply reward economics later under CMP-6.

## Authority boundaries

CMP-5.7 owns only:

- trusted external-result attestation;
- canonical external-work mapping.

It does **not**:

- decide reward amount;
- decide final reward eligibility;
- mint or transfer assets;
- create/release Vault obligations;
- mutate or slash stake;
- validate provider-specific proof cryptography;
- issue external credit;
- consume duplicate-reward claims.

CMP-5.6 remains the duplicate-consumption authority.

CMP-6 remains the useful-computation reward-economics and payout authority.

## Qualification milestone

CMP-5.7 is Level 1 for its own implementation and the **fourth CMP-5 Level 2 milestone** because it introduces the authoritative shared truth mapping that all external reward integrations must consume.

Required exact-head qualification includes:

- Compute contract build;
- trusted/untrusted attester tests;
- governance authorization tests;
- source/result/evidence conflict tests;
- equivalent-wrapper convergence tests;
- replay/idempotency tests;
- revocation and trust-withdrawal tests;
- timing/boundary/fail-closed tests;
- retained Compute Solidity suite;
- verifier compilation;
- retained CMP-5.1 through CMP-5.6 verifiers;
- CMP-5.7 mechanical verifier.

Repository-wide Level 3 remains reserved for CMP-5.8.

## Exit criteria

All machine-readable CMP-5.7 exit criteria passed on exact implementation SHA `e04d6baa0e636a361ef7dd8d046f5a31ff2f72d4`.

Durable evidence: [CMP-5.7 qualification](CMP-5.7-QUALIFICATION-EVIDENCE.md).

## Limitations

On-chain code cannot independently discover whether two unrelated provider/source identities describe the same real-world computation. That judgment is explicitly the responsibility of trusted attesters. The contract makes their mapping immutable, auditable, revocable, time-bounded, and conflict-detecting.

Live attester onboarding, deployment, ProtocolRegistry publication, and provider-specific validation services remain deployment/testnet work.

## Next canonical step

**CMP-5.8 — Phase closeout**
