# SOC-5D — Durable recovery and canonical reorganization acceptance

## Scope
Recovery requires the player-signed EIP-1559 bytes already persisted under SOC-5B.
The backend never generates or replaces a player's signing key. Recovery validates
the bytes through the same canonical chain adapter before any RPC broadcast.

## State transitions
- `prepared`: signed bytes committed; receipt not yet observed.
- `broadcast`: exact signed hash available at RPC, pending canonical finality.
- `finalized`: verified receipt, canonical block anchoring and matching signer/action/hash.
- `failed`: verified finalized execution failure; never considered completed.
- `orphaned`: formerly finalized receipt no longer verifiable, or hash anchored to a different block. Quarantined until operator-reviewed repair; no automatic restoration.

Recovery is bounded, retried for PostgreSQL serialization and deadlock conflicts,
and uses transaction-scoped row locks. It records every transition/observation in
`highcountry_social_recovery_audit`. A single operation is keyed by
`(scope,tx_hash)`. Unknown RPC errors fail closed rather than fabricating a failure.

## Reorganization defense
Orphaned events are retained with `canonical=false` and excluded from private
history. The owning operation is marked `orphaned`; no treasury settlement is
inferred from social permission or membership events.

## Level 2 verification
`highcountry-soc-5d.yml` pins PR SHA and runs against PostgreSQL 16, with
serialized database-row recovery races, process-object restart, tampered journal,
real signed local Anvil transaction replay and `evm_revert` reorganization.
SOC-5B and SOC-5C retained workflows must stay green. Testnet acceptance,
real-world node restart, operator-reviewed orphan repair and full R04 contract
deployment evidence remain explicit separate gates.

## Deployment procedure
Apply migrations 007–011 in numeric order with owner-level migration authority.
Provision a dedicated fixed-scope non-superuser, non-BYPASSRLS runtime role.
The runtime performs one reconciliation before accepting HTTP traffic, then
bounded periodic checks. Monitor nonzero `orphaned`, `failed`, and `rejected`
audits; operators must investigate before any repair or release.
