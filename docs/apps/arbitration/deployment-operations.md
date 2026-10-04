# 420 Arbitration deployment and operations

## Repository-qualified deployment order

The canonical source graph currently requires:

1. deploy `ArbitrationPolicyRegistry420(GovernanceTimelock)`;
2. deploy `ArbitrationCaseRegistry420(GovernanceTimelock, ArbitrationPolicyRegistry420)`;
3. deploy `ArbitrationRulingRegistry420(ArbitrationCaseRegistry420)`;
4. execute the one-time `ArbitrationCaseRegistry420.bindRulingRegistry(ArbitrationRulingRegistry420)`;
5. configure each arbitration domain policy through GovernanceTimelock only.

The one-time ruling-registry binding is security-critical. A candidate release must prove the exact deployed address and runtime code hash before binding it.

## ProtocolRegistry publication blocker

The canonical service ID is `420/service/arbitration/v1`, but current repository authority does **not** define:

- a dedicated Arbitration router/service contract;
- which of the three registries is the canonical service implementation to publish;
- a Registry-resolved Arbitration entry in the canonical Genesis address namespace.

Do not guess this mapping. Until repository authority defines the canonical service endpoint and address model, release materialization and live ProtocolRegistry publication remain blocked.

## Required deployment evidence

A production-equivalent deployment must retain:

- chain ID, network/genesis identity and evidence block/hash;
- exact source/release SHA;
- compiler version and artifact identities;
- deployed addresses and runtime code hashes for all three registries;
- GovernanceTimelock identity;
- CaseRegistry -> PolicyRegistry immutable binding;
- RulingRegistry -> CaseRegistry immutable binding;
- the one-time CaseRegistry -> RulingRegistry binding transaction and state;
- configured domain policies and their governance transactions;
- the final canonical ProtocolRegistry publication decision and transaction;
- smoke-test transaction hashes and decoded events.

## Smoke tests

At minimum exercise case opening, party-only evidence, duplicate-evidence rejection, exact-resolver ruling, bounded appeal, pre-deadline finalization rejection, post-deadline finalization, and origin-protocol remedy consumption through that protocol's own bounded transition.

## Recovery

Canonical state is the chain state in the policy, case and ruling registries. Indexers, APIs, frontends and evidence hosts are rebuildable or replaceable. Recovery must never rewrite an open case's snapshotted resolver, deadlines or appeal cap from a newer policy.
