---
title: Errors, retries and idempotency
audience:
  - developer
category: developer
status: development
version: current
---

# Errors, retries and idempotency

Treat errors according to the authority that produced them. RPC transport failures, Indexer projection errors, Wallet authorization failures, protocol reverts and provider-service failures are different classes and must not be collapsed into one retry loop.

## Error classes

- **validation/configuration** — malformed input, wrong chain, missing contract/service, unsupported method or incompatible version. Fix the request/configuration; do not blindly retry.
- **authorization** — Wallet rejection, missing/expired capability, stale authorization epoch, invalid session/passkey or protocol permission failure. Re-read canonical authority and require the appropriate user/owner action.
- **canonical execution** — transaction revert, failed receipt or owning-contract rejection. Surface the protocol result and do not resubmit unchanged unless the protocol explicitly defines a safe retry path.
- **projection/service** — Indexer unavailable/stale, gateway/provider timeout or replaceable service failure. Bounded retry/failover may be appropriate while preserving the same environment and authority boundary.
- **finality/reorg** — observation changed before finality or canonical provenance disagrees. Reconcile/replay from trusted chain state rather than treating this as a normal transport retry.

## Retry rule

Automatically retry only when the operation is known to be read-only or idempotent, or when a protocol/service explicitly supplies an idempotency key/replay-safe request identity.

For state-changing work, first determine whether submission may already have succeeded. A timeout after broadcast is not evidence that the transaction failed. Check the transaction/user-operation identity and canonical state before creating another mutation.

Use bounded attempts, deadlines and backoff. Honor service-provided throttling/retry metadata where available. Never convert an indefinite outage into an unbounded retry storm.

## Idempotency

Applications should define a stable operation identifier for off-chain workflows such as provider jobs, uploads, notifications or application-side projections. Replaying the same identifier should not create duplicate user-visible effects unless duplication is part of the protocol semantics.

On-chain replay protection remains owned by the relevant nonce, nullifier, grant, request ID or protocol-specific state. Do not invent a client-side idempotency token and assume it replaces canonical replay protection.

## Deadlines and expiry

Quotes, capabilities, sessions, provider jobs and bridge/AI workflows may include explicit validity windows or deadlines. Re-read current state before retrying after expiry. Never silently extend a deadline or reuse an authorization whose epoch/scope has changed.

## User-facing behavior

Show whether failure occurred before authorization, before submission, after possible submission, during confirmation, or during finality. This prevents users from signing duplicate actions because a generic error message hid the actual state.

## Related

- [Transaction preparation and simulation](transaction-preparation-and-simulation.md)
- [Capabilities and sessions](capabilities-and-sessions.md)
- [API fallback and reliability](api-fallback-and-reliability.md)
