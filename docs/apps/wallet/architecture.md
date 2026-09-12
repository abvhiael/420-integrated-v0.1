---
title: 420 Wallet architecture
audience:
  - developer
  - architect
category: application
status: development
version: current
---

# 420 Wallet architecture

420 Wallet is a replaceable client over the Genesis account and authorization stack. Its architecture is intentionally split between presentation/client responsibilities and canonical account/protocol responsibilities.

## Components

| Component | Responsibility | Authority class |
| --- | --- | --- |
| Genesis web client | UI, transaction construction, simulation presentation, approval flows, navigation | replaceable client |
| `SmartAccount420` | canonical account execution/authority boundary | canonical account state |
| `SmartAccountFactory420` | account deployment/discovery semantics | canonical contract |
| `SmartAccountScopes420` | shared account scope definitions | canonical protocol primitive |
| `ECDSA420` / supported passkey path | signature verification | canonical authorization primitive |
| `CapabilityRegistry420` | reusable capability registration/revocation | canonical authorization state |
| 420 Registry / `ProtocolRegistry` | canonical service/interface discovery | canonical discovery state |
| RPC / 420Indexer | chain access and derived projections | infrastructure / derived state |
| 420 Names / Identity | optional naming/identity overlays | protocol/application state within their domains |

## Read path

The Wallet may read account, balance, transaction, capability, session, recovery and ecosystem-discovery information through configured RPC and Indexer services. Derived services improve performance and discoverability but do not replace canonical state.

Where a security-critical decision depends on current authority, the client should verify against the canonical account/protocol source or a qualified read path with appropriate finality semantics.

## Mutation path

A normal state-changing flow is:

1. resolve the intended network, account and application/contract target;
2. construct the requested transaction/call/batch;
3. display human-readable target, value and permission implications;
4. simulate where supported;
5. request the minimum required canonical authorization;
6. submit through a configured transaction path;
7. track canonical/safe/finalized progression;
8. update derived Wallet presentation after canonical observation.

No Wallet server-side component may insert itself as an undisclosed signing authority.

## Discovery path

Core ecosystem destinations are discovered through 420 Registry or a signed/versioned ecosystem manifest. This allows compromised/deprecated destinations to be warned or replaced without changing account state.

The client must distinguish:

- protocol/service identity;
- human-readable name/branding;
- currently configured URL;
- contract/interface version;
- network/chain identity.

## Client portability

The Genesis web client is the first full-management client. Browser extension, mobile and desktop variants may optimize different workflows, but they must preserve the same account/capability/recovery/session semantics and must not create client-specific canonical authority.

## Production-domain boundary

A final production domain is not required to implement the Wallet architecture. Production HTTPS and WebAuthn relying-party bindings are configured only when the canonical domain is selected. Changing a client domain must not mutate underlying Smart Account authority except where the user explicitly enrolls or replaces a domain-bound authentication method.

## Failure behavior

The Wallet should fail closed when it cannot reliably determine network identity, canonical account state, signing target, capability scope or transaction simulation for actions that require those checks. A temporary RPC, Indexer or UI failure must not be translated into fabricated success/finality.

## Architecture invariants

- **WALLET-APP-001** — the client has no consensus or canonical account authority of its own.
- **WALLET-APP-002** — account ownership/recovery/capability/session state remains portable canonical state.
- **WALLET-APP-003** — no 420-operated server possesses user signing keys.
- **WALLET-APP-004** — reusable authority requires an explicit canonical grant.
- **WALLET-APP-005** — Registry/signed-manifest discovery is stronger than URL/branding alone.
- **WALLET-APP-006** — stale derived state never overrides canonical state.
- **WALLET-APP-007** — security-critical failures fail closed rather than inventing authorization or finality.
- **WALLET-APP-008** — future Wallet clients reuse the same account-level semantics.

## Related architecture

- [Wallet Core source](../../420WALLET.md)
- [Accounts](../../architecture/chain/accounts.md)
- [Transactions](../../architecture/chain/transactions.md)
- [RPC, gateways and network ingress](../../architecture/infrastructure/rpc-gateways-network-ingress.md)
- [420Indexer](../../architecture/infrastructure/420indexer.md)
- [Registry, Names, Identity and 420-IS](../../architecture/protocols/registry-names-identity-420is.md)
