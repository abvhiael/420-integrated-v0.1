---
title: 420 Wallet events and finality
audience:
  - developer
category: developer-guide
status: development
version: current
---

# 420 Wallet events and finality

Wallet-integrated applications should treat events as observations of canonical protocol/account transitions, not as a substitute for current canonical state.

## Event consumption

Applications may consume account, capability, recovery and transaction-related events through RPC or 420Indexer projections. Event consumers should preserve chain/block/transaction/log identity so reorg reconciliation remains possible.

## Finality states

User-facing integrations should distinguish at least the relevant progression among:

- submitted/pending;
- included/canonical;
- safe;
- finalized.

Do not label an event irreversible merely because an Indexer or Wallet first observed it.

## Reorg handling

Before finality, events may be removed/replaced by canonical-chain reorganization. Integrations should be able to roll back derived state and replay from canonical data. Finalized-state conflicts should fail closed and be treated as an infrastructure/consensus incident rather than silently repaired by application logic.

## Authorization events

Capability, session, recovery and authorization-epoch transitions can invalidate cached permissions. Consumers should react by re-reading the current canonical authorization state instead of inferring validity solely from an earlier grant event.

## Generated event tables

Exact event signatures and generated reference tables belong in DOC-10. This page defines how Wallet integrations should consume them safely.
