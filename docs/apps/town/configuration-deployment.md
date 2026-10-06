---
title: 420Town configuration and deployment reference
component: town
audience:
  - developer
  - operator
category: app
status: development
version: v1
---

# 420Town configuration and deployment reference

## Canonical configuration files

- `config/420town-genesis.json` — service classification, package ownership, authority boundary, phase status.
- `config/420town-authority-v1.json` — authority scope and invariants.
- `config/420town-content-v1.json` — content/storage/visibility/idempotency/abuse model.
- `config/420town-moderation-v1.json` — moderation vocabulary and invariants.
- `config/420town-integrations-v1.json` — shared-service contracts.
- `config/420town-api-v1.json` — API/SDK/projection/recovery contract.
- `config/420town-web-v1.json` — browser application contract.
- `config/420town-security-v1.json` — security controls, N/A classifications, accepted risks.
- `town/.env.example` — secret-free local environment template.
- `town/web/runtime-config.json` — repository production browser bindings, intentionally unresolved pre-testnet.
- `town/web/runtime-config.example.json` — materialized example shape.

## Environment policy

Repository configuration may describe identifiers and public endpoints, but must not contain private keys, bearer tokens, credentials, or privileged secrets.

Remote service URLs are HTTPS-only. Browser runtime configuration rejects embedded URL credentials and secret-like fields.

## Pre-testnet deployment state

TOWN-AUDIT-10 does not deploy a live service. Repository production runtime intentionally fails closed with no live chain ID, TownAuthority420 address, Town API endpoint, or Search endpoint.

That state is valid for repository closeout and becomes a TOWN-AUDIT-11 blocker until live testnet values are supplied and qualified.

## Deployment sequence for TOWN-AUDIT-11

1. deploy/identify the live testnet `TownAuthority420`;
2. record the exact chain ID and contract address;
3. provision Town API and Search HTTPS endpoints;
4. provision production-equivalent authentication without committing secrets;
5. configure Registry/service discovery where applicable;
6. enable browser authority transactions only after chain/target bindings are exact;
7. exercise Identity, Storage, Search, Notifications, and Messenger integration;
8. exercise wallet-reviewed authority flows;
9. exercise restart/recovery and live reorg behavior;
10. capture addresses, endpoints, run IDs, transaction hashes, and smoke evidence.

## Rollback

UI/API/projection deployments may be rolled back independently because they are replaceable. Rollback must never overwrite canonical `TownAuthority420` authority to match a stale application version.

If an application version cannot interpret current canonical authority safely, disable the incompatible path and deploy a compatible application version.
