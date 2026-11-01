# 420Hz audit remediation roadmap

Status values in this file are evidence-based and refer to the repository state audited on 2026-10-06.

## Canonical lineage

- HZ-1: Creative Protocol / Decision #10 kernel — merged in PR #4.
- HZ-2: catalog, metadata and public projections — merged in PR #90.
- HZ-3: media manifests, storage resolution and playback accounting — merged in PR #100.
- HZ-4: streaming settlement, allocation and royalty routing — historical PR #105 remained unmerged and stale; reconciled onto current main lineage in PR #555.

420Hz is described by the root README as a first-year music application. It is not in the frozen Genesis public application catalog.

## Remediation sequence

### 420HZ-AUDIT-1 — Current-main protocol reconciliation
**Status: IN PROGRESS in PR #555**

- recover HZ-4 onto current main;
- preserve HZ-1 through HZ-3 behavior;
- eliminate stale-branch qualification assumptions;
- qualify the exact PR head.

### 420HZ-AUDIT-2 — Contract and projection hardening
**Status: IMPLEMENTED, qualification pending**

- permit deterministic zero-revenue allocation rows in the non-authoritative indexer projection;
- bound the current storage-source resolution set to the existing Creative Protocol `MAX_SOURCES` limit;
- preserve retired source history while allowing retired current slots to be reused;
- retain replay, conservation and authorization tests.

### 420HZ-AUDIT-3 — Durable protocol documentation
**Status: IMPLEMENTED in PR #555**

- app architecture/status page;
- current Creative Protocol README;
- current Creative Reference Indexer README;
- audit/readiness record.

### 420HZ-AUDIT-4 — Live indexer/runtime
**Status: BLOCKED / NOT IMPLEMENTED**

Required before testnet-ready:
- live RPC log ingestion from deployed Creative Protocol contracts;
- canonical block tracking and reorg rollback/replay;
- durable cursor/checkpoint recovery;
- bounded retry/idempotency rules;
- operator health/readiness/metrics;
- production configuration and secret handling.

### 420HZ-AUDIT-5 — Public API / SDK surface
**Status: MISSING**

Required before a user-facing application can be qualified:
- stable creator/catalog/release/playback/settlement query API;
- typed client/SDK bindings;
- pagination/error/provenance contracts;
- rate limits and authorization where needed;
- API integration tests against the live projection service.

### 420HZ-AUDIT-6 — 420Hz user application
**Status: MISSING**

Required workflows include, at minimum, the repository-defined product scope:
- artist/creator profile and catalog presentation;
- release discovery;
- playback resolution and listening experience;
- wallet/network connection and transaction state handling for creator actions;
- rights/licensing and royalty/settlement visibility appropriate to the user role;
- responsive/accessibility/error/empty/loading states.

No frontend should be treated as canonical protocol authority.

### 420HZ-AUDIT-7 — Ecosystem integration
**Status: PARTIAL / MISSING application bindings**

Before public testnet:
- 420Wallet connection and network validation;
- 420Registry/service discovery;
- 420Names and optional 420Identity presentation without creating competing identity authority;
- 420Search/420Analytics projection integration;
- 420Notifications event delivery;
- 420Storage/provider integration or documented provider adapters;
- 420Pay/asset-generalization decision if settlement expands beyond native 420;
- 420Verify/Explorer links for deployed contracts.

### 420HZ-AUDIT-8 — Testnet and production qualification
**Status: BLOCKED on 4–7 and public infrastructure**

Require exact deployed contract addresses/code hashes, initialization and role handoff, service endpoints, Registry entries, public-testnet smoke/E2E/reorg/recovery evidence, monitoring/backups/incident procedures, independent security review, and exact-release qualification evidence.

## Do not promote these states

- green unit tests != complete application;
- historical HZ-4 CI != exact-current-main qualification;
- reference PostgreSQL projection != live indexer;
- protocol contracts != user-facing 420Hz application;
- repository code-complete != testnet-, Genesis-, or production-ready.
