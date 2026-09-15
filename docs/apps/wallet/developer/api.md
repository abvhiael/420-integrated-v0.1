---
title: 420 Wallet API and provider boundary
audience:
  - developer
category: developer-guide
status: development
version: current
---

# 420 Wallet API and provider boundary

420 Wallet integrations should depend on explicit provider/client interfaces and canonical chain/protocol state rather than a privileged Wallet backend.

## Read operations

Read-only workflows may use qualified RPC and 420Indexer services for account, balance, transaction, capability, session, Registry and application state. Derived services improve latency and queryability but remain non-authoritative projections.

Security-critical authorization decisions should be checked against current canonical state or a qualified read path with appropriate finality semantics.

## Write operations

A dApp should construct or request the minimum transaction/capability operation required. The Wallet presents the request, simulation and human-readable consequences, then crosses the canonical account authorization boundary before submission.

A server-side API must not accept or retain user private signing material.

## Provider expectations

Integrations should handle:

- network mismatch;
- account/controller changes;
- capability/session revocation;
- authorization-epoch changes;
- RPC/indexer failover;
- stale derived reads;
- transaction replacement or failure;
- reorg/finality progression.

## Idempotency and retries

Read operations may normally be retried. State-changing requests must use transaction/call identity and canonical receipts rather than blindly resubmitting the same economic action. Reusable capability creation and recovery/admin operations require particular care because duplicate intent may have security consequences.

## Discovery

Core Wallet-linked applications/services should be discovered through 420 Registry or a signed/versioned ecosystem manifest. Integrations should not hard-code an unversioned URL as proof of canonical service identity.

Exact RPC/API schemas and generated reference tables belong in DOC-10.
