---
title: 420Town known limitations
component: town
audience:
  - user
  - developer
  - operator
category: app
status: development
version: v1
---

# 420Town known limitations

The following are deliberate repository-stage limitations, not hidden completion claims.

## Live infrastructure

No live testnet or production Town deployment is qualified by TOWN-AUDIT-10. Live service endpoints, chain bindings, deployed TownAuthority420 address, Registry bindings, operational secrets, and production authentication remain unresolved.

## Authentication

Repository tests use injectable authentication/static-token fixtures. Production-equivalent authentication must be materialized and qualified on testnet.

## Browser authority mapping

Existing-community authority operations require an explicit canonical `bytes32` community key. There is no repository-defined canonical conversion from the opaque Town application ObjectID.

## Persistence and operations

Repository qualification does not prove production database durability, backup/restore operations, horizontal scaling, live SLOs, alert routing, or live incident response.

## Reorg/recovery

Projection reorg and recovery behavior is qualified deterministically in repository tests, but live chain reorg/restart behavior remains a testnet requirement.

## Messenger transport

Town validates canonical Messenger authority before encrypted transport. Transport acceptance may precede canonical envelope-commit confirmation, so production retry/idempotency behavior remains an operational dependency to qualify live.

## Webhooks

Town webhooks are disabled. No webhook delivery surface may be enabled until signed domain separation, timestamp/nonce replay protection, and bounded replay retention are implemented and qualified.

## Treasury/payment

Town has no custody, deposit, withdrawal, transfer, or parallel balance ledger. Treasury handling is a reference binding only. Subscription state is Town authorization state and does not itself prove payment settlement.

## Search and indexing

Search is a derived PUBLIC-only projection and may be stale relative to canonical Town state. It must be rebuilt/reconciled rather than treated as authority.

## Release stages

- TOWN-AUDIT-10: repository-complete pre-testnet phase closeout.
- TOWN-AUDIT-11: live testnet qualification.
- TOWN-AUDIT-12: production/genesis-facing service release.

Repository COMPLETE therefore does not mean testnet-ready evidence already exists or that production release is approved.
