# Governance contracts

## GovernanceTimelock

Fixed at `0x0429`. Stores scheduled operations and enforces class/frozen delay floors. The scheduler begins as Governance420 bootstrap identity and transfers irreversibly to CivicGovernor420 after verified activation.

## Governance420

Fixed at `0x0437`. Compatibility identity and one-shot exact canonical bootstrap. Legacy proposal/vote/result methods revert.

## CivicConstitution420

Stores G1–G4 voting period, Timelock delay, COMMUNITY/VALIDATOR quorum/approval, dual-house flag and revision. Mutations are Timelock-only and prospective.

## CivicProposalRegistry420

Stores proposal identity, commitments, block window and lifecycle. Proposal authority is bound once to CivicGovernor420.

Canonical transitions: ACTIVE→PASSED/FAILED, PASSED→QUEUED, QUEUED→EXECUTED.

## CivicElectorateRegistry420

Stores current house source configuration and immutable per-proposal snapshots. Source updates are prospective. Snapshot authority is bound once to CivicGovernor420.

## CivicMerkleElectorateSource420

Equal-weight Merkle membership adapter. COMMUNITY and VALIDATOR are distinct source types; each valid member receives weight 1.

## CivicVoting420

Stores one immutable ballot per proposal/house/voter and per-house tallies. Weight resolves only against the frozen electorate snapshot.

## CivicGovernor420

Creates proposals, freezes rules/electorates, finalizes deterministic results, binds exact action batches to Timelock operations and atomically executes queued batches when called by GovernanceTimelock.
