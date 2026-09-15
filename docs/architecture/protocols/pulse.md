---
title: 420 Pulse protocol
audience:
  - developer
  - architect
  - operator
category: architecture
status: current
version: current
---

# 420 Pulse protocol

420 Pulse is the canonical public social-graph, publishing, provenance and discovery-reference protocol for 420 Integrated. It records portable public identities, graph relationships, publication/revision provenance, topics and lightweight interactions while leaving feed ranking, recommendation, indexing and large media payloads outside canonical chain state.

## Authority boundary

Pulse owns public social/provenance state only. It does not custody funds, settle payments, create Identity420 credentials, create universal Trust scores, own Commons membership, own Market listings, or grant unrelated protocol authority from follows, reactions, profile type or publication status.

## Canonical components

- `PulseProfileRegistry420` owns stable public profile identity and controller binding.
- `PulseGraph420` owns reconstructable follow/block relationships.
- `PulsePublicationRegistry420` owns publication identity, immutable author binding, parent/root relationships and append-only revisions.
- `PulseInteractionRegistry420` owns lightweight social interactions.
- `PulseTopicRegistry420` owns stable topic identity.
- `PulsePolicyRegistry420` owns versioned policy references.
- `IPulse420` is the stable consumer boundary.
- `PulseRouter420` coordinates bounded actions without becoming independent authority.

## Feed and indexing boundary

There is no canonical official feed, ranking score, recommendation algorithm or global trend order. Frontends and indexers may build chronological, following, topic or recommendation views, but those outputs are replaceable presentation layers rather than protocol truth.

## Publication and graph safety

Publication edits are append-only. Historical revisions remain reconstructable. Child publications may attach only to active parent publications whose author profiles remain active. Typed cross-dApp references preserve the referenced canonical object ID without claiming ownership over it.

Blocks affect Pulse social interaction policy only. They do not revoke unrelated protocol rights. Deactivation cannot trap users in existing follow/block/reaction state: removal of existing relationships remains possible.

## Storage and privacy

Large content and media bytes stay off-chain behind content manifests and the shared storage layer. Pulse canonicalizes identifiers, commitments and provenance, not bulk media. Private or non-public content must not be inferred from public graph state.

## Integrations

- payments and monetization use 420Pay;
- objective reputation evidence uses 420 Trust;
- identity/credentials use Identity420;
- names use 420 Names;
- community membership/authority uses 420 Commons;
- commerce references canonical 420 Market objects;
- public content manifests use the shared content/storage layer.

## Source model

The frozen implementation model remains `docs/420-PULSE-V1-MODEL.md`. This governed page owns canonical 420Docs architecture placement and integration boundaries.

## Related documentation

- [420 Pulse developer integration](../../developers/pulse-integration.md)
- [420 Pulse troubleshooting](../../troubleshooting/pulse.md)
- [420 Commons protocol](commons.md)
- [420 Trust protocol](trust.md)
