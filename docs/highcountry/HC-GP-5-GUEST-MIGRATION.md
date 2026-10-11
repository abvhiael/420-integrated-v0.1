# HC-GP.5 — Guest / Registered Migration Boundary

High Country guest and conventional registered saves remain off-chain. The chain stores commitments and replay protection only.

See [R01.4 migration boundaries](MIGRATION-BOUNDARIES.md) for consent, source verification, the separate object-manifest flow and production recovery requirements.

## Flow

1. Guest play creates an off-chain save.
2. The service computes `guestStateCommitment = keccak256(domain, guestAccountCommitment, saveRevision, stateHash)`.
3. When the player later links a wallet, the service builds a canonical migration payload and computes `migrationPayloadHash = keccak256(domain, guestStateCommitment, growerProfileId, schemaVersion, payloadBodyHash)`.
4. The High Country operator issues a shared `GameClaims420` claim targeted to the wallet.
5. The player consumes the claim directly. The service never consumes it for the player.
6. `HighCountryGamingBridge420.bindConsumedMigrationClaim(...)` binds the consumed claim to the canonical grower profile.
7. The off-chain service validates the exact payload against the two commitments, applies the save, then calls `HighCountryMigration420.markApplied(...)`.
8. `markApplied` records a single replay-safe receipt keyed by claim ID.

## Privacy and storage boundary

Never place raw guest saves, account credentials, cloud-save payloads, device identifiers, email addresses, or conventional account IDs on-chain. Only commitments, the shared claim, grower-profile binding and final application receipt are canonical chain state.

## Failure rules

Migration fails closed when the claim is unconsumed, cancelled, from another game, bound to another grower, hash-mismatched, already applied, or when the applying service lacks the High Country migration capability.

The receipt is at-most-once: a second markApplied call reverts. A worker must reconcile an existing matching finalized receipt rather than treating a duplicate call as a successful idempotent response. Off-chain application needs its own durable idempotency.

## Operational qualification limitation

The one-time receipt constrains on-chain records only. The apply-save-then-markApplied sequence is not atomic across a database and the chain: crashes, concurrent workers and reorgs can cause duplicate or mismatched off-chain effects. Production integration requires a durable unique claim key, transactional save application/outbox, reconciliation and finality-aware retry behavior. The current shared Player/Profile Service is process-local and does not provide these guarantees. Zero grower IDs and zero commitments are rejected by the receipt verifier. See the repository audit before deployment.
