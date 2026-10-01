# NAMES-AUDIT-2 — Canonical dependency-model reconciliation

Status: **CANONICAL FOR 420Names AUDIT PHASE**

## Decision

The generic frozen interface inventory remains authoritative as the repository-wide catalogue of shared interfaces, but the previous `420Names` row in `contracts/config/interfaces/dependency-matrix.json` is **not normative as a requirement to implement every listed shared interface in Names420**.

For 420Names, the dependency matrix is now interpreted as a list of **normative direct runtime dependencies**. The canonical 420Names runtime dependency set is therefore:

- `GovernanceAuthority`

All other previously listed entries are classified explicitly in `contracts/config/interfaces/names-dependency-model.json`.

This decision does **not** weaken the global shared-interface freeze. It reconciles the app-specific matrix with the already-documented Names authority model and prevents unused shared interfaces from becoming ambient authority over user naming.

## Repository evidence

`Names420` imports `SystemAccess` and `I420System`. Its constructor binds a nonzero immutable `governanceTimelock` through `SystemAccess`. The contract does not call ProtocolRegistry, PauseRegistry, CapabilityRegistry, SystemSafety, GenesisInitialization, Migration, SignedEnvelope, ReplayProtection, ChainContext, or MetadataCommitment interfaces.

The protocol architecture defines 420Names as canonical only for name ownership, expiry, forward/reverse resolution, and optional profile/service references. It explicitly states that a Registry service reference does not grant service legitimacy and that consumers must validate canonical service state independently.

## Classification

| Dependency | Classification | Matrix action | Canonical interpretation |
| --- | --- | --- | --- |
| GovernanceAuthority | REQUIRED_DIRECT | RETAIN | Constructor-bound `SystemAccess.governanceTimelock`; does not grant governance ownership of names. |
| ProtocolRegistry | OPTIONAL_INTEGRATION | REMOVE_FROM_RUNTIME_MATRIX | `serviceId` is a reference only; consumers validate Registry independently. |
| PauseRegistry | NOT_APPLICABLE | REMOVE_FROM_RUNTIME_MATRIX | No custody/admin execution path requires pausing; adding it would broaden authority. |
| CapabilityRegistry | NOT_APPLICABLE | REMOVE_FROM_RUNTIME_MATRIX | Lifecycle writes are owner/pending-owner authorized; no delegated capability surface exists. |
| SystemSafety | NOT_APPLICABLE | REMOVE_FROM_RUNTIME_MATRIX | Name validity is record/expiry based; no canonical global safety gate is specified. |
| GenesisInitialization | REQUIRED_INDIRECT | REMOVE_FROM_RUNTIME_MATRIX | Required at predeploy/deployment layer; deterministic state generation is NAMES-AUDIT-6. |
| Migration | NOT_APPLICABLE_CURRENT_RUNTIME | REMOVE_FROM_RUNTIME_MATRIX | No proxy/migration entry point exists in Names420. |
| SignedEnvelope | NOT_APPLICABLE | REMOVE_FROM_RUNTIME_MATRIX | No relayed signed-command path exists. |
| ReplayProtection | LOCAL_MECHANISM | REMOVE_FROM_RUNTIME_MATRIX | Commitments are committer-bound, age-bounded, consumed, and active names reject overwrite. |
| ChainContext | CONSUMER_LAYER | REMOVE_FROM_RUNTIME_MATRIX | Wallet/client verifies chain identity; Names420 has no chain-bound signature execution. |
| MetadataCommitment | NOT_APPLICABLE | REMOVE_FROM_RUNTIME_MATRIX | Names420 does not own mutable metadata documents; profile/service IDs are external references. |

## Security rationale

Adding unused shared dependencies would create new failure modes and authority edges without a canonical Names requirement. In particular, local pause, capability, or system-safety gates could allow actors other than the name owner/pending owner to interfere with ordinary naming lifecycle operations.

This decision preserves these boundaries:

1. name lifecycle authority remains with owner/pending owner and expiry rules;
2. governance remains a constructor-bound system identity but has no current name mutation function;
3. Registry validation remains a consumer responsibility when `serviceId` is used;
4. Genesis initialization remains mandatory for deployment qualification without becoming a runtime interface dependency;
5. registration replay protection remains local to the commit/reveal state machine.

## Qualification

Level 1 qualification for this decision must prove:

- the 420Names matrix contains exactly `GovernanceAuthority`;
- every removed legacy dependency has an explicit classification;
- `Names420` still binds a nonzero governance timelock;
- zero governance authority is rejected;
- no removed dependency interface is imported into `Names420`;
- the Genesis interface inventory itself remains valid;
- retained Names lifecycle tests continue to pass.

Broader repository-wide interface/Docs/global reconciliation is deferred to Level 3 app-phase closeout unless a later Names step materially changes shared repository semantics.

## Follow-up

- **NAMES-AUDIT-3** hardens lifecycle invariants without altering this authority model.
- **NAMES-AUDIT-6** must implement deterministic Genesis state for the constructor-bound governance address and other storage without introducing a runtime `IGenesisInitializable420` dependency.
- **NAMES-AUDIT-7** must preserve Registry/indexer/search as consumers/derived integrations rather than Names authority.
