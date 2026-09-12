---
title: Protocol integration model
audience:
  - developer
  - architect
  - operator
category: architecture
status: development
version: current
---

# Protocol integration model

The canonical protocol layer gives 420 Integrated applications common services without turning every application into a new source of network-wide authority. A protocol may define registrations, permissions, commitments, ownership, accounting, settlement, evidence or governed outcomes for its declared domain; that authority does not automatically extend into another protocol domain.

## What makes a protocol canonical

A protocol is canonical when its authoritative state and interfaces are part of the recognized 420 Integrated protocol surface rather than an application's private database or an operator's local configuration.

Canonical protocol state is anchored on-chain and is discoverable through the system's approved registry/interface mechanisms. Frontends, SDKs, indexers and providers may expose or operate that state, but they cannot silently replace it.

A canonical protocol should make the following reconstructable:

- protocol/service identity;
- deployed implementation or approved interface identity;
- version or revision where behavior can change;
- authority and authorization roles;
- canonical state transitions;
- external/provider dependencies;
- settlement or custody boundary when value is involved;
- events/evidence needed by derived systems;
- emergency, pause or replacement behavior where supported.

## Discovery and interface compatibility

420 Registry and the interoperability layer exist so consumers do not hard-code unrelated private integration schemes for every service.

A consumer should resolve the canonical protocol/service identity and verify that the resolved implementation supports the expected interface/version before using it. A URL, frontend label or indexer record is not sufficient proof that a contract or service is canonical.

When a protocol implementation is replaceable or upgradeable, historical meaning must remain reconstructable. A new implementation must not silently reinterpret old events, commitments, balances, rights or authorization records.

## Authority model

Each protocol owns only its declared domain.

Examples:

- Registry can establish canonical discovery records but does not gain wallet signing authority.
- Identity can publish or attest identity state under its rules but does not own user funds.
- Pay can settle authorized payment flows but does not become arbitrary governance authority.
- Randomness can provide qualified entropy but cannot choose application outcomes outside the consuming application's declared rule.
- Oracle providers report external facts under feed policy but do not become validators.
- Storage providers retain/prove data under storage policy but cannot redefine ownership or chain history.
- Arbitration can resolve only disputes that the relevant integration explicitly submits to its bounded authority.
- Notifications can deliver messages but cannot manufacture the canonical events those messages describe.

Cross-protocol calls must therefore be explicit integrations, not ambient privilege.

## Canonical, derived and external state

Protocol integrations should distinguish three classes of information:

**Canonical state** is execution-layer contract state or another explicitly authoritative protocol result.

**Derived state** is a rebuildable projection such as an Indexer record, search result, analytics view or cached API response.

**External state** originates outside the chain and must pass the receiving protocol's verification boundary before it can affect canonical state.

Applications must not promote derived or external information into canonical authority merely because it is convenient or highly available.

## Provider neutrality

Protocols that rely on off-chain providers should define the provider's bounded role rather than hard-code one operator as permanent authority.

Provider-neutral design normally requires:

- explicit provider identity/eligibility;
- versioned verification or attestation policy;
- request/job/feed/commitment identity;
- replay protection;
- timeout/expiry behavior;
- replacement or failover rules;
- evidence sufficient to determine settlement or failure;
- no implicit validator, wallet or governance authority.

Provider outage should degrade only the service that depends on it unless the protocol explicitly defines a stronger dependency.

## Authorization and capabilities

A protocol action that can change valuable or security-sensitive state must cross an explicit authorization boundary. Wallet connection alone is not sufficient authority.

Where SmartAccount420 or CapabilityRegistry420 authorization is used, applications should request the narrowest authority compatible with the operation. Protocol contracts must still validate their own domain-specific rules; possession of an account capability does not waive protocol invariants.

Administrative and emergency roles must be similarly bounded. A pause role should not silently become a withdrawal, ownership-transfer or arbitrary-state-rewrite role.

## Value, custody and settlement

Protocols that move native `$420`, tokens or other assets must keep custody and settlement semantics explicit.

An integration should be able to answer:

- who funds the action;
- where value is held while pending;
- what event/evidence creates entitlement;
- who the canonical beneficiary is;
- when refund is permitted;
- how duplicate settlement is prevented;
- what happens on timeout, dispute, provider failure or reorg;
- whether finality is required before an external system acts.

A UI or provider must never be able to redirect canonical settlement simply by supplying a different recipient after entitlement has been established.

## External facts and verification

Randomness, oracle observations, bridge attestations, storage proofs, compute receipts and similar evidence are not interchangeable.

Each protocol defines its own verification domain and message format. A valid signature in one domain must not be reusable as authorization in another. Domain separation, chain identity, request/feed/route identity, epochs/nonces and expiry should be bound wherever relevant.

If required evidence cannot be established, security-sensitive paths fail closed rather than inventing a result, lowering quorum or substituting an unrelated provider claim.

## Cross-protocol composition

Applications may compose multiple protocols in one workflow. A representative cross-protocol flow might:

1. resolve a service through Registry;
2. resolve a name or identity reference;
3. request a bounded wallet capability;
4. obtain randomness or external data;
5. execute payment or asset transfer;
6. store a content/proof reference;
7. record rights or verification evidence;
8. emit a canonical event;
9. let Indexer/Explorer/Notifications project or deliver the result.

Every step keeps its own authority. Success in an earlier protocol does not bypass validation in a later protocol.

## Reorganizations and finality

Protocol state follows canonical execution history. Before consensus finality, an included protocol transaction can be reorganized out of the canonical chain.

Derived consumers must support rollback/replay. External side effects such as bridge release, irreversible off-chain delivery or high-value settlement should wait for the finality level required by that protocol rather than treating mempool visibility or one block of inclusion as irreversible.

Finalized protocol history must not be rewritten by an indexer, frontend, provider or operator recovery procedure.

## Failure and recovery

A safe integration recovers from authoritative state outward:

1. establish canonical chain/head/safe/finalized state;
2. restore the protocol's canonical contract state and configuration;
3. reconcile provider/evidence state against canonical commitments;
4. rebuild Indexer and other derived projections;
5. restore gateways, caches, search and UI surfaces;
6. resume new requests only after authority and dependency checks agree.

If a protocol dependency is unavailable, the affected operation should report unavailable/degraded status rather than fabricating success.

## Protocol integration invariants

- **PROTO-001** — canonical protocol state is chain-authoritative; frontends, indexers, gateways and providers cannot redefine it.
- **PROTO-002** — each protocol's authority is bounded to its declared domain and does not imply cross-domain privilege.
- **PROTO-003** — canonical protocol/service discovery must be verifiable through approved registry/interface mechanisms rather than a URL or UI label alone.
- **PROTO-004** — material implementation/version changes must preserve historical interpretability and explicit compatibility boundaries.
- **PROTO-005** — wallet connection, provider operation or application administration does not by itself grant protocol mutation authority.
- **PROTO-006** — reusable permissions are explicit, scoped and revocable where the account/capability model applies.
- **PROTO-007** — external facts affect canonical state only through the receiving protocol's declared verification/attestation boundary.
- **PROTO-008** — signatures, proofs, receipts and attestations are domain-bound and cannot be treated as universal authority.
- **PROTO-009** — custody and settlement paths bind payer, entitlement, beneficiary, amount and replay protection before value can be released.
- **PROTO-010** — provider outages degrade the dependent service and cannot silently weaken verification, quorum or authorization rules.
- **PROTO-011** — derived systems must tolerate pre-finality reorganization and remain rebuildable from authoritative inputs.
- **PROTO-012** — recovery proceeds from canonical authority outward; operational services cannot rewrite finalized protocol history.

## Documentation contract for DOC-7 protocol pages

Each protocol-family page in DOC-7 will identify:

- purpose and canonical domain;
- contracts/interfaces and discovery path;
- actors and authorities;
- normal integration flow;
- authorization model;
- value/custody/settlement behavior where applicable;
- provider/external dependencies;
- events and derived-consumer expectations;
- failure, timeout, dispute and recovery behavior;
- protocol-specific invariants;
- relationship to user-facing genesis applications documented later in DOC-8.

## Related documentation

- [Core protocol architecture](index.md)
- [System overview](../system-overview.md)
- [Trust-boundary model](../trust-boundary-model.md)
- [420Indexer](../infrastructure/420indexer.md)
- [Wallet onboarding](../../users/wallet/index.md)
