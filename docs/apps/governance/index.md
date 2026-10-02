# 420 Governance

420 Governance is the public Genesis governance application. The canonical implementation family is **420 Civic**.

## What is implemented

Canonical on-chain governance is provided by:

- `GovernanceTimelock` — frozen execution authority at `0x0000000000000000000000000000000000000429`;
- `Governance420` — frozen compatibility and one-shot bootstrap surface at `0x0000000000000000000000000000000000000437`;
- `CivicConstitution420` — versioned proposal-class rules;
- `CivicProposalRegistry420` — proposal identity and lifecycle;
- `CivicElectorateRegistry420` — proposal-bound electorate snapshots;
- `CivicMerkleElectorateSource420` — equal-weight COMMUNITY and VALIDATOR membership sources;
- `CivicVoting420` — immutable ballots and tallies;
- `CivicGovernor420` — proposal coordination, deterministic finalization, queueing and committed batch execution.

The public Governance service is published through `ProtocolRegistry@0x0000000000000000000000000000000000000434` using service ID preimage `420/service/governance/v1`.

## User surface

420Wallet contains the qualified ordinary-user Governance interface for proposal discovery, proposal detail, frozen electorate/threshold display, eligibility checks and COMMUNITY/VALIDATOR voting.

The ordinary Wallet Governance UI does **not** expose proposal creation, queueing or execution controls. Those contract capabilities exist on-chain and are documented for developer/operator use.

## Canonical lifecycle

Canonical Civic v1 proposal state is monotonic:

`ACTIVE -> PASSED -> QUEUED -> EXECUTED`

or:

`ACTIVE -> FAILED`

`CANCELLED` is reserved and is not a canonical Civic v1 transition. Canonical Civic proposals cannot be cancelled after creation.

## Authority model

The Governance stack has no privileged owner key and no emergency council override.

- rule/electorate configuration is Timelock-governed;
- proposal creation is permissionless but commits exact metadata/actions and frozen rules/electorates;
- voting requires frozen electorate membership;
- finalization is deterministic from frozen thresholds and tallies;
- queueing requires the exact committed action batch;
- execution waits for the frozen Timelock delay;
- derived services such as Wallet, Indexer, Search, Explorer and Notifications cannot alter Governance outcomes.

## Documentation map

- [Getting started](getting-started.md)
- [User guide](user-guide.md)
- [Concepts](concepts.md)
- [Architecture](architecture.md)
- [Permissions](permissions.md)
- [Fees](fees.md)
- [Security and threat model](security.md)
- [Operator guide](operator-guide.md)
- [Troubleshooting](troubleshooting.md)
- [Integration boundaries](integration.md)
- [FAQ](faq.md)
- [Developer overview](developer/index.md)
- [Contracts](developer/contracts.md)
- [API and reads](developer/api.md)
- [Events and finality](developer/events.md)
- [Errors and retries](developer/errors.md)
- [Examples](developer/examples.md)

## Deployment status and limitation

The repository is qualified for reproducible deployment and offline deterministic initialization. Live production-equivalent testnet deployment is a later canonical roadmap gate and is not satisfied by repository simulation.
