# STAKE-AUDIT-1 — 420Stake shared interface-layer reconciliation

## Decision

420Stake does not adopt the original generic thirteen-entry dependency list as ambient authority. The runtime dependency matrix is narrowed to the dependencies actually required by the canonical Stake authority model:

- ProtocolRegistry — REQUIRED_DIRECT. ValidatorRegistry resolves shared SystemSafety through the canonical registry and verifies ACTIVE lifecycle plus runtime code hash.
- GovernanceAuthority — REQUIRED_DIRECT_EXISTING_AUTHORITY. SystemAccess keeps the constructor-bound GovernanceTimelock for governance-owned bindings and reserve administration. It does not gain consensus authority.
- SystemSafety — REQUIRED_DIRECT. Transition into ACTIVE is NORMAL_ONLY; mature collateral withdrawal is WITHDRAWAL_ONLY.
- GenesisInitialization — REQUIRED_DIRECT_INTROSPECTION. ValidatorRegistry exposes initialization status, version, configuration hash and configuration assertion. Exact predeploy storage generation remains STAKE-AUDIT-7.

The following legacy generic entries are removed from the 420Stake runtime matrix with explicit classifications rather than silently ignored:

| Dependency | Classification | Reason |
|---|---|---|
| PauseRegistry | NOT_APPLICABLE | Stake emergency behavior is expressed by SystemSafety action classes; generic directional pause must not override consensus or withdrawal authority. |
| HealthRegistry | CONSENSUS_OWNED | Validator health, readiness and liveness are represented by consensus-owned lifecycle state. |
| IdentityCredentials | NOT_APPLICABLE_CURRENT_GENESIS | No identity credential is a frozen validator eligibility requirement. |
| CapabilityRegistry | NOT_APPLICABLE | There is no delegated operational capability surface. |
| Migration | RELEASE_LAYER | Frozen non-proxy predeploys have no runtime migration entry point. |
| SignedEnvelope | NOT_APPLICABLE | Mutations are native transactions or native consensus system calls. |
| ReplayProtection | LOCAL_AND_CONSENSUS_MECHANISMS | Gateway sequence, single-use slash evidence and reward-block replay guards own their respective replay domains. |
| ChainContext | CONSENSUS_AND_TRANSACTION_CONTEXT | ConsensusSystemCall420 validates chain, block and parent; direct user calls are native-chain transactions. |
| MetadataCommitment | LOCAL_COMMITMENT | ValidatorRegistry stores the commitment directly and does not delegate validator authority to metadata infrastructure. |

## Runtime enforcement

StakeDependencyAccess420 is deliberately narrower than GenesisResidentAccess420: Stake already has a distinct native-consensus authority path and must not inherit application governance semantics that could let ordinary governance impersonate consensus.

The adapter binds a ProtocolRegistry address and Genesis configuration hash at construction or predeploy materialization time. For safety-sensitive operations it resolves SystemSafety through IProtocolRegistry420, requiring a nonzero implementation, ACTIVE shared lifecycle, a nonzero recorded runtime code hash, and equality between the recorded and live runtime code hash.

ValidatorRegistry.applyConsensusState invokes the guard only when entering ACTIVE; probation and eligibility bookkeeping remain consensus-owned and do not become an application safety decision. ValidatorRegistry.withdrawBond invokes the WITHDRAWAL_ONLY guard after caller and lifecycle validation and before any custody mutation or transfer.

## Authority invariants

- fourtwentyd remains authoritative for committee selection, proposer scheduling, finality, lifecycle outcomes and slash adjudication.
- ConsensusSystemCall420 remains the sole execution gateway for consensus-owned Stake writes.
- Governance can configure explicitly governance-owned one-time bindings but cannot call onlyConsensusSystem functions.
- SystemSafety can permit or refuse an action class; it cannot select validators, fabricate lifecycle state, slash collateral or redirect withdrawals.
- The withdrawal address remains the only caller able to execute mature bond withdrawal.
- Shared interface reconciliation must not add public delegation or stake-weighted governance.

## Milestone relationship

STAKE-AUDIT-1 is qualified at Level 1. It introduces a material shared dependency, so the retained Stake integration suite should be rerun at the next app integration milestone after STAKE-AUDIT-2 converges. STAKE-AUDIT-2 must preserve the system-call chain, context and sequence protections. STAKE-AUDIT-7 must materialize the exact ProtocolRegistry and genesis configuration bindings in predeploy state.
