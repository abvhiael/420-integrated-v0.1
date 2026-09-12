# 420RPC RPC-11 hostile-state and security hardening

RPC-11 hardens the complete public ingress path built in RPC-0 through RPC-10. Its purpose is to prove that independent safety layers cannot be bypassed by malformed structure, mixed-authority batches, privileged-method smuggling, resource-amplification payloads, or cross-layer ordering mistakes.

## Hardened ingress order

The public JSON-RPC ingress contract is intentionally ordered:

1. structural JSON hardening;
2. top-level JSON-RPC envelope-shape hardening;
3. RPC-5 method/envelope/parameter validation;
4. RPC-9 principal scope authorization;
5. RPC-6 quota, cost and concurrency admission;
6. RPC-4/RPC-3 safety-aware routing;
7. transport-specific handling such as RPC-7 WebSocket lifecycle.

A failure at an earlier layer must not consume or mutate state owned by a later layer. In particular, malformed or unauthorized requests must not allocate RPC-6 client state, burn quota, open leases, create subscriptions, or reach an upstream provider.

## Structural hardening

RPC-11 adds bounded JSON structure inspection before semantic validation:

- maximum nesting depth;
- maximum total JSON nodes;
- maximum aggregate UTF-8 string/key bytes;
- maximum keys per object;
- rejection of non-finite numbers and non-JSON values;
- rejection of `__proto__`, `prototype`, and `constructor` object keys to reduce prototype-pollution risk in downstream JavaScript processing;
- rejection of unexpected top-level JSON-RPC envelope keys.

These limits supplement RPC-6 encoded byte and batch/cost limits. They do not replace them.

## Cross-layer authorization invariants

RPC-11 qualifies the following hostile combinations:

- a read-only credential cannot submit a signed transaction;
- a mixed read/submit batch fails atomically for a read-only principal;
- `rpc:admin` cannot bypass RPC-5 Engine/admin/debug/signing exclusions;
- malformed structure fails before RPC-9/RPC-6 stateful admission;
- unauthorized requests fail before quota accounting;
- authorized requests are admitted under the stable RPC-9 `clientKey` and release RPC-6 leases cleanly;
- RPC-6 rejection reasons remain intact through the security gate.

## Authority boundary

RPC-11 is still gateway hardening only. The security gate can reject unsafe or unauthorized traffic, but it does not determine canonical blocks, fork choice, finality, transaction validity, ownership, Registry legitimacy, governance authority, or wallet signing authority.

## Failure policy

Hostile or ambiguous inputs fail closed. The gateway does not attempt to repair malformed requests, infer missing permissions, rewrite signed transaction bytes, select a winner during finality disagreement, or silently promote derived Indexer state to canonical execution state.

## Qualification

RPC-11 is complete when:

- the hostile-state test suite passes;
- existing RPC-0 through RPC-10 tests remain green;
- documentation qualification passes;
- repository-wide offline core, fault/soak, production dependencies and pinned-Geth/live-engine checks pass on the exact PR head;
- the branch is reconciled with current `main` before merge.

RPC-12 then performs testnet qualification and launch closeout rather than introducing a new trust model.
