# 420 Integrated Genesis Contract Interface Layer

This layer gives all genesis-resident contracts one shared vocabulary for component identity, canonical assets, governance authorization, pauses, health, oracle freshness, credentials, names, settlement health, fees, signing domains, accounting and semantic versions.

## Core rule
Resident dApps must not redefine lifecycle, health, governance class, finality or asset identity locally.

## Fail closed
Security-sensitive actions fail closed when a dependency is inactive, paused, stale, unhealthy, version-incompatible or code-hash-mismatched.

## Shared lifecycle
NONE → PROPOSED → ACTIVE → PAUSED/SUSPENDED → DEPRECATED/WITHDRAWAL_ONLY → RETIRED

## Shared health
UNKNOWN / HEALTHY / DEGRADED / UNHEALTHY / HALTED

## Governance
G1_ROUTINE / G2_PARAMETER / G3_SECURITY / G4_CONSTITUTIONAL

## Finality
INCLUDED / CERTIFIED / FINALIZED / HIGH_VALUE

## Versioning
Major versions may change semantics and require migration/review.
Minor versions are backward-compatible extensions.
Patch versions are non-semantic fixes.

Application signing remains under `420/APP/*` and never alters frozen consensus domains.

Next, adapt 420Pay to consume this layer, followed by 420Swap and 420Bridge, then add cross-dApp integration tests.


## Core security extensions

### Capabilities
Operational permissions are distinct from governance and ownership. Grants bind a principal,
component, capability identifier, scope hash, limits and validity window. This supports smart-account
session keys, delegated operators, merchant operators, oracle publishers, bridge verifiers and
treasury operators without granting unrestricted contract authority.

### Custody
Custody is standardized separately from accounting. A component may be able to account for value
without having authority to release it. Custody positions identify the asset, beneficiary, deposited,
committed, released and available amounts and the applicable release-condition commitment.

### Genesis initialization and migration
Genesis predeploys expose a genesis configuration hash and initialization status. This is necessary
because direct runtime-bytecode/storage predeployment does not execute Solidity constructors.

Migrations preserve historical implementation/version provenance. Updating a component's current
registry pointer never rewrites which implementation produced earlier payments, transfers, votes,
claims or accounting entries.

### System-wide safety
System safety uses NORMAL, DEGRADED, HALTED and RECOVERY. This is separate from local contract
pauses. Actions are classified NORMAL_ONLY, SAFE_WHEN_PAUSED, WITHDRAWAL_ONLY or RECOVERY_ONLY so
emergency controls do not automatically trap assets that can be safely withdrawn or refunded.

## Programmable smart accounts
Genesis Account Decision #1 requires EVM-compatible smart-contract accounts with protocol-supported
plumbing. The account layer uses the shared capability and safety interfaces rather than creating a
game- or payment-specific permission system. Final account-abstraction ABI details remain pending
compatibility review against the EVM account-abstraction standards in use at implementation freeze.

## Genesis Contract Interface Layer v1.0 freeze

Version 1.0 is frozen at the semantic level.

Additional v1.0 concepts:
- domain-separated signed envelopes and replay protection;
- canonical object identifiers;
- native-420 and canonical-asset capability rules;
- decimal scaling/rounding/dust policy;
- external dependency registry;
- oracle confidence/window/health semantics;
- risk-limit observability;
- metadata commitments;
- common audit-event context;
- application time semantics;
- canonical chain context.

ABI-compatible minor extensions remain possible. A semantic major change requires a new major
interface version plus migration/review. A change to a constitutional protocol invariant also
requires the corresponding G4 governance treatment.

Implementation order after this freeze:
420Pay → 420Swap → 420Bridge → remaining genesis suites, with cumulative integration testing.
