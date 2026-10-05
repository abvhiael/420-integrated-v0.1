# 420Town audit/remediation roadmap

Requirements are intentionally stable and must not be renumbered.

## TOWN-AUDIT-1 — Canonical definition and authority boundaries

Status: COMPLETE

- reconcile frozen Genesis application catalog with GEN-SVC service registry;
- freeze Town purpose and direct dependencies;
- preserve on-chain authority / off-chain content+transport boundary;
- document that rewards are optional.

## TOWN-AUDIT-2 — Repository inventory and product skeleton

Status: OPEN

- create canonical Town application directories;
- define package/build ownership;
- add app README, environment template and configuration;
- define stable Town object schemas and IDs;
- add CI ownership/gates.

## TOWN-AUDIT-3 — Authoritative community state

Status: OPEN

Implement and test:

- communities;
- membership lifecycle;
- scoped roles;
- permissions;
- subscriptions and entitlements;
- community treasury authority/accounting where canonical design requires it;
- events and explicit invariants.

Authority must not be delegated to Search, Indexer, transport, UI, or rewards.

## TOWN-AUDIT-4 — Content, threads, comments and votes

Status: OPEN

Implement:

- posts;
- threads;
- comments/replies;
- votes/reactions where canonically required;
- content hashes/references;
- visibility rules;
- deletion/tombstone semantics;
- idempotent/replay-safe writes;
- spam/Sybil/rate-abuse controls.

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
