---
title: Developer integration model
audience:
  - developer
category: developer
status: development
version: current
---

# Developer integration model

This page defines the canonical integration model used by DOC-9. Every developer guide should preserve these boundaries even when a higher-level SDK, CLI, Wallet client, Indexer, gateway or Developer Hub workflow hides implementation detail.

## Core rule

A convenience layer may discover, prepare, aggregate, simulate, validate or present an operation. It does not inherit the authority of the system that ultimately owns the state.

Before an integration crosses from reading into authorization, signing, settlement, registration, governance, identity, dispute resolution or another state-changing domain, identify the owning authority explicitly.

## Integration layers

| Layer | Developer use | Authority |
| --- | --- | --- |
| Chain / owning protocol contract | canonical state, receipts, events, protocol mutations | canonical for its declared state domain |
| 420 Registry / canonical contract catalogue | approved service identity, implementation/version discovery | canonical only for registered discovery/version state |
| 420 Wallet / Smart Account | user authorization, signing, capabilities, sessions, recovery-aware execution | canonical account authorization authority |
| Public RPC / 420RPC | transport for chain reads/submission | transport only; does not redefine chain state |
| 420Indexer | search, history, projections, feeds, application read models | derived/rebuildable, never canonical |
| 420Verify | reproducible source/build/deployment evidence | verification evidence only; not audit or endorsement |
| Developer Hub / CLI / SDK | discovery, orchestration, validation and handoff | non-authoritative tooling |
| Storage, AI, oracle and other providers | replaceable off-chain services | provider-scoped; canonical effect requires protocol-defined verification/settlement |
| Application UI / API | product-specific presentation and workflow | no authority beyond explicitly delegated application/protocol permissions |

## Standard developer flow

A normal integration follows this order:

1. Select an explicit environment and verify chain identity.
2. Discover canonical contracts/services from the approved network manifest, Registry or contract catalogue.
3. Use canonical RPC for security-sensitive current state.
4. Use 420Indexer or application APIs for rebuildable history, search and projections when appropriate.
5. Prepare human-readable intent and calldata locally or through the SDK/Developer Hub.
6. Route user authorization and signing through 420 Wallet/Smart Account rather than collecting raw private keys.
7. Submit through an approved RPC path.
8. Observe receipt/state from canonical chain sources.
9. Apply the confirmation/finality policy required by the operation before treating it as durable.
10. Use indexed/event-driven systems for UX updates only after preserving provenance and reorg semantics.

## Read versus write boundary

A read path may be served by canonical RPC, 420Indexer, a provider API or an application cache depending on the question being asked. A write path must ultimately be authorized by the authority that owns the mutation.

Examples:

- Indexer data can populate an activity feed, but cannot prove final canonical ownership by itself.
- Developer Hub can prepare a deployment, but cannot sign the deployment unless the designated signer explicitly authorizes it through a supported signing path.
- An application can request a Wallet capability, but cannot create one merely because the user connected the application.
- 420Verify can classify a reproducible match, but cannot make an unregistered deployment an official ecosystem service.
- A Bridge relayer/provider can carry messages or proofs, but cannot bypass the Bridge verifier, replay protection or route policy.

## Authorization domains stay separate

Do not infer one permission from another.

- Wallet connection is not transaction authorization.
- Registry presence is not Wallet capability.
- Identity credential validity is not account ownership.
- Governance authority is not arbitrary protocol-admin authority outside the proposal/execution rules.
- Stake/bond state is not public delegation or stake-weighted application governance.
- Arbitration rulings do not mutate unrelated protocols unless those protocols explicitly consume the outcome.
- Provider qualification does not grant chain, Wallet or governance authority.

## Finality and reorganization rule

Developers must distinguish at least these states when relevant:

- **submitted/pending** — known to a client or mempool but not included;
- **included/head** — included in the current canonical head but still reorg-sensitive;
- **safe** — stronger chain confidence according to the network's exposed safe-head semantics;
- **finalized** — finalized under the consensus protocol.

A product may choose a weaker confirmation level for low-risk UX, but it must not relabel that level as finalized. Indexed systems must preserve source block/finality provenance so consumers can invalidate or replay projections after a reorganization.

## Provider-neutral integrations

Storage, AI/Compute, oracle/external-data, Bridge transport and similar integrations must preserve replaceability. Provider endpoints, rankings or availability are operational facts, not protocol authority. Any provider result that changes canonical state must cross the owning protocol's verification, authorization and settlement rules.

## Failure model

Developer code should fail closed when a security-sensitive source cannot be verified.

Examples include:

- chain ID does not match the selected environment;
- a contract address/interface cannot be verified against the selected manifest/Registry/catalogue;
- a Wallet capability is missing, expired or revoked;
- a quote/proof/oracle result is stale or outside policy;
- a Bridge route or verifier is not qualified;
- an Indexer is behind the required canonical/finalized cursor;
- the application cannot distinguish a cached projection from current canonical state.

Fallbacks may improve availability, but must not weaken the authority check.

## Developer Hub boundary

The completed 420 Developer Hub is the preferred developer control plane for discovery, SDK/CLI workflows, local bootstrap, deployment planning, verification, Indexer diagnostics, publishing and evidence gathering. It remains noncanonical.

A Developer Hub result can tell you what should be submitted, checked or handed off. The chain, Registry, Wallet, governance or other owning protocol remains responsible for accepting and enforcing the result.

## Related documentation

- [Developer documentation home](index.md)
- [Source of truth and finality](source-of-truth.md)
- [Developer prerequisites and tooling](prerequisites.md)
- [System trust-boundary model](../architecture/trust-boundary-model.md)
- [Core protocol integration model](../architecture/protocols/index.md)
- [End-to-end Developer Hub dApp guide](../developer-hub/guides/end-to-end-dapp.md)
