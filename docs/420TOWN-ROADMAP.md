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

Status: COMPLETE

Implemented the shared GEN-SVC moderation vocabulary:

`REPORT, HIDE, BLOCK, MUTE, SUSPEND, APPEAL, MODERATOR_DECISION, RESTORE, LOCK`.

Qualified behavior includes:

- community/domain-scoped MODERATOR and ADMIN authority;
- ordinary-member privilege denial and cross-community escalation prevention;
- user-scoped BLOCK and MUTE;
- community/Town-scoped SUSPEND;
- affected-subject-only APPEAL;
- append-only case/decision provenance with parent-record linkage and monotonic versions;
- MODERATOR_DECISION only from appealed state;
- RESTORE preserving prior case history while releasing active enforcement;
- mandatory moderation gating across Town content reads, histories, edits, thread/reply paths and votes;
- alternate-path bypass prevention for HIDE, LOCK and SUSPEND;
- content/user target provenance validation;
- lowercase SHA-256 evidence validation;
- idempotent moderation writes with conflicting replay rejection;
- explicit prohibition on asset, wallet, payment, rights, protocol-identity or other protocol-authority mutation.

Durable qualification evidence:

- qualification level: Level 1 + Level 2 moderation/content integration milestone;
- qualified implementation/test/workflow SHA: `04fb48b8aca4bf65cf606a139d10b7b8a2129288`;
- 420Town audit workflow run `37274475535` / run `69` — PASS;
- `town-skeleton` job `111648430690` — PASS;
- `town-contracts` job `111648430382` — PASS;
- exact-SHA assertions — PASS in both Town jobs;
- canonical Town audit, skeleton, authority, content and moderation verifiers — PASS;
- `go test ./town/...` — PASS;
- focused Town Solidity build — PASS;
- retained `test/Town*.t.sol` Foundry inventory — PASS;
- cross-dApp rewards hardening — PASS;
- current main at closeout: `b338b9c9c140957b0ea8619b0b20bfed415f2c6d`;
- PR #523 remains open and mergeable; final current-main reconciliation remains deferred to Level 3 unless a later Town dependency requires it earlier;
- Level 3 remains intentionally deferred to TOWN-AUDIT-10;
- next canonical roadmap step: TOWN-AUDIT-6 — Service integrations.

## TOWN-AUDIT-6 — Service integrations

Status: COMPLETE

Qualified repository-side integrations with:

1. **420Identity** — active canonical profile/controller reads fail closed; Town does not create, mutate, revoke or infer Identity credentials;
2. **420Storage / Resource Protocol** — high-volume Town bodies remain off-chain; upload preparation uses the repository `sdk/storage420` client and retrieval verifies SHA-256 integrity against the Town content anchor;
3. **420Search** — only explicit PUBLIC, active Town application material is admitted through the exact `420Town:public` → `public_town` source/domain pair; Search remains rebuildable and non-canonical;
4. **420Notifications** — handoff requires an explicitly selected active, unmuted subscription with operational consent; feed items remain provenance-bound and non-authoritative;
5. **420Messenger / encrypted replaceable transport** — canonical endpoint, conversation, participant, block and envelope-commit state is required; authority outages fail closed before transport and Town carries ciphertext only;
6. **420Rewards** — the existing Town rewards adapter remains optional and non-authoritative.

Registry/service discovery is optional and bounded to exact active canonical service-ID resolution. TOWN-AUDIT-6 does **not** promote Town into the frozen Genesis application catalog.

Durable qualification evidence:

- qualification level: **Level 1 + Level 2 shared-service integration milestone**;
- qualified implementation/test/workflow SHA: `881e42803f008793480fd0723467317fa1a411f7`;
- 420Town audit workflow run `37285287913` / run `93` — PASS;
- `town-skeleton` job `111682925075` — PASS;
- `town-contracts` job `111682925338` — PASS;
- exact-SHA assertions — PASS in both Town jobs;
- Town audit/skeleton/authority/content/moderation/service-integration verifiers — PASS;
- `go test ./town/...` — PASS;
- affected Search/Storage/Notifications dependency tests — PASS;
- focused Town Solidity build and `test/Town*.t.sol` inventory — PASS;
- cross-dApp Rewards hardening — PASS;
- directly affected 420Search audit qualification run `37285288233` / run `43` — PASS, including Search verifier, formatting, `go test ./search/...`, `go vet`, runtime builds, production container build and authority-drift rejection;
- Level 3 remains intentionally deferred to TOWN-AUDIT-10;
- next canonical roadmap step: **TOWN-AUDIT-7 — API, SDK, indexer and recovery surfaces**.

## TOWN-AUDIT-7 — API, SDK, indexer and recovery

Status: COMPLETE

Implemented and qualified:

- `/v1` service API under `town/api`;
- typed Go client/SDK under `sdk/town420`;
- authenticated mutation transport with strict request validation and direct reuse of Town content authorization;
- bounded opaque generation-bound cursor pagination for public derived projections;
- required mutation idempotency keys from API through SDK retries;
- no webhook delivery surface enabled in this step; configuration explicitly keeps webhooks disabled until signed replay protection exists;
- rebuildable, non-canonical, reorg-safe Town post projections under `town/projection`;
- deterministic chain-gap/parent-mismatch rejection and orphan replacement on reorg;
- interruption recovery with bounded, schema-validated, atomically replaced `0600` recovery snapshots under `town/recovery`;
- API observability for requests, errors, auth failures, mutations and aggregate latency;
- SDK HTTPS enforcement, typed errors and bounded retry behavior capped at five attempts / two-second maximum retry delay;
- retryable statuses limited to 429/502/503/504 plus transport failures, with non-retryable conflicts returned immediately;
- exact idempotency-key reuse across retried writes;
- machine-readable TOWN-AUDIT-7 API/SDK/projection/recovery invariants and dedicated verifier/CI ownership.

Durable qualification evidence:

- qualification level: **Level 1 + Level 2 API/SDK/projection/recovery integration milestone**;
- qualified implementation/test/workflow SHA: `05e9bda4db92edabb2c9d97d211b63ec3c1374c1`;
- 420Town audit workflow run `37384027542` / run `124` — PASS;
- `town-skeleton` job `112013015935` — PASS;
- `town-contracts` job `112013016398` — PASS;
- exact-SHA assertions — PASS in both jobs;
- all accumulated Town audit/skeleton/authority/content/moderation/integration/API verifiers — PASS;
- TOWN-AUDIT-7 gofmt gate — PASS;
- `go test ./town/... ./sdk/town420` — PASS;
- `go vet ./town/... ./sdk/town420` — PASS;
- directly affected retained service-dependency tests — PASS;
- focused Town Solidity build and `test/Town*.t.sol` regressions — PASS;
- cross-dApp Rewards hardening — PASS;
- Level 3 remains intentionally deferred to TOWN-AUDIT-10;
- next canonical roadmap step: **TOWN-AUDIT-8 — User-facing web application**.

## TOWN-AUDIT-8 — User-facing web application

Status: COMPLETE

Implemented and qualified:

- public community discovery through non-authoritative 420Search `public_town`;
- create/join/leave authority-bearing flows through EIP-1193 + canonical `TownAuthority420`;
- community feed from the versioned Town `/v1` API;
- post/thread/comment workflows;
- post voting;
- authenticated/idempotent report, moderation and appeal surfaces;
- admin member removal and moderator/admin role assignment;
- canonical membership, subscription and entitlement reads;
- subscription activation and entitlement grants;
- wallet presence, expected-network and exact `TownAuthority420` transaction-target validation;
- explicit canonical authority community `bytes32` input for existing communities rather than inventing an application-ID mapping;
- loading/empty/error/transaction/ready states;
- semantic labels, live regions, visible focus, reduced-motion and responsive layout basics;
- safe runtime configuration with no committed privileged secrets and fail-closed unmaterialized production authority bindings;
- dynamic indexed content rendered without dynamic `innerHTML`;
- dedicated web contract, verifier, structural check and Node unit qualification.

Durable qualification evidence:

- qualification level: **Level 1 + Level 2 frontend/application integration milestone**;
- qualified implementation/test/workflow SHA: `ffa21756d0b900e5cfe517da832a9c892962083f`;
- 420Town audit workflow run `37396803585` / run `164` — PASS;
- `town-skeleton` job `112054679693` — PASS;
- `town-contracts` job `112054679367` — PASS;
- exact-SHA assertions — PASS in both jobs;
- all accumulated Town audit/skeleton/authority/content/moderation/integration/API/web verifiers — PASS;
- Town web structural qualification + all Node web tests — PASS;
- gofmt gate for Town delivery surfaces — PASS;
- `go test ./town/... ./sdk/town420` — PASS;
- `go vet ./town/... ./sdk/town420` — PASS;
- directly affected retained Search/Storage/Notifications dependency tests — PASS;
- focused Town Solidity build and `test/Town*.t.sol` regressions — PASS;
- cross-dApp Rewards hardening — PASS;
- Level 3 remains intentionally deferred to TOWN-AUDIT-10;
- next canonical roadmap step: **TOWN-AUDIT-9 — Security hardening**.

## TOWN-AUDIT-9 — Security hardening

Status: COMPLETE

Implemented and qualified:

- membership/role privilege-escalation resistance;
- unauthorized moderation denial;
- visibility-leakage prevention;
- replay/duplicate-write and idempotency enforcement;
- spam/Sybil/griefing/DoS request-boundary controls;
- Search/index poisoning rejection;
- Storage pointer/digest substitution rejection;
- Messenger ciphertext-only transport and malformed-envelope rejection;
- alternate-path permission-bypass resistance;
- Foundry fuzz/property coverage for authority mutation and cross-community isolation;
- privileged-role non-resurrection after removal/re-add;
- reference-only/non-payable Town treasury behavior;
- API oversized-request, malformed-auth and idempotency-bound tests;
- machine-readable security baseline, dedicated verifier and security documentation.

Explicit non-applicable surfaces:

- signed-action domain separation/nonces — `NOT_APPLICABLE_NO_SIGNED_ACTION_SURFACE`;
- treasury/accounting conservation — `NOT_APPLICABLE_REFERENCE_ONLY_NO_CUSTODY`;
- reentrancy/value-movement hardening — `NOT_APPLICABLE_NO_VALUE_MOVEMENT`;
- webhook replay — `NOT_APPLICABLE_WEBHOOKS_DISABLED`.

Accepted design risks are recorded separately from unresolved vulnerabilities in `config/420town-security-v1.json`. The qualified repository baseline has an explicit empty unresolved-vulnerability list; live testnet and production security remain later gates.

Durable qualification evidence:

- qualification level: **Level 1 + Level 2 security-hardening milestone**;
- qualified implementation/test/workflow SHA: `06eb9e367e3a971596057d340b10164246737243`;
- 420Town audit workflow run `37404518997` / run `175` — PASS;
- `town-contracts` job `112078979128` — PASS;
- `town-skeleton` job `112078979377` — PASS;
- exact-SHA assertions — PASS in both jobs;
- all accumulated Town verifiers including the new security-hardening verifier — PASS;
- Town web qualification — PASS;
- gofmt — PASS;
- `go test ./town/... ./sdk/town420` — PASS;
- `go vet ./town/... ./sdk/town420` — PASS;
- directly affected retained shared-service dependency tests — PASS;
- Town Solidity build — PASS;
- retained `test/Town*.t.sol` Foundry inventory including the new security tests — PASS;
- cross-dApp Rewards hardening — PASS;
- Level 3 remains intentionally deferred to TOWN-AUDIT-10;
- current main at evidence closeout: `ea9994669564d0795e2bcc4a38beea0b01bef274`;
- PR #523 remains open and unmerged;
- next canonical roadmap step: **TOWN-AUDIT-10 — Documentation and exact-head repository qualification**.

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
