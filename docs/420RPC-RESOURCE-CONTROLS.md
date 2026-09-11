# 420RPC RPC-6 resource controls

RPC-6 protects the public gateway from resource exhaustion without gaining any protocol authority. Admission happens after RPC-5 request validation and before chain-safety/routing work.

## Admission model

Every accepted request is charged a deterministic cost based on its public RPC method. Cheap metadata calls cost less than expensive log queries, simulation/gas-estimation calls, raw transaction submission, and subscription setup. A batch is charged as the sum of its entries, so batching cannot bypass quotas.

Default limits are intentionally conservative and deployment-configurable:

- single request payload: 256 KiB;
- batch payload: 1 MiB;
- batch entries: 20;
- batch aggregate cost: 100;
- per-client concurrency: 20 units;
- global concurrency: 256 units;
- per-client token bucket: 120 credits with 2 credits/second refill;
- tracked client identities: 10,000;
- idle client state TTL: 15 minutes;
- client-key length: 128 characters.

Batch concurrency units equal the number of validated entries because an accepted batch may fan out into multiple upstream operations.

## Ordering

1. RPC-5 validates the JSON-RPC envelope, method and params.
2. RPC-6 checks payload size, batch entry count and aggregate weighted cost.
3. RPC-6 checks per-client and global concurrency.
4. RPC-6 checks the per-client token bucket.
5. RPC-6 issues an admission lease.
6. Later safety/routing/transport layers execute the request.
7. The caller releases the lease when work finishes or is abandoned.

Rejected RPC-5 requests consume no quota and create no client state.

## Abuse and state bounds

Client accounting is bounded by `maxTrackedClients`. Idle client states are evicted only when they have no active concurrency lease. Active leases are never evicted to admit a new identity. When the table is full and no idle state can be reclaimed, admission fails closed.

The `clientKey` is an accounting identity supplied by the ingress layer. RPC-6 does not authenticate it; API-key identity and Developer Hub credential binding belong to RPC-9. Operators must not use raw secrets as client keys in logs or telemetry.

## Retry semantics

Rate-limit rejection includes a deterministic `retryAfterMs` derived from the token deficit and configured refill rate. Concurrency and capacity failures do not fabricate protocol-level retry guarantees; callers may retry after local work completes or capacity becomes available.

## Authority boundary

Resource admission controls gateway work only. They do not:

- validate transactions or calls on-chain;
- decide balances, receipts, blocks, safe/finalized checkpoints, consensus or fork choice;
- sign or rewrite transactions;
- expose Engine/admin/debug/private node surfaces;
- promote an otherwise ineligible upstream to preserve availability.

A request that passes RPC-6 is merely admitted for further gateway processing.
