# 420 Governance cross-protocol integration

This document is the GOV-AUDIT-7 authority map for canonical 420 Governance / 420 Civic integration.

## Authority rule

The canonical execution identity is `GovernanceTimelock` at `0x0000000000000000000000000000000000000429`. `Governance420` at `0x0000000000000000000000000000000000000437` is compatibility/bootstrap infrastructure only. No Registry record, Wallet state, Indexer projection, Search result, Explorer display, notification, stake amount, Treasury record, or Vault balance can create Civic proposal, voting, tally, finalization, scheduling, or execution authority.

The machine-readable source for this boundary is:

`contracts/config/interfaces/governance-cross-protocol-integration.json`

The executable verifier is:

`scripts/verify-governance-audit-7.py`

## 420Registry

ProtocolRegistry is deployment/discovery authority only. It publishes the canonical Governance service and resolves the Civic module/component IDs established by GOV-AUDIT-6. Civic proposal creation, voting, finalization and Timelock execution do not call Registry at runtime.

Consumers must fail closed when Registry resolution, code identity, protocol version, or module graph does not match the qualified Governance deployment.

Registry replacement or stale projection state therefore cannot alter an existing Civic outcome. It can only make a consumer reject discovery until canonical state is restored.

## 420Stake

Stake economics and Civic validator voting are deliberately separate.

The canonical validator electorate source is `CivicMerkleElectorateSource420` with source type:

`420CIVIC_VALIDATOR_EQUAL_WEIGHT_MERKLE_V1`

Membership represents eligible active-validator owners, but every valid member receives exactly one Civic vote. Bond size, protocol credit, delegated stake, rewards and other economic weight do not scale Civic voting weight.

`CivicMerkleElectorateSource420` has no `ValidatorRegistry` or `Stake420` runtime dependency. Membership snapshots are committed through the governed electorate-source checkpoint process.

## 420Treasury

Treasury is a governed target, not a Governance authority.

GovernanceTimelock may configure Treasury policy, create budgets, schedule disbursements and cancel eligible scheduled disbursements. Budgets and disbursements preserve a nonzero `civicActionHash`, and a scheduled disbursement must match its parent budget commitment.

Treasury does not become an independent asset-custody system: its canonical custody model is 420Vault. Execution remains narrowly capability-scoped and subject to Treasury/Vault policy.

Nothing in Treasury may create Civic voting power, change proposal state, finalize a proposal, or schedule a Timelock operation.

## 420Vault

Vault is custody infrastructure, not a Governance outcome engine.

GovernanceTimelock can mutate the policy surfaces that explicitly use `SystemAccess.onlyGovernance`. Asset release still requires the Vault's capability, route, obligation or beneficiary authorization rules. A Governance proposal may authorize a target call, but Governance itself does not acquire arbitrary direct custody authority.

## 420Wallet

420Wallet is a transaction client.

Before presenting or submitting Governance actions it validates chain identity, ProtocolRegistry identity/version, exact component resolution, deployed code, Civic contract identities/versions and the Governor module graph. Account/network changes invalidate the session.

Wallet does not become proposal-state authority and does not expose compatibility `Governance420` as canonical Civic state. Ordinary Wallet users are not given queue/execute controls merely because the UI can display a proposal.

## 420Indexer, 420Search and 420Explorer

These are derived/rebuildable consumers.

420Indexer decodes Governance events from retained qualified artifacts and chain history. Its database and lifecycle projections are non-authoritative. Reorg/replay logic can repair derived state but cannot alter Civic contracts.

420Search indexes public source-backed records. Ranking, labels and result ordering are presentation state and cannot alter Governance.

420Explorer consumes indexed/chain state for observability. It gains no governance, custody, validator or transaction authority.

A stale, mismatched or unavailable derived service must result in stale/error presentation or consumer rejection, never an altered Governance outcome.

## 420Notifications

420Notifications may surface Governance proposals, deadlines and other Governance events. It is an opt-in delivery layer only.

It cannot sign transactions, grant capabilities, approve spending, mutate protocol state, create canonical events or bypass Wallet confirmation. Notification action buttons hand off to Wallet/origin application authorization.

Delivery failure, replay, retry, reorg marking or provider replacement cannot block or change Governance.

## Other Genesis residents

Many Genesis contracts use `SystemAccess` and therefore accept the canonical GovernanceTimelock as a mutation caller. That makes them governed targets; it does not make them reciprocal Civic dependencies.

External Genesis contracts must not import Civic Constitution, Proposal Registry, Electorate Registry, Voting, Governor, or the legacy Governance420 compatibility surface as an authority dependency. GOV-AUDIT-7 CI scans the source tree for this circular-authority condition.

## Qualification

The focused GOV-AUDIT-7 suite covers:

- machine-readable integration-model consistency;
- canonical Registry IDs and service namespace;
- circular-authority source scan;
- Stake/electorate weight separation;
- Timelock-gated Treasury and Vault mutation;
- Treasury Civic action commitment preservation;
- Wallet discovery/account/network fail-closed behavior;
- Indexer artifact/projection behavior;
- Search/Explorer/Notifications non-authoritative configuration.

The retained Governance suite reruns the cross-protocol contract test at the app-integration milestone. Repository-wide Level 3 qualification remains deferred to the final Governance app-phase closeout.
