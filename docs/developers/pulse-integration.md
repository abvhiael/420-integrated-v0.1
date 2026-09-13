---
title: 420 Pulse integration
audience:
  - developer
category: developer
status: current
version: current
---

# 420 Pulse integration

Integrations must treat Pulse as canonical for public profile, graph, publication, revision, topic and lightweight-interaction state only.

## Read path

Discover the active Pulse service/version through canonical Registry/release configuration, bind to the compatible `IPulse420` interface, and preserve exact profile/publication/topic identifiers plus revision/provenance context.

Use indexers and feed services for discovery and ranking only. When authority matters, re-read canonical Pulse state.

## Write path

Profile, graph, publication, topic and interaction writes must pass normal Wallet/Smart Account authorization and exact Pulse policy checks. `PulseRouter420` is a bounded coordinator, not a substitute for owning registries.

Do not infer payment, Identity, Trust, Commons or Market authority from a Pulse action. Cross-dApp reference publications preserve canonical external object IDs but do not transfer ownership or authority.

## Feed rule

Never present a ranked/recommended feed as canonical protocol ordering. Ranking provenance and algorithm/version should remain presentation metadata where relevant.

## Content rule

Large media/content bytes belong in the shared content/storage layer. On-chain Pulse state should carry stable identity, commitments and provenance references rather than bulk payloads.

## Failure handling

Unknown profile/publication/topic IDs, inactive author/parent state, invalid parent linkage, stale revision/policy state, blocked interaction relationships and unsupported typed references fail closed. Do not repair these conditions with alternate addresses, cross-environment fallback or fabricated derived state.

## Related documentation

- [420 Pulse architecture](../architecture/protocols/pulse.md)
- [420 Pulse troubleshooting](../troubleshooting/pulse.md)
