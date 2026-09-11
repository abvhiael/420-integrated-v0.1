# 420RPC RPC-3 routing, health and failover

RPC-3 turns RPC-1 provider discovery and RPC-2 method compatibility into deterministic provider selection. Routing affects gateway availability only; it never changes chain validity, fork choice, finality or transaction semantics.

## Routing eligibility

A provider is considered only when all of the following are true:

- descriptor, discovery and health identities agree;
- the provider is enabled;
- RPC-1 discovery marks it eligible;
- the provider is an execution-RPC upstream for the requested public Ethereum method;
- the provider exposes every capability required by the RPC-2 method definition;
- the provider transport matches the incoming request transport;
- its circuit is not open.

Candidates are ordered deterministically by circuit health, configured priority, then provider ID. Closed circuits are preferred over half-open probes.

## Circuit breaker

Each upstream has independent health state: closed, open or half-open. Consecutive failures open the circuit at the configured threshold. Open providers leave the routing pool until the cooldown expires, after which one half-open probe may be attempted. A successful probe closes and resets the circuit. A half-open failure reopens it immediately.

The default qualification policy is three consecutive failures and a 30-second cooldown. Runtime configuration can change those values only if they remain positive integers.

## Failover semantics

Metadata and read methods may fail over to the next already-qualified candidate. `eth_sendRawTransaction` is not automatically retried across providers after dispatch because a transport failure can be ambiguous: the first upstream may already have accepted the signed transaction. This avoids creating gateway-level replay assumptions.

Subscriptions are also not transparently failed over after establishment. RPC-7 owns subscription lifecycle, resubscription and client-facing disconnect semantics.

## Fail-closed rules

420RPC never routes to a wrong-chain, ineligible, capability-incompatible, open-circuit or transport-incompatible provider merely to stay available. Unsupported and privileged RPC methods continue to fail before provider selection.

RPC-4 will add freshness and finality-safety constraints to this routing pool.
