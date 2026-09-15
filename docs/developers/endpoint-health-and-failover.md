---
title: Endpoint health and failover
audience:
  - developer
category: developer
status: development
version: current
---

# Endpoint health and failover

RPC, WebSocket, gateway, 420RPC and Indexer endpoints are replaceable access infrastructure. Availability alone is not enough: every candidate endpoint must remain compatible with the selected network and the authority level required by the request.

## Readiness checklist

Before marking an RPC/provider endpoint ready, verify:

1. transport liveness;
2. expected chain/network identity;
3. node synchronization and acceptable freshness;
4. required API/method compatibility;
5. acceptable safe/finalized progress for the application;
6. no conflict with the selected manifest or canonical deployment identities;
7. if an Indexer is involved, acceptable projection lag and canonical-source provenance.

An HTTP 200 response from the wrong chain is not readiness.

## Failover requirements

Fail over only to an endpoint that independently satisfies the same environment contract.

A fallback RPC must:

- match the selected network/environment;
- report the expected chain identity;
- expose the required method set;
- be sufficiently synchronized/fresh;
- preserve the application's confirmation/finality policy;
- avoid conflicting finalized state;
- comply with the same public-method/security boundary.

Never silently fail over from local to testnet, testnet to mainnet, or between any other environment classes.

## Finalized disagreement

If two qualified providers disagree about finalized state, stop the affected safety-sensitive operation and investigate. Do not resolve finalized disagreement by provider majority vote, fastest response, lowest latency or preferred vendor.

Provider routing is not consensus.

## Head disagreement

Short-lived head differences can occur because endpoints see blocks at different times. For head-sensitive UX:

- preserve the observed block hash/number;
- distinguish pending/head information from safe/finalized state;
- retry through the selected canonical policy;
- reconcile state after a reorg;
- avoid presenting provider disagreement as final protocol truth.

## WebSocket recovery

When a WebSocket disconnects:

1. reconnect to a qualified endpoint for the same environment;
2. resume from the last durable block/cursor rather than "now";
3. backfill missed blocks/events through canonical RPC or the qualified read model;
4. reconcile removed/replaced events caused by reorgs;
5. advance the durable cursor only after the application's chosen safety threshold.

A transport reconnect does not prove that the canonical chain changed, and a chain reorg does not require that the transport disconnected.

## Service-specific failover

### RPC / 420RPC

Use another qualified execution ingress only after network/method/freshness checks. 420RPC may automate routing but does not create chain authority.

### 420Indexer

Indexer failover can restore query availability, but indexed state remains derived. For security-sensitive truth, fall back to canonical RPC/owning protocol rather than treating another Indexer as a consensus vote.

### Faucet

Do not invent or scrape alternate Faucet endpoints. Use only the Faucet advertised by the selected official testnet manifest. Faucet unavailability is not grounds to use a mainnet or unrelated-network endpoint.

## Quarantine conditions

Remove an endpoint from service when it:

- reports the wrong chain/environment;
- conflicts with expected canonical deployment identity;
- is materially stale or unsynchronized;
- lacks required methods;
- returns malformed/inconsistent RPC data;
- exposes unexpected privileged methods on a public interface;
- disagrees with finalized state;
- repeatedly violates rate/availability guarantees required by the application.

Recovery requires the endpoint to pass the same identity/readiness checks again.

## Credential boundary

Failover configuration may carry provider API keys or access tokens. Those are application/service credentials only. Never reuse Wallet private material, validator keys, Engine JWTs, recovery secrets or other signing authority as RPC-provider credentials.

## Related guides

- [Networks and manifests](networks-and-manifests.md)
- [RPC and WebSocket access](rpc-and-websocket.md)
- [Testnet and Faucet](testnet-and-faucet.md)
- [Source of truth and finality](source-of-truth.md)
