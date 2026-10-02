# Governance events and finality

## Constitution

`CivicRuleSet` records class rule values and revision.

## Proposal lifecycle

- `ProposalAuthorityBound`
- `CivicProposalRegistered`
- `CivicProposalStateChanged`
- `CivicProposalCreated`
- `CivicProposalFinalized`
- `CivicProposalQueued`
- `CivicProposalExecuted`

## Electorates

- `CivicElectorateSourceSet`
- `SnapshotAuthorityBound`
- `CivicElectorateSnapshotted`
- `ElectorateCheckpointPublished`

## Voting

`CivicVoteCast` records proposal, house, voter, support and frozen voting weight.

## Timelock and bootstrap

- `Scheduled`
- `Executed`
- `Cancelled` — bootstrap/legacy operation only before Civic activation;
- `CivicAuthorityActivated`
- `CivicGovernorBound`
- `CivicBootstrapPlanScheduled`
- `CivicBootstrapRetired`

## Indexer semantics

420Indexer descriptors are derived from retained Civic ABI artifacts. Indexer state is rebuildable projection state and is not an authority source.

Clients may use indexed events for enumeration, history and UI updates, but authoritative actions must re-read current chain and Registry state.

A raw Timelock `Cancelled` event must never be translated into a canonical Civic proposal cancellation. Civic v1 has no canonical proposal-cancellation event or lifecycle transition.

## Reorg and finality

Derived services may retract or supersede non-finalized projections. They cannot rewrite finalized chain history or change contract state. Wallet, Explorer, Search and Notifications must preserve chain/network provenance and treat canonical chain/Registry state as authority.
