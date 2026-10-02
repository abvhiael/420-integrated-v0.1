# 420 Governance security and threat model

## Security objectives

420 Governance must preserve:

- deterministic proposal identity and lifecycle;
- immutable per-proposal rule and electorate snapshots;
- one immutable ballot per voter/house/proposal;
- quorum and approval arithmetic from frozen inputs;
- exact action-batch commitments;
- class/frozen Timelock delay floors;
- one canonical execution authority;
- separation between Governance and Registry/Stake/Treasury/Vault/Wallet/Indexer/Search/Explorer/Notifications authority.

## Trust boundaries

The authoritative state boundary is the canonical Civic contracts plus GovernanceTimelock and the canonical ProtocolRegistry records used for discovery.

Wallet, Indexer, Search, Explorer, Notifications and other hosted services are replaceable consumers. They may present or derive state but cannot create voting weight, alter tallies, finalize proposals or execute Governance.

Target contracts called by an approved Governance batch remain responsible for their own authorization, accounting, reentrancy and failure safety.

## Threat: malicious or stale frontend

A compromised UI could mislabel a proposal, action or tally.

Mitigation: clients verify chain ID, ProtocolRegistry identity/version, exact component resolution, deployed code and module bindings. Action summaries must be checked against the on-chain `actionsHash`. Derived state is non-authoritative.

## Threat: Registry substitution

A stale or malicious discovery result could direct a client to the wrong module.

Mitigation: canonical Registry component/service IDs, runtime code identity and module-graph validation fail closed. Civic runtime proposal/voting/finalization does not depend on Registry reads.

## Threat: electorate or stake manipulation

An attacker could try to increase validator voting power by increasing stake or changing membership after proposal creation.

Mitigation: the proposal freezes source revision/root/total weight. Canonical validator membership is equal weight: one eligible active-validator owner = one vote. Stake, bond size, delegation and rewards do not scale Civic voting weight.

## Threat: duplicate or overweight ballots

Mitigation: CivicVoting420 stores one ballot per proposal/house/voter, rejects a second ballot, obtains weight only from the frozen source and prevents participation from exceeding frozen total weight.

## Threat: threshold or delay changes during a proposal

Mitigation: the Governor freezes constitutional revision/thresholds/delay at creation. Later Constitution or electorate changes are prospective only.

## Threat: action substitution

An attacker could attempt to queue or execute a different target/value/calldata batch after a vote.

Mitigation: `actionsHash = keccak256(abi.encode(actions))` is committed at proposal creation, rechecked at queue and rechecked again at execution. The queued hash is also retained by the Governor.

## Threat: premature or replayed execution

Mitigation: Timelock operations have fixed maturity, single-use executed/cancelled state and class/frozen delay floors. The Governor requires QUEUED state and Timelock-only entry to `executeQueuedBatch`.

## Threat: reentrancy through governed targets

Canonical Civic execution intentionally permits Governance-authorized arbitrary target calls only after the batch is committed, passed, queued and released by Timelock.

The Timelock marks its operation executed before the external call. Reentry into the same operation cannot replay it. Direct entry into the queued Governor batch is Timelock-only. Atomic EVM rollback prevents partial committed execution when a target reverts.

Civic does not add an undocumented global reentrancy lock; governed target contracts must enforce their own safety.

## Threat: cancellation or emergency override backdoor

Canonical Civic v1 proposals are not cancellable after creation. There is no proposer, operator, emergency-council or capability cancellation path.

`GovernanceTimelock.cancel` exists only for legacy/bootstrap operations before Civic authority activation and is disabled afterward. The reserved `CANCELLED` enum is not a canonical v1 proposal state.

## Threat: bootstrap capture

The frozen Governance420 identity at 0x0437 can schedule only the hard-coded canonical bootstrap plan. Invocation is permissionless but callers cannot choose thresholds, addresses, authorities or Registry IDs.

Activation verifies graph, rules, source roles, bindings and Registry publication before the Timelock scheduler is handed irreversibly to CivicGovernor420.

## Threat: derived-service authority creep

Indexer/Search/Explorer/Notifications may be stale, unavailable or incorrect.

Mitigation: their state is explicitly rebuildable/non-authoritative, and GOV-AUDIT-7 verifies they cannot alter Governance outcomes.

## Accepted limitations

- Governance can authorize arbitrary external calls after the full proposal and Timelock process; bad governance decisions are not made safe by the execution engine.
- There is no post-creation proposal cancellation or emergency override in Civic v1.
- The current ordinary Wallet UI does not expose proposal creation, queueing or execution.
- Repository/offline deployment qualification does not substitute for live production-equivalent testnet evidence.
- Registry-resolved Civic module addresses are deployment outputs and are not frozen addresses in source control.

## Operator security rules

Never weaken quorum, approval, Timelock, exact-action, Registry-resolution or artifact-hash checks to recover from a deployment/operator problem.

Never patch guessed addresses or module bindings into an activated deployment.

If a fixed predeploy/runtime hash or Registry resolution differs from retained authority, stop and investigate before transacting.
