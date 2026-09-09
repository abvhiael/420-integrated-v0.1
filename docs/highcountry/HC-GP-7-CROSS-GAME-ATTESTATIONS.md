# HC-GP.7 — Scoped Cross-Game Attestations

High Country integrates with the shared `CrossGameRegistry420` using narrow, lookup-by-ID attestations only.

## Supported High Country subjects

- Global 420 Cup result
- breeder milestone
- strain discovery / provenance achievement
- seasonal achievement

No general activity feed, wallet-wide player history, cloud save, guest state, or canonical cross-game activity enumeration is introduced.

## Issuance

The canonical High Country game operator issues attestations directly through `CrossGameRegistry420`. The shared registry remains authoritative for operator authorization, expiry, and revocation.

`HighCountryCrossGame420` does not become a parallel operator or attestation registry. It provides:

- canonical subject identifiers,
- deterministic High Country attestation IDs,
- exact source-game/profile/subject/payload validation,
- fail-closed active/revocation checks,
- binding to the canonical High Country game profile for a grower.

## Privacy and interoperability

A receiving game needs only the attestation ID and the expected scoped subject. It does not need access to the player's High Country history. This allows achievements such as a Global 420 Cup championship or breeder milestone to unlock optional content elsewhere while preserving the 420 Gaming Protocol privacy rule.

## Invariants

1. Only explicitly supported High Country subject classes are considered canonical.
2. The attestation source must be the canonical High Country game ID.
3. The attestation profile must equal the grower's bound shared game profile.
4. Subject type, subject ID, and payload hash must all match exactly.
5. Expired or revoked attestations fail closed through `CrossGameRegistry420.isActive`.
6. No API enumerates all player activity across games.
