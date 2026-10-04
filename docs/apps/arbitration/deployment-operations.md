# 420 Arbitration deployment and operations

## Repository-qualified deployment order

The canonical release graph is:

1. deploy `ArbitrationPolicyRegistry420(GovernanceTimelock)`;
2. deploy `ArbitrationCaseRegistry420(GovernanceTimelock, ArbitrationPolicyRegistry420)`;
3. deploy `ArbitrationRulingRegistry420(ArbitrationCaseRegistry420)`;
4. execute the one-time `ArbitrationCaseRegistry420.bindRulingRegistry(ArbitrationRulingRegistry420)`;
5. deploy `ArbitrationRouter420(PolicyRegistry, CaseRegistry, RulingRegistry)`;
6. register `420/component/arbitration/v1` to the exact router in ProtocolRegistry;
7. publish `420/service/arbitration/v1` to the exact router with `publishRegisteredService`.

The one-time ruling-registry binding is security-critical. A candidate release must prove the exact deployed address and runtime code hash before binding it.

## Address and service authority

`ArbitrationRouter420` is the canonical ProtocolRegistry service implementation for `420/service/arbitration/v1`.

It is **Registry-resolved and has no fixed Genesis address**. The authoritative namespace entry is `arbitration-router` in `contracts/config/genesis-address-namespace.json`. No CREATE2 or additional reserved predeploy is implied.

The router is intentionally read-only and exposes the exact Policy, Case and Ruling registry identities plus canonical read surfaces. State-changing authority remains in the underlying registries; the router does not gain custody, governance, resolver or origin-protocol remedy authority.

## User runtime

The repository-qualified user path is the existing Wallet-integrated Genesis application catalogue. `wallet/web/core/arbitration-runtime.js` validates the canonical service ID, chain/version, router code identity and the three distinct registry code identities before exposing action targets. It fails closed on unresolved, zero-code, wrong-service or aliased bindings and does not sign transactions.

A standalone production domain is not required for repository completion of this step. A future standalone presentation may be added only as non-canonical infrastructure using the same Registry-derived identities.

## Required deployment evidence

A production-equivalent deployment must retain:

- chain ID, network/genesis identity and evidence block/hash;
- exact source/release SHA;
- compiler version and artifact identities;
- deployed addresses and runtime code hashes for Policy, Case, Ruling and Router;
- GovernanceTimelock and ProtocolRegistry identities;
- CaseRegistry -> PolicyRegistry immutable binding;
- RulingRegistry -> CaseRegistry immutable binding;
- Router -> Policy/Case/Ruling immutable bindings;
- the one-time CaseRegistry -> RulingRegistry binding transaction and state;
- configured domain policies and their governance transactions;
- ProtocolRegistry component registration and service publication;
- smoke-test transaction hashes and decoded events.

## Local qualification

`contracts/test/ArbitrationDeploymentBinding420.t.sol` proves the constructor/binding graph, component registration, exact Registry publication, runtime code-hash capture, a representative case/ruling read path, fail-closed service deprecation and governed sequential recovery publication.

`scripts/verify-arbitration-audit-4-release.py` mechanically verifies the address model, deployment order, Wallet runtime binding and absence of fabricated live evidence.

## Indexing boundary

No dedicated canonical Arbitration Indexer descriptor existed when AUDIT-4 was materialized, so this step does not invent a new indexing authority. Case/evidence/ruling/finalization projection remains reconstructable from canonical events and state. Same-deployment address/code-identity binding, reorg/rebuild behavior and live projection qualification belong to ARBITRATION-AUDIT-5.

## Recovery

Canonical state is the chain state in the policy, case and ruling registries. Indexers, APIs, frontends and evidence hosts are rebuildable or replaceable. Recovery must never rewrite an open case's snapshotted resolver, deadlines or appeal cap from a newer policy. If the service is deprecated, clients fail closed until governance publishes the next sequential verified Arbitration service version.
