---
title: 420 Governance
audience: [user, developer]
category: application
status: development
version: current
---
# 420 Governance

420 Governance is the **public Genesis application name** for the governance experience. Its production implementation is the **420 Civic** protocol suite: proposals, electorate snapshots, voting, result finalization, timelock and committed execution.

This naming split is intentional. User-facing documentation, application navigation and the frozen Genesis application catalog use **420 Governance**. Contract and implementation surfaces use **Civic** names such as `CivicGovernor420`, `CivicVoting420`, `CivicProposalRegistry420` and `CivicElectorateRegistry420`.

The legacy `Governance420` contract is a compatibility surface only. It is not the canonical proposal, voting or execution authority; canonical authority lives in the Civic suite and executes through `GovernanceTimelock`.

Governance does not use current wallet balance or validator bond as ad hoc voting power. Each proposal freezes the applicable constitutional rule revision and electorate snapshot when created.

Use [Getting started](getting-started.md) for the proposal/voting lifecycle, [Architecture](architecture.md) for the Governance/Civic naming and authority map, and [Developer integration](developer/index.md) for safe proposal and tally handling.