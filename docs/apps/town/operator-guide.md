---
title: 420Town operator and administrator guide
component: town
audience:
  - operator
category: application
status: development
version: v1
---

# 420Town operator and administrator guide

## Release stage

The current repository state is pre-testnet. TOWN-AUDIT-10 qualifies repository completeness only. Do not represent repository qualification as a live deployment, testnet qualification, or production release.

## Runtime configuration

Local development starts from `town/.env.example`. Browser runtime configuration is `town/web/runtime-config.json`; the repository production file intentionally leaves live chain, contract, and service bindings unresolved and disables authority transactions.

Before a live environment can be enabled, materialize:

- expected chain ID;
- canonical deployed `TownAuthority420` address;
- Town API HTTPS endpoint;
- Search HTTPS endpoint;
- production authentication integration;
- any Registry/service-discovery bindings required by the deployment.

Do not commit private keys, bearer tokens, API secrets, or privileged credentials.

## Service health

`GET /v1/health` exposes non-authoritative service counters and the derived projection checkpoint.

Watch:

- request count;
- error count;
- auth failures;
- mutation count;
- aggregate latency;
- projection height/hash/generation;
- dependency-unavailable and integrity failures.

A healthy HTTP process is not proof that chain authority or shared dependencies are correctly materialized.

## Projection and recovery

The Town projection is derived and rebuildable. Chain gaps and parent mismatches fail closed. Reorg replacement increments the projection generation, invalidating stale cursors.

Recovery snapshots:

- use schema `420-town-projection-recovery-v1`;
- are bounded to 8 MiB;
- are atomically replaced;
- use mode `0600`;
- are validated again when restored.

If recovery validation fails, rebuild derived state from the authoritative event source instead of bypassing validation.

## Security operations

Preserve these controls:

- mutation authentication and idempotency;
- request-size and key-length bounds;
- PUBLIC-only Search export;
- Storage digest verification;
- fail-closed Identity/Messenger dependency behavior;
- exact wallet network/target validation;
- zero-value authority transactions;
- no persistent browser session token;
- disabled webhooks until replay-protected signing exists;
- no Town treasury custody.

Accepted repository-stage risks are listed in `config/420town-security-v1.json` and `security.md`. Reassess them when production auth, live bindings, and transport retry behavior are materialized.

## Administrative authority

Community owners control role permissions and ADMIN assignment. MODERATOR and ADMIN scope is community-local. Member removal clears privileged roles. Do not attempt to bypass contract-level owner/permission rules in an operator interface.

Treasury configuration is a reference binding only. Operators must use the canonical treasury/payment subsystem for custody or settlement.

## Incident/rollback guidance

If a deployment presents an unexpected authority target, wrong chain, dependency identity mismatch, Search visibility leak, Storage integrity mismatch, or projection chain inconsistency:

1. disable affected writes/authority transactions;
2. preserve logs and relevant hashes/IDs;
3. fail closed rather than relaxing authorization;
4. rebuild derived projection state if needed;
5. restore only validated recovery data;
6. verify canonical contract/service bindings before re-enabling traffic.

Contract authority state must not be rewritten to match a broken cache, projection, Search index, UI, or transport.

## Qualification commands

Use the dedicated `420Town audit` workflow for retained app qualification. At the TOWN-AUDIT-10 Level 3 boundary, also require exact-SHA PASS from Solidity Contracts, Genesis Address Authority, 420 Integrated Qualification, and 420Docs Qualification.

## Live-testnet handoff

TOWN-AUDIT-11 must capture real deployed addresses/endpoints, Registry bindings, wallet flows, shared-service integration, reorg/restart/recovery behavior, and smoke-test evidence. Until then, unresolved live bindings are expected blockers rather than repository defects.
