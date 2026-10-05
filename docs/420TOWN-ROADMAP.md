# 420Town audit/remediation roadmap

Requirements are intentionally stable and must not be renumbered.

## TOWN-AUDIT-1 — Canonical definition and authority boundaries

Status: COMPLETE

- reconcile frozen Genesis application catalog with GEN-SVC service registry;
- freeze Town purpose and direct dependencies;
- preserve on-chain authority / off-chain content+transport boundary;
- document that rewards are optional.

## TOWN-AUDIT-2 — Repository inventory and product skeleton

Status: COMPLETE

- create canonical Town application directories;
- define package/build ownership;
- add app README, environment template and configuration;
- define stable Town object schemas and IDs;
- add CI ownership/gates.

Durable qualification evidence:

- qualification level: Level 1 — per-roadmap-step fast qualification;
- qualified implementation/CI SHA: `df311795f073cde6b58c9d113ab27b12eeb7f154`;
- 420Town audit workflow: run `37261221863` — PASS;
- Town skeleton exact-SHA assertion, canonical audit verifier, skeleton verifier and `go test ./town/...` — PASS;
- Town Solidity exact-SHA assertion, focused Town build/tests and cross-dApp rewards hardening — PASS;
- current main at evidence closeout: `b3cfd359db5ac84aff6213119475ea3dc770642d`;
- PR #523 base remains `b301bd27bee7f412589c36b7a8cdbcad6f69a7e8`; branch reconciliation is intentionally deferred to the Level 3 app-phase closeout unless a later step materially requires it;
- Level 2: not required for this repository/package skeleton step;
- Level 3 repository-wide qualification: intentionally deferred to TOWN-AUDIT-10/app-phase closeout;
- next canonical roadmap step: TOWN-AUDIT-3 — Authoritative community state.

## TOWN-AUDIT-3 — Authoritative community state

Status: COMPLETE

Implemented and tested:

- communities;
- membership lifecycle;
- scoped roles;
- permissions;
- subscriptions and entitlements;
- reference-only community treasury authority binding, without Town custody or a parallel balance ledger;
- authority events and explicit invariants.

Authority remains independent of Search, Indexer, transport, UI, Storage gateways, Notifications and rewards.

Durable qualification evidence:

- qualification level: Level 1 + Level 2 authority milestone qualification;
- qualified implementation/test SHA: `5f8f4a3ad21ad2a1180b2c6af81a2794cffeffb2`;
- 420Town audit workflow run `37267431040` — PASS;
- exact-SHA assertions — PASS;
- canonical Town audit verifier — PASS;
- Town skeleton verifier — PASS;
- Town authoritative-state verifier — PASS;
- `go test ./town/...` — PASS;
- focused Town Solidity build — PASS;
- full retained `test/Town*.t.sol` Foundry inventory — PASS;
- cross-dApp rewards hardening — PASS;
- prior harness-only failure was diagnosed and fixed without weakening Town authorization semantics;
- current main at evidence closeout: `b338b9c9c140957b0ea8619b0b20bfed415f2c6d`;
- PR #523 remains open and currently diverged/non-mergeable against current main; reconciliation is intentionally deferred to the required Level 3 app-phase closeout unless a later Town step materially requires earlier reconciliation;
- Level 3 repository-wide qualification remains deferred to TOWN-AUDIT-10;
- next canonical roadmap step: TOWN-AUDIT-4 — Content, threads, comments and votes.

## TOWN-AUDIT-4 — Content, threads, comments and votes

Status: COMPLETE

Implemented and qualified:

- posts;
- threads;
- comments/replies;
- votes;
- SHA-256 content hashes plus off-chain content references;
- canonical GEN-SVC visibility rules with fail-closed unknown scope handling;
- root-thread visibility inheritance for comments/replies;
- append-only post/comment revision history;
- deletion/tombstone semantics that preserve stable IDs and digests while clearing body references;
- required idempotency keys with conflicting replay rejection;
- duplicate-content fingerprint throttling;
- per-identity, trusted-device, trusted-network, vote and aggregate-community rate-abuse controls;
- lower rate limits for unknown/unverified/young identities;
- one canonical revisioned vote record per voter/target;
- active-membership and target-visibility enforcement for votes;
- explicit boundary keeping high-volume content bodies off-chain by default.

Durable qualification evidence:

- qualification level: Level 1 — per-roadmap-step fast qualification;
- qualified implementation/test/workflow SHA: `f5f01eae23bbc04f02ac7e9f2ab648c465a86813`;
- 420Town audit workflow run `37270292839` — PASS;
- exact-SHA assertions — PASS in both Town jobs;
- canonical Town audit verifier — PASS;
- Town product-skeleton verifier — PASS;
- Town authoritative-state verifier — PASS;
- Town content-state verifier — PASS;
- `go test ./town/...` — PASS;
- focused Town Solidity build — PASS;
- retained `test/Town*.t.sol` Foundry regressions — PASS;
- cross-dApp rewards hardening — PASS;
- current main at closeout: `b338b9c9c140957b0ea8619b0b20bfed415f2c6d`;
- PR #523 remains open and mergeable; final reconciliation to then-current `main` remains a Level 3 closeout responsibility unless a later Town step materially requires it earlier;
- Level 2: not required for this ordinary app-scoped content step; the prior authority milestone was qualified at TOWN-AUDIT-3;
- Level 3 remains intentionally deferred to TOWN-AUDIT-10;
- next canonical roadmap step: TOWN-AUDIT-5 — Moderation and appeals.

High-volume content bodies remain off-chain by default.

## TOWN-AUDIT-5 — Moderation and appeals

Status: OPEN

Implement the shared GEN-SVC moderation vocabulary:

`REPORT, HIDE, BLOCK, MUTE, SUSPEND, APPEAL, MODERATOR_DECISION, RESTORE, LOCK`.

Test domain-scoped moderator authority, escalation boundaries, appeals, provenance, alternate-path bypass and restoration semantics.

## TOWN-AUDIT-6 — Service integrations

Status: OPEN

Qualify real integrations with:

1. 420Identity;
2. 420Storage;
3. 420Search;
4. 420Notifications;
5. encrypted/replaceable messaging transport where Town workflows require it;
6. optional 420Rewards adapter already present.

Add Registry/service discovery only to the extent supported by the canonical service architecture; do not promote Town into the frozen Genesis app catalog without an explicit catalog decision.

## TOWN-AUDIT-7 — API, SDK, indexer and recovery

Status: OPEN

Implement:

- `/v1` service API;
- typed client/SDK;
- authorization and validation;
- cursor pagination;
- idempotency;
- replay-protected signed webhooks if used;
- reorg/rebuild-safe derived projections;
- interruption recovery;
- observability and bounded retry behavior.

## TOWN-AUDIT-8 — User-facing web application

Status: OPEN

Implement and qualify:

- community discovery;
- create/join/leave flows;
- community feed;
- post/thread/comment workflows;
- voting;
- moderation/admin surfaces;
- subscription/entitlement states;
- wallet/network validation for authority-bearing actions;
- loading/empty/error/transaction states;
- accessibility and responsive basics;
- production configuration without committed secrets.

## TOWN-AUDIT-9 — Security hardening

Status: OPEN

Perform focused unit/integration/fuzz/property testing for:

- membership/role privilege escalation;
- unauthorized moderation;
- visibility leakage;
- replay and duplicate writes;
- signed-action domain separation/nonces;
- treasury/accounting conservation;
- reentrancy/external-call behavior if value moves;
- spam/Sybil/griefing/DoS;
- index/search poisoning;
- storage pointer substitution;
- webhook replay;
- message confidentiality and metadata leakage;
- alternate-path permission bypass.

Record accepted design risks separately from unresolved vulnerabilities.

## TOWN-AUDIT-10 — Documentation and exact-head repository qualification

Status: OPEN

Create/complete:

- app README;
- architecture/component map;
- state machines;
- roles/permissions;
- API/events/errors;
- configuration/environment;
- build/test/deploy;
- security/threat model;
- integration guide;
- user guide;
- operator/admin guide;
- known limitations.

Then qualify the exact audit HEAD with all applicable repository gates and durable evidence.

## TOWN-AUDIT-11 — Live testnet qualification

Status: BLOCKED — implementation prerequisite, then live testnet

After TOWN-AUDIT-2 through -10 are repository-complete:

- deploy to live 420Integrated testnet;
- configure real Registry/service discovery and dependencies;
- verify Identity/Search/Notifications/Storage integration;
- exercise real wallet/network flows;
- validate reorg/restart/recovery behavior;
- capture deployed addresses/endpoints/run IDs and smoke-test evidence.

## TOWN-AUDIT-12 — Production/genesis-facing service release

Status: BLOCKED — TOWN-AUDIT-11

- production deployment configuration;
- DNS/service endpoint publication if applicable;
- secrets/credential provisioning;
- monitoring/alerts/SLOs;
- operational rollback/recovery;
- final security/release review;
- durable release evidence.

420Town remains a GEN-SVC Genesis-facing replaceable service unless and until a separate explicit frozen application-catalog decision changes that classification.
