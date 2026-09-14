# 420RPC WebSocket transport and subscription lifecycle

RPC-7 defines the public WebSocket/session boundary for canonical Ethereum subscriptions.

## Scope

The public subscription surface remains the RPC-2 catalogue:

- `eth_subscribe`
- `eth_unsubscribe`

Supported subscription kinds remain those validated by RPC-5:

- `newHeads`
- `logs`
- `newPendingTransactions`
- `syncing`

RPC-7 does not add new protocol semantics or a new event authority. Subscription events originate from an eligible execution-RPC upstream with the `subscriptions` capability.

## Session lifecycle

Every connection has a gateway-local session ID and client accounting key. Sessions are bounded by a global session limit, heartbeat timeout and idle timeout. Closed sessions release their subscription mappings and buffered events.

Session IDs are unique while retained. A closed session can be removed from the lifecycle table after cleanup.

## Subscription lifecycle

1. The `eth_subscribe` request must pass RPC-5 validation.
2. The setup request must pass RPC-6 resource admission.
3. RPC-7 allocates a gateway-local pending subscription ID.
4. Routing selects an eligible WebSocket execution upstream.
5. After the upstream accepts the subscription, RPC-7 binds the local ID to `(upstreamId, upstreamSubscriptionId)`.
6. Events are accepted only through that exact binding and are emitted to the owning local session.
7. `eth_unsubscribe` is allowed only by the session that owns the local subscription.
8. Cleanup deletes both local and upstream-binding state.

The RPC-6 setup lease is released after subscription establishment work. Long-lived subscription capacity is governed by RPC-7's explicit per-session/global subscription limits rather than by permanently holding a request-concurrency lease.

## Backpressure

Each session has hard limits for:

- queued event count;
- queued bytes;
- individual event bytes.

An oversized individual event is rejected. If adding a valid event would exceed a session queue bound, the session fails closed and is cleaned up instead of allowing unbounded memory growth.

## Upstream loss

420RPC does not claim gap-free subscription continuity across an upstream disconnect.

When an upstream is lost, every subscription bound to it is invalidated and each affected client session is closed with a resubscription-required reason. Clients must reconnect/resubscribe. This prevents the gateway from silently hiding a possible event gap or inventing replay/finality guarantees.

RPC-3 routing can select a different upstream for a new subscription, but it does not make an existing subscription stream portable across providers.

## Heartbeats and idle sessions

RPC-7 records heartbeat and activity timestamps. Sessions exceeding the configured heartbeat or idle timeout are closed and cleaned up. This prevents abandoned connections from retaining subscription and queue state indefinitely.

## Invariants

- **RPC7-001:** subscriptions exist only inside an open WebSocket session.
- **RPC7-002:** subscription setup must pass RPC-5 and RPC-6 first.
- **RPC7-003:** one session cannot unsubscribe another session's subscription.
- **RPC7-004:** upstream subscription IDs are namespaced by upstream identity.
- **RPC7-005:** an upstream subscription binding maps to at most one local subscription.
- **RPC7-006:** queued events are bounded by count and bytes.
- **RPC7-007:** backpressure exhaustion fails closed.
- **RPC7-008:** upstream loss invalidates affected subscriptions; no silent stream failover is claimed.
- **RPC7-009:** heartbeat/idle expiry cleans session subscription state.
- **RPC7-010:** WebSocket lifecycle state never becomes consensus, execution or finality authority.

## Authority boundary

RPC-7 transports and multiplexes event streams only. A delivered event is upstream evidence, not a new 420RPC statement about canonicality or finality. Canonical chain safety continues to come from the execution/consensus system and RPC-4 safety rules.
