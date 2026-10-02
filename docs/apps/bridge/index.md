---
title: 420 Bridge
audience: [user, developer]
category: application
status: development
version: current
---
# 420 Bridge

420 Bridge is the user-facing application identity for verified, replay-protected cross-chain value movement through approved chains, assets, routes, adapters and risk controls.

## Canonical user surface

For the current release stage, **420 Bridge is surfaced through the 420Exchange `/bridge` route** rather than a separate standalone Bridge web site. The Bridge protocol remains independent of Exchange: `GatewayRouter420`, the Bridge registries, adapters, verifiers, replay controls, risk controls and accounting health remain the canonical execution authority. Exchange provides the reviewed user experience and does not acquire Bridge authority.

420 Wallet and other discovery surfaces should resolve the registered Bridge application to the canonical Exchange Bridge route when a production/testnet service manifest is published. A bare URL is never sufficient authority; Registry/signed-manifest identity remains required.

## Read and review authority

The Exchange Bridge surface consumes the repository-owned Exchange read service, which composes 420Indexer Bridge events with RPC health/fallback readiness. Live configured mode fails closed when that projection or RPC fallback is unavailable; it must not silently substitute demo records.

Before a user can review a Bridge movement, the surface exposes the exact:

- source and destination chain identity;
- canonical asset and route identity;
- adapter and verifier identity;
- amount and recipient;
- route/asset limit context;
- finality and freshness state;
- settlement/progress state and transaction provenance.

Demo fixtures remain explicitly labeled and cannot authorize execution. Submission remains deployment/testnet-gated until the configured runtime, wallet authorization, preflight and live Bridge qualification gates are satisfied.

A valid external proof alone is never enough to release value. Current route direction, canonical asset identity, verifier configuration, risk limits, replay protection, accounting health and local safety state must all agree.

Retry guidance is fail closed: a failed, stale, replaced or reorged operation must be reconciled against canonical Bridge/RPC state before any retry. The UI must never manufacture success or blindly resubmit an ambiguous transfer.

Use [Getting started](getting-started.md) before moving external assets, [Deployment operations](deployment-operations.md) for deployment/initialization/recovery procedures, and [Developer integration](developer/index.md) for route/proof semantics.


## Canonical event and derived-consumer contract

The canonical Bridge event vocabulary comes from the current Bridge contracts and is decoded by 420Indexer. Transfer lifecycle consumers use `TransferCreated`, `TransferStatus`, and `TransferTransition`; gateway movement uses `InboundAccepted`, `OutboundInitiated`, and `OutboundTransferRegistered`. Consumers must not synthesize retired names such as `TransferFinalized` or treat a derived status label as protocol authority.

The transfer lifecycle states are `CREATED`, `SOURCE_PENDING`, `SOURCE_FINALIZED`, `PROOF_PENDING`, `VERIFIED`, `DESTINATION_PENDING`, `COMPLETED`, `FAILED`, `RETRYABLE`, `EXPIRED`, `PAUSED`, `DISPUTED`, and `REFUNDED`. Only the canonical transfer registry decides state; 420Indexer reconstructs a non-authoritative projection.

420Exchange consumes these projections for the current Bridge UI. 420 Explorer displays their provenance, 420 Notifications may subscribe to the same replayable event stream, and 420 Analytics may aggregate the resulting protocol/event/object projections. 420 Wallet remains the authorization/navigation client. None of those surfaces can create, override, reopen, complete, refund, or otherwise mutate Bridge lifecycle state.

