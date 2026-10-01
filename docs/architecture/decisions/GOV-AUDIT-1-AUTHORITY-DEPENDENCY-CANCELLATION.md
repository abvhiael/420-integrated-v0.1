# GOV-AUDIT-1 — Canonical authority, dependency and cancellation decision

Status: **CANONICAL FOR 420GOVERNANCE AUDIT PHASE**

## Decision summary

420 Governance is the public Genesis application. **420 Civic** is its canonical implementation family. The canonical execution and governance-mutation identity remains **GovernanceTimelock**, frozen at `0x0000000000000000000000000000000000000429`. The frozen `Governance420` contract at `0x0000000000000000000000000000000000000437` remains compatibility-only.

The generic shared-interface dependency row is reconciled to the actual Civic runtime graph. None of the repository-wide shared Genesis interfaces are direct Civic runtime dependencies. The Civic contracts depend on one another and on GovernanceTimelock through explicit constructor/module bindings; Registry and Genesis initialization remain deployment/discovery concerns rather than proposal/voting/execution authority.

The full 25-interface classification is machine-readable in `contracts/config/interfaces/governance-dependency-model.json`.

## Canonical internal authority graph

- `GovernanceTimelock`: canonical delayed execution authority and SystemAccess governance identity.
- `CivicConstitution420`: GovernanceTimelock-controlled constitutional rule revisions.
- `CivicProposalRegistry420`: one-time bound to `CivicGovernor420` for proposal lifecycle transitions.
- `CivicElectorateRegistry420`: GovernanceTimelock controls prospective source configuration; one-time bound Governor freezes proposal snapshots.
- `CivicVoting420`: immutable ballots/tallies against the exact Proposal Registry and Electorate Registry.
- `CivicGovernor420`: canonical coordinator for create/finalize/queue/execute and the only scheduler after Civic authority activation.
- `Governance420`: one-time pointer to the canonical Civic Governor; legacy mutation selectors are permanently retired.

The audit-branch Governor constructor additionally fails closed unless Constitution, Proposal Registry and Electorate Registry share one GovernanceTimelock and Voting is bound to the exact Proposal/Electorate registries supplied to the Governor.

## Shared-interface dependency decision

`contracts/config/interfaces/dependency-matrix.json` is interpreted as the set of **normative direct shared-interface runtime dependencies**, not a list of every repository capability that might be useful around an application.

For 420 Governance the canonical direct shared-interface runtime set is empty.

That does **not** mean Governance has no dependencies. Its real runtime graph is the Civic module graph above. It means Civic does not call `IProtocolRegistry420`, `IGovernanceAuthority420`, `IPauseRegistry420`, `ICapabilityRegistry420`, `ISystemSafety420`, `IGenesisInitializable420`, `IMigration420`, `ISignedEnvelope420`, `IReplayProtection420`, `IChainContext420` or `IMetadataCommitment420` as runtime shared-interface dependencies.

Important classifications:

- `IProtocolRegistry420` — **OPTIONAL_INTEGRATION**: deployment/discovery and consumers may use Registry, but proposal/voting/execution does not.
- `IGovernanceAuthority420` — **NOT_APPLICABLE as a dependency**: Governance is the authority provider, not a consumer of its own shared interface.
- `IGenesisInitializable420` and `IMigration420` — **REQUIRED_INDIRECT** deployment/release concerns.
- `IReplayProtection420` — **LOCAL_MECHANISM**: proposer nonces, one-time ballots, monotonic lifecycle and single-use timelock operations.
- `IMetadataCommitment420` — **LOCAL_MECHANISM**: proposal `metadataHash` and `actionsHash` are local immutable commitments.
- `IHealthRegistry420`, `IFeeQuote420` and `IChainContext420` — **CONSUMER_LAYER** where applicable to UI/operator/client behavior.
- Pause, system-safety, capability, oracle, identity, custody and asset interfaces are **NOT_APPLICABLE** to Civic authority. Adding them would create new authority edges not present in the canonical Governance design.

## Cancellation decision

### Canonical Civic v1 rule

**ACTIVE, PASSED and QUEUED Civic proposals are not cancellable.**

There is no proposer cancellation right, no emergency council, no privileged operator cancel, and no direct cancellation power granted to a Wallet, capability holder, Registry actor or validator.

A separate proposal may change future protocol state, but it may not rewrite another proposal's canonical lifecycle.

### Why

The canonical architecture promises frozen proposal rules, frozen electorate snapshots and exact committed action batches. Repository source contains no documented proposer-cancel or emergency-governance policy. Creating one during an audit would invent authority.

The existing `GovernanceTimelock.cancel` originated as a scheduler primitive. Before Civic activation it may be used only by the bootstrap governor for **legacy/bootstrap timelock operations that are not Civic proposals**. After `activateCivicAuthority`, cancellation is disabled for v1.

The `CANCELLED` proposal enum value remains reserved for ABI/history compatibility but is not a legal canonical v1 Civic transition.

### Atomicity and consistency

Because v1 Civic cancellation is unsupported:

1. `CivicProposalRegistry420` must reject transitions to `CANCELLED`;
2. `GovernanceTimelock.cancel` must reject cancellation after Civic authority activation;
3. a passed action batch targeting either cancellation primitive must therefore fail rather than desynchronize Timelock and Proposal Registry state;
4. no canonical `CivicProposalCancelled` event is emitted in v1;
5. Indexer/Search/Wallet must not manufacture a Civic cancellation state from a legacy/raw timelock cancellation event.

This deliberately chooses immutability over an undocumented emergency escape hatch.

## Security rationale

This decision minimizes authority:

- no alternate governance system exists at 0x0437;
- no emergency council is invented from the frozen interface catalogue;
- no generic capability can confer voting/cancellation power;
- ProtocolRegistry discovery cannot authorize a governance outcome;
- bootstrap scheduling/cancellation authority is retired when Civic authority activates;
- current proposals cannot have their rules, electorate or action commitments rewritten by a later administrative decision.

Target protocols remain responsible for their own authorization, asset, custody, accounting, settlement and safety checks when an approved Governance action calls them.

## Qualification requirements

Level 1 must prove:

- all 25 frozen shared interfaces have one explicit classification;
- the 420Governance shared runtime matrix matches the machine-readable model;
- the canonical Civic internal module graph is retained;
- GovernanceTimelock remains the SystemAccess authority;
- `Governance420` legacy mutation selectors remain retired;
- Proposal Registry rejects CANCELLED transitions;
- Timelock cancellation is bootstrap-only and impossible after Civic activation;
- a Civic action batch cannot use cancellation primitives to create a split Timelock/Proposal state;
- the frozen interface catalogue itself still verifies;
- Governance architecture/reference documentation states the same authority/cancellation model.

Because this step changes the shared dependency matrix interpretation for Governance, GOV-AUDIT-1 is treated as an **app integration milestone**. Level 2 is limited to the retained Governance contract/integration suite plus frozen-interface verification; full repository/Genesis/Docs/global qualification remains Level 3 closeout work.

## Follow-up

- **GOV-AUDIT-2 — Civic contract hardening and lifecycle completion** retains this authority/cancellation model while hardening all legal/illegal state transitions and execution boundaries.
- **GOV-AUDIT-4** reconciles derived event/lifecycle projections; no v1 Civic cancellation event is canonical.
- **GOV-AUDIT-6** supplies deterministic Civic deployment and Registry discovery without turning Registry into runtime Governance authority.
