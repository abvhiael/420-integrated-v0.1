---
title: 420Storage production topology qualification
audience:
  - developer
  - operator
  - architect
category: developer-guide
status: development
version: current
---

# 420Storage production topology qualification

SR-10.1 defines the first production-hardening topology for the 420 Resource Network. It composes multiple provider/node-local runtimes into one derived discovery view without creating a new source of canonical protocol truth.

## Authority boundary

Each provider/node retains its own `ResourceNetworkRuntime`, service lifecycle and capability bindings. `ProductionResourceTopology` builds those local runtimes from declarative specs and exposes `MultiProviderResourceDiscovery` only as an operational routing view.

The production topology cannot create or finalize agreements, placements, manifests, proofs, escrow settlement or chain state. Discovery results remain advisory. Canonical object identity and payload integrity continue to be enforced by the existing Store/Gateway/developer paths.

## Minimum qualified topology

A production qualification topology must contain at least two distinct providers. Each provider/node is identified independently and declares one or more Store, Repair, Cache, Gateway or Relay services.

The SR-10.1 fixture covers:

- two distinct providers and nodes;
- cache and Store service diversity;
- Repair discovery;
- deterministic capability/priority/provider/node/service ordering;
- lifecycle startup from registered/stopped/failed into running;
- deterministic shutdown to stopped state;
- degraded services excluded from active discovery by default;
- degraded services optionally visible as advisory status;
- cross-provider Gateway failover when an earlier Store source fails;
- payload verification through the existing Gateway integrity path after failover.

## Failure semantics

Production discovery excludes failed, stopped, starting and registered services. Degraded services are excluded from active routing unless the caller explicitly requests them for status/diagnostic purposes.

A failing source does not authorize fallback to unverified bytes. Gateway still validates size and shard root for every candidate. Failover changes only the operational source, not canonical identity or authorization.

## Deployment rules

Production deployments should assign stable provider, node and service identifiers; use deterministic priorities; keep service credentials outside topology descriptors; expose only required endpoints; and preserve at least two independent providers for Store availability qualification.

Provider diversity is an operational resilience requirement, not proof of canonical replication. Placement, proof and settlement authority remain with the chain-backed protocol state.

## SR-10.1 exit criteria

SR-10.1 is complete when the repository can reproducibly construct and test a multi-provider Resource Network that:

1. starts all declared services into running state;
2. discovers services deterministically across providers;
3. excludes degraded services from active routing by default;
4. fails over retrieval between providers without changing object identity or bypassing integrity verification; and
5. shuts all services down cleanly.

The exact SR-10.1 head must pass node420 Release Gate, 420 Integrated Qualification and 420Docs Qualification before the phase advances to SR-10.2 adversarial/fault injection.
