---
title: Source of truth and finality
audience:
  - developer
category: developer
status: development
version: current
---

# Source of truth and finality

Developer integrations must know which source can answer a question authoritatively and which sources are projections, caches, provider claims or presentation layers.

## Source precedence

For security-sensitive decisions, use the narrowest canonical authority that owns the state.

1. **Chain identity and consensus/execution state** — selected canonical network manifest, chain ID and canonical node/RPC state.
2. **Protocol state** — the designated owning protocol contract on the selected network.
3. **Registered service identity/version** — 420 Registry/approved canonical contract catalogue.
4. **Account authorization** — 420 Wallet/Smart Account state and current authorization epoch/capability/session state.
5. **Derived history/search/analytics** — 420Indexer or application projections, always with provenance and freshness context.
6. **Provider/service claims** — qualified provider APIs, health endpoints, quotes, proofs or attestations, accepted only according to the consuming protocol's policy.
7. **Documentation/tool metadata** — useful for discovery and integration, but never able to redefine canonical state by itself.

## Canonical does not mean universal

Canonical authority is domain-specific.

A Registry record is canonical for registered service discovery but not for Wallet permission. An Identity credential may be canonical within the Identity protocol's credential lifecycle but is not automatically legal identity, wallet ownership or application authorization. Governance execution is canonical only for actions validly authorized by its rules and target domain.

## Chain reads versus indexed reads

Use canonical RPC when the application must know current security-sensitive state, including:

- chain ID/network identity;
- account nonce/balance when preparing value-sensitive execution;
- current contract code at a security-sensitive address;
- current protocol authorization/ownership/permission state;
- transaction receipt and canonical block inclusion;
- finality-sensitive state before irreversible application behavior.

Use 420Indexer when the application needs efficient rebuildable views, including:

- search and history;
- event feeds;
- application projections;
- pagination across large datasets;
- analytics and derived aggregates;
- Explorer-style navigation.

If indexed and canonical sources disagree, the canonical source wins for the state it owns. The integration should surface Indexer lag or projection invalidation rather than silently treating the projection as authoritative.

## Provenance requirements

Derived records should preserve enough metadata to answer:

- which network/chain produced the record;
- source block number/hash or equivalent cursor;
- whether the source was head, safe or finalized when observed;
- projection/index version when interpretation can change;
- freshness/checkpoint information;
- provider/source identity when the record came from a replaceable service.

Do not strip provenance merely because an SDK exposes a simplified object.

## Confirmation states

A transaction or event can move through multiple confidence levels.

| State | Meaning | Typical use |
| --- | --- | --- |
| submitted/pending | submitted but not canonically included | optimistic UX only |
| included/head | present in the current head | low-risk display, reorg-aware |
| safe | stronger confirmation under exposed safe-head semantics | medium-risk workflows according to application policy |
| finalized | finalized by consensus | irreversible/high-risk application decisions |

The application must state which level it requires. A configurable confirmation count must not be presented as protocol finality unless it actually maps to the network's finalized state.

## Reorg handling

Applications consuming head or non-finalized data must be able to:

1. detect source block replacement or cursor rollback;
2. invalidate affected projections;
3. replay events/state from a known checkpoint;
4. prevent duplicate side effects during replay;
5. re-evaluate application state that depended on reverted data.

External actions that cannot be reversed should generally wait for the application's required finality threshold.

## Documentation and generated metadata

420Docs, SDK metadata, generated ABIs, contract catalogues and deployment manifests guide developer behavior but are not substitutes for canonical checks.

Security-sensitive metadata should be reproducible or verifiable against the selected network and canonical Registry/deployment state. Generated reference belongs to DOC-10; DOC-9 task guides must explain when and how to verify it.

## Fail-closed examples

Stop the operation rather than guessing when:

- chain ID differs from the intended environment;
- no qualified current implementation can be resolved for a required service;
- runtime code differs from the expected deployment evidence;
- a Wallet permission is absent/revoked/expired;
- finality cannot be established at the level required by the operation;
- an Indexer projection lacks required provenance or is behind the required cursor;
- a provider response cannot be verified under the consuming protocol's rules.

## Related documentation

- [Developer integration model](integration-model.md)
- [Developer prerequisites and tooling](prerequisites.md)
- [Trust-boundary model](../architecture/trust-boundary-model.md)
- [420Indexer infrastructure](../architecture/infrastructure/420indexer.md)
- [End-to-end Developer Hub dApp guide](../developer-hub/guides/end-to-end-dapp.md)
