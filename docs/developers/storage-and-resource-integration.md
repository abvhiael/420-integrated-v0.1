---
title: Storage and Resource integration
audience:
  - developer
category: developer
status: development
version: current
---

# Storage and Resource integration

The 420 Resource Protocol coordinates provider identity, service eligibility, offers, sessions, metering, storage agreements, capacity, commitments, proofs and settlement while payload bytes remain off-chain.

The developer boundary is strict: providers perform storage/relay/cache/gateway work, but canonical authorization and economic state stay in the Resource Protocol and 420Vault.

## Shared Resource flow

For Relay, Cache, Gateway and metered resource use:

1. resolve a qualified provider/node and service class;
2. resolve an effective canonical offer;
3. obtain user authorization for the bounded spend/action;
4. open a session with explicit unit/spend ceilings;
5. consume the off-chain service;
6. accept cumulative metering only within the bound session;
7. settle only through canonical protocol state.

A provider's local invoice or usage counter cannot create additional spend authority.

## 420Store flow

A safe durable-storage path is:

1. resolve an effective STORE offer and qualified provider/node;
2. prepare object identity, content root, manifest hash and encryption/erasure commitments;
3. reserve canonical capacity;
4. create the immutable storage commitment and proposed agreement;
5. activate only after offer/provider/capacity/commitment/proof-scheme invariants agree;
6. upload encrypted payload/shards off-chain;
7. register compatible shard placements and seal the manifest when complete;
8. monitor current retrievability rather than assuming sealed means permanently available;
9. submit challenge-bound storage proofs through the configured verifier;
10. allow only matching proof-window evidence to release the corresponding 420Vault obligation.

## Proof semantics

An accepted storage proof establishes one verifier-approved challenge for one immutable commitment. It does not establish perpetual availability, satisfy unrelated proof windows or authorize arbitrary payment.

Proof submission is deadline-bound and replay-safe. The current protocol bounds raw proof payloads at 65,536 bytes and retains canonical proof identity/digest/receipt rather than requiring all raw proof bytes in permanent state.

## Settlement

420Vault remains the custodian. Storage settlement creates/releases/cancels bounded Vault obligations; the settlement controller does not become custody authority.

Each funded proof window ends as either PAID or REFUNDED. A missed deadline cannot later be repaired by substituting unrelated proof evidence.

## Privacy

Keep plaintext payloads, encrypted payload bytes, shard bytes, decryption keys, private application metadata, relay traffic and cache contents off-chain. Canonical state should contain only the commitments and metadata needed for identity, authorization, capacity, evidence and settlement.

## Provider failure and repair

Provider suspension blocks new work where active status is required but does not erase historical commitments. Repair/replacement must preserve object identity, old agreement/commitment/proof history and settled/refunded windows while creating new qualified provider/capacity/commitment/placement state.

Never rewrite historical commitment fields to make a replacement provider appear to have been the original provider.

## Application checks

Before presenting a storage object as healthy, distinguish at least:

- manifest completeness;
- current retrievability;
- provider/node activity;
- live agreement/commitment state;
- proof freshness;
- settlement state.

A healthy provider filesystem alone is not canonical proof of availability, and a canonical reservation alone is not proof that local bytes remain intact.

## Related architecture

- [Storage Proof and Resource Protocol](../architecture/protocols/storage-proof-resource-protocol.md)
- [Storage and Resource infrastructure](../architecture/infrastructure/storage-resource-infrastructure.md)
- [Provider-backed integration model](provider-backed-integrations.md)
