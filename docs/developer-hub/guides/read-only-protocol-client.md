# Read-only protocol client

This guide shows the safe default pattern for reading 420 Integrated protocol data from an application without confusing fast query projections with canonical protocol state.

## Goal

Build an application that can:

- discover the selected 420 network;
- resolve canonical contract addresses and interfaces;
- read security-relevant state from chain RPC through the shared SDK;
- use 420Indexer for search, history and projection-oriented UX;
- revalidate important decisions against the owning canonical authority.

## 1. Discover the network

Start from the selected DEVHUB network manifest. Do not infer chain identity from a hostname, branding or environment label.

```text
420 network
420 service indexer
420 contract ProtocolRegistry
```

The manifest provides the explicit chain ID, canonical RPC endpoints and discoverable service endpoints. The contract catalogue provides address/interface provenance.

**Authority:** selected network manifest and canonical contract catalogue.

## 2. Initialize the shared SDK

Use the DEVHUB-3 SDK with the discovered network and catalogue. The SDK is a convenience layer over selected network state; it does not create a new protocol authority.

Use canonical RPC for reads that will affect authorization, settlement, governance, registration, wallet capability or any other security-sensitive decision.

**Authority:** canonical 420 chain RPC and the protocol contract being read.

## 3. Use 420Indexer for developer UX

420Indexer is the preferred query source for:

- block and transaction history;
- receipts and logs;
- addresses and asset transfers;
- protocol events and protocol-object projections;
- search;
- indexer health/readiness/status.

```text
420 indexer view
420 indexer diagnostics
420 indexer search ProtocolRegistry 20
```

Indexer responses are sourced projections. They are useful, queryable and intentionally non-canonical.

**Authority:** none for protocol state transitions. Source provenance is 420Indexer.

## 4. Revalidate before a security decision

If an indexed row says an account has a role, a proposal passed, an asset settled, an app is registered or a capability exists, do not authorize an action from that row alone. Resolve the owning contract/service and read canonical state.

A safe pattern is:

1. use Indexer/search to locate the object;
2. extract the canonical identifier/address;
3. query the owning protocol contract or canonical RPC;
4. make the security decision only from the canonical response.

## Failure rules

Fail closed when:

- chain ID does not match the selected network;
- required canonical contract metadata is absent;
- a breaking Indexer API version is returned;
- an Indexer result is being used as the sole authorization source;
- a caller attempts to replace canonical RPC with an arbitrary unqualified endpoint for a security decision.

## Boundary summary

| Step | Source | Canonical for security? |
| --- | --- | --- |
| Network selection | DEVHUB manifest | Yes |
| Contract address/interface | canonical catalogue | Yes |
| Protocol state read | chain RPC / owning contract | Yes |
| Search/history/projections | 420Indexer | No |
| Final authorization decision | owning canonical authority | Yes |

The governing rule is simple: **Indexer helps you find and understand state; the owning chain/protocol authority decides it.**
