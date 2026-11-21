# Governance API and reads

The retained ABI artifacts are authoritative for exact ABI encoding.

## CivicGovernor420

Reads: `constitution()`, `proposalRegistry()`, `electorateRegistry()`, `voting()`, `timelock()`, `proposerNonces(address)`, `frozenRule(bytes32)`, `queuedActionHashes(bytes32)`, `hashActions(Action[])`, `resultFor(bytes32,House)`.

Transactions: `createProposal(ProposalClass,bytes32,bytes32)`, `finalize(bytes32)`, `queue(bytes32,Action[])`, and Timelock-only `executeQueuedBatch(bytes32,Action[])`.

## CivicVoting420

Reads: `tally(bytes32,House)`, `ballot(bytes32,House,address)`, `participation(bytes32,House)`.

Transaction: `castVote(bytes32,House,Support,bytes)`, where Support is AGAINST, FOR or ABSTAIN.

## CivicProposalRegistry420

Reads: `proposals(bytes32)`, `proposalAuthority()`.

Authority transactions: `bindProposalAuthority(address)` (Timelock, one time), `registerProposal(...)` (Governor), `transition(bytes32,ProposalState)` (Governor).

## CivicElectorateRegistry420

Reads: `sourceFor(House)`, `proposalSnapshot(bytes32)`, `snapshotAuthority()`, `votingWeight(bytes32,House,address,bytes)`.

Authority transactions: `setHouseSource(House,address)` (Timelock), `bindSnapshotAuthority(address)` (Timelock, one time), `snapshotProposal(bytes32,uint64,bool)` (Governor).

## CivicConstitution420

Reads: `delayFloor(ProposalClass)`, `ruleFor(ProposalClass)`.

Transaction: `setRule(...)` — Timelock-only. The voting-period argument is a **positive** `uint64` block count, including `1`. The protocol does not impose a higher minimum.

## Voting-window and finalization boundaries

For a proposal created at block `N`, the Governor freezes its electorate at `snapshotBlock = N - 1` and sets `voteStart = N + 1` and `voteEnd = voteStart + votingPeriodBlocks - 1` (an **inclusive** interval). `CivicProposalRegistry420.registerProposal` allows `voteEnd == voteStart` and rejects `voteEnd < voteStart` or `voteStart <= snapshotBlock`. `CivicVoting420.castVote` rejects ballots before `voteStart` or after `voteEnd`. `CivicGovernor420.finalize` is allowed only when `block.number > voteEnd` (the first finalizable block is `voteEnd + 1`). Creation reverts on zero block or an absolute `uint64` start/end overflow; it does not change or reduce a Constitution-approved positive voting period. The canonical initial G1–G4 periods remain **17,640 / 35,280 / 35,280 / 105,840** blocks.

## GovernanceTimelock

Reads include `bootstrapGovernor()`, `scheduler()`, `civicAuthorityActivated()`, `delayFor(Class)` and `operations(bytes32)`.

Transactions: `schedule` / `scheduleWithDelay` (scheduler only), `cancel` (bootstrap governor before Civic activation only), `execute` (permissionless mature-operation trigger), and `activateCivicAuthority` (bootstrap governor, one way).

## Governance420

Bootstrap transactions: `scheduleCanonicalCivicBootstrap(...)`, `activateCanonicalCivic(...)`, and Timelock-only `bindCivicGovernor(address)`.

Legacy `createProposal`, `applyVote` and `applyResult` revert with `LegacySurfaceRetired`.
