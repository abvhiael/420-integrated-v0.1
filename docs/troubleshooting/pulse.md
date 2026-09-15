---
title: 420 Pulse troubleshooting
audience:
  - user
  - developer
  - operator
category: troubleshooting
status: current
version: current
---

# 420 Pulse troubleshooting

Use this guide when Pulse profile, graph, publication, revision, topic, interaction or feed presentation disagrees with expected behavior.

## First checks

1. confirm the selected environment and canonical Pulse deployment;
2. identify the exact profile/publication/topic IDs involved;
3. distinguish canonical Pulse state from indexer/feed/recommendation presentation;
4. confirm profile, parent publication and policy active state;
5. for writes, identify the original transaction before retrying.

## Common failure classes

### Feed ordering looks wrong

Feed order is non-canonical. Check the frontend/indexer ranking source, freshness and algorithm/version. Do not mutate canonical Pulse state merely to make a feed match a preferred ordering.

### Publication or reply is rejected

Verify that the author profile is active, the parent publication exists and is active, the parent author remains active, policy state is current, and any typed cross-dApp reference carries a valid nonzero canonical object ID.

### Follow, block or reaction behavior is unexpected

Reconcile canonical graph/interaction state first. Blocks affect Pulse social interaction eligibility only; they do not revoke unrelated payment, identity, governance or other protocol rights.

### Edited content appears inconsistent

Pulse revisions are append-only. Confirm the publication's current revision and preserve historical revision identity. Do not overwrite or reinterpret prior revisions as if they never existed.

### Media is unavailable

Large media is not stored in Pulse contracts. Validate the referenced content manifest and storage/retrieval layer separately. Missing media does not erase canonical publication provenance.

## Retry safety

A timeout or stale UI is not proof that a Pulse mutation failed. Check the original transaction and canonical state before resubmitting. Removing an existing follow/block/reaction may remain valid even when the target later becomes inactive.

## Escalation data

Safe support data includes environment, chain ID, profile/publication/topic IDs, transaction hash, policy/revision identifiers and sanitized indexer/feed diagnostics. Never include Wallet secrets, private authentication material or non-public content payloads.

## Related documentation

- [420 Pulse architecture](../architecture/protocols/pulse.md)
- [420 Pulse developer integration](../developers/pulse-integration.md)
