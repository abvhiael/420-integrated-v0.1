# RR-4 — Identity & Permissions qualification

## Step

**RR-4 — Identity & Permissions**

## Status

**COMPLETE — Level 1 PASS + authority-milestone Level 2 PASS**

RR-4 replaces ReeferReview's repository-stage actor-header authority with a verified Wallet/420Identity bearer-session and scoped-capability boundary. This repository qualification does not claim live production issuer/gateway deployment, live testnet dependency composition, Genesis readiness, or production readiness.

## Qualification levels

- **Level 1:** PASS — targeted RR-4 qualification.
- **Level 2:** PASS — required because RR-4 materially changes the app authority boundary.
- **Level 3:** DEFERRED — complete app-phase closeout remains RR-10.

## Exact implementation SHA

`74b6f6777dfa47442654b8afcbc4888fe574c3cb`

This exact SHA is authoritative for both RR-4 Level 1 and the required retained app Level 2 milestone.

## Evidence commit

This qualification record and roadmap status update are evidence-only. They change no executable source, tests, workflows, dependencies, configuration, runtime artifacts, interfaces, deployment state, or substantive requirements and therefore do not require recursive substantive qualification.

## Repository state at qualification

- Repository: `abvhiael/420-integrated-v0.1`
- Branch: `reefer-review-rr1-newsfeed-20261007`
- PR: #562
- Base/main SHA: `c8e8b58d818611276f7a9bb2b8d2241004450d97`
- Exact implementation SHA: `74b6f6777dfa47442654b8afcbc4888fe574c3cb`
- Divergence at qualification: ahead 66 / behind 0
- PR state: OPEN / MERGEABLE / UNMERGED

## Canonical requirement

The canonical roadmap definition is:

> Production 420Identity/Wallet sessions, scoped author/publisher/moderator capabilities, revocation/expiry, no public reliance on `X-420-Actor`.

RR-4 implements the repository-side production authority contract while leaving live issuer/gateway/deployment composition to the later live/deployment gates already defined by the roadmap and existing REEFER-AUDIT work.

## Requirements satisfied

### 1. Verified Wallet/420Identity session boundary

Implemented `SessionVerifier`, `SessionClaims`, and `SessionSecurity`.

The deployment-supplied verifier is authoritative for credential verification and returns already-verified subject/session facts. ReeferReview independently validates:

- session ID;
- subject;
- wallet address shape;
- service audience;
- chain ID;
- network;
- issue time sanity;
- expiry;
- revocation;
- Identity-active state;
- scoped capabilities;
- optional verifier-derived restricted-audience grants.

### 2. Scoped capabilities

Implemented distinct capabilities:

- `reefer.author`
- `reefer.publisher`
- `reefer.moderator`

Authorization preserves ownership boundaries. Author capability applies only to the authenticated subject's own publication. Moderator capability does not grant authoring. Publisher authority is distinct and explicit.

### 3. Revocation and expiry

Expired and revoked sessions fail closed before route handlers receive authenticated context.

Wrong audience, chain, network, malformed wallet/session data, future-issued claims outside tolerance, and inactive Identity state also fail closed.

### 4. No public reliance on X-420-Actor

HTTP authentication derives actor identity only from verified session claims placed into an internal, non-exported request context.

`X-420-Actor` is ignored as authentication authority and is not emitted by the browser or typed Go client.

A dedicated adversarial test proves that a spoofed `X-420-Actor` header cannot authenticate a protected request.

### 5. HTTP capability enforcement

Protected routes require bearer session plus route-appropriate capability before service-level ownership/authorization checks:

- create draft — author/publisher;
- edit — author/publisher;
- publish — author/publisher;
- tombstone — author/publisher;
- moderate — moderator/publisher;
- editorial list — author/publisher/moderator;
- revision history — author/publisher/moderator plus record authorization;
- moderation history — author/publisher/moderator plus record authorization.

Public news, public publication listing, and anonymous PUBLIC/UNLISTED reads remain public.

### 6. Restricted reads

Restricted article access now consumes verifier-derived session context rather than arbitrary actor strings.

FOLLOWERS, COMMUNITY_ONLY, and ORGANIZATION_MEMBERS are not inferred from authentication alone; they require verifier-derived visibility grants unless publisher authority applies.

PRIVATE, MODERATORS, ADMINS, DRAFT, HIDDEN, and TOMBSTONED policies remain explicitly fail-closed.

### 7. Browser Wallet session boundary

The user-facing app now exposes Wallet session controls rather than an arbitrary actor text box.

The browser requests one explicit user-selected least-privilege scope at connection time rather than requesting author, publisher, and moderator privilege simultaneously.

The bearer token is memory-only:
- no localStorage credential persistence;
- no sessionStorage credential persistence;
- no `X-420-Actor`;
- bearer token cleared on sign-out.

A missing Wallet authentication gateway fails closed.

### 8. Typed client session boundary

The Go client now accepts a `SessionTokenProvider`.

Protected methods:
- acquire a bearer token at request time;
- fail before transport if no verified session token is available;
- propagate provider errors;
- use `Authorization: Bearer`;
- never send `X-420-Actor`.

### 9. Secure composition

`NewIdentityBoundHTTP` composes the service with `SessionIdentity` and `SessionAuthorizer`, and refuses construction when the verifier/chain/network session configuration is incomplete.

Verified request-context injection is package-internal rather than exported, preventing callers from bypassing verification by fabricating session context through a public helper.

## Security/adversarial invariants qualified

PASS:

1. missing session fails closed;
2. unknown verifier token fails closed;
3. expired session fails closed;
4. revoked session fails closed;
5. wrong service audience fails closed;
6. wrong chain/network fails closed;
7. malformed wallet/session claims fail closed;
8. future issue-time claim outside tolerance fails closed;
9. inactive 420Identity subject fails closed;
10. moderator capability cannot create author content;
11. author capability cannot edit another author's publication;
12. author capability does not grant moderation;
13. spoofed `X-420-Actor` does not authenticate;
14. restricted visibility is not inferred from mere authentication;
15. verifier-derived visibility grant is required for applicable restricted scopes;
16. browser bearer credentials remain memory-only;
17. typed client protected methods require a session provider;
18. verified session context injection is not exported;
19. browser requests a single explicit least-privilege capability;
20. retained RR-1/RR-2/RR-3 behavior remains green.

## Primary implementation files

- `reefer-review/session.go`
- `reefer-review/session_test.go`
- `reefer-review/http.go`
- `reefer-review/http_test.go`
- `reefer-review/editorial_http_test.go`
- `reefer-review/client/client.go`
- `reefer-review/client/client_test.go`
- `reefer-review/web/index.html`
- `reefer-review/web/app.js`
- `reefer-review/web/styles.css`
- `reefer-review/web/README.md`
- `reefer-review/README.md`
- `docs/audit/REEFER-REVIEW-SECURITY.md`
- `docs/audit/REEFER-REVIEW-AUDIT-REMEDIATION-ROADMAP.md`
- `docs/reefer-review/RR-4-IDENTITY-PERMISSIONS.md`
- `scripts/verify-reefer-review-rr2.py`
- `scripts/verify-reefer-review-rr3.py`
- `scripts/verify-reefer-review-rr4.py`
- `.github/workflows/reefer-review-rr4.yml`
- `.github/workflows/reefer-review-level2.yml`

## Level 1 evidence

### Reefer Review RR-4

- Workflow run: **37673979895**
- Job: `qualify`
- Exact implementation SHA: `74b6f6777dfa47442654b8afcbc4888fe574c3cb`
- Result: **PASS**

Passed:
- exact qualification-head assertion;
- Go formatting;
- RR-4 package/integration tests;
- Go race qualification;
- Go vet;
- frontend JavaScript syntax;
- RR-4 static verifier;
- retained RR-3 verifier;
- retained RR-2 verifier;
- retained RR-1 verifier;
- retained canonical Reefer Review audit verifier.

No skipped, cancelled, missing, stale, or untriggered check is substituted for Level 1 evidence.

## Level 2 evidence

### Reefer Review Level 2 Integration

- Workflow run: **37673979982**
- Job: `retained-app-integration`
- Exact implementation SHA: `74b6f6777dfa47442654b8afcbc4888fe574c3cb`
- Result: **PASS**

Passed:
- exact milestone-head assertion;
- retained ReeferReview executable builds;
- full ReeferReview package tests;
- full ReeferReview race suite;
- app-surface Go vet;
- frontend syntax;
- RR-1 retained verifier;
- RR-2 retained verifier;
- RR-3 retained verifier;
- RR-4 retained verifier;
- canonical Reefer Review audit verifier;
- shared GEN-SVC validator.

This Level 2 run is app-focused and does not duplicate repository-wide Level 3 inventory work.

## Retained direct workflow evidence

On the same exact implementation SHA:
- Reefer Review RR-1 run `37673979958` — PASS;
- Reefer Review RR-2 run `37673980258` — PASS;
- Reefer Review RR-3 run `37673980111` — PASS;
- REEFER-AUDIT-7 run `37673980081` — PASS.

Those retained runs are supplementary evidence; the required RR-4 completion gates are the exact-head RR-4 Level 1 and authority-milestone Level 2 runs above.

## CI diagnosis / superseded heads

During implementation, intermediate RR-4 heads were repeatedly superseded by security, documentation, least-privilege, verifier, and formatting repairs. Their cancelled runs are not counted as passing evidence.

The final exact implementation SHA includes:
- non-exported verified session context injection;
- Identity-active session binding;
- explicit least-privilege browser scope selection;
- stale documentation reconciliation;
- gofmt repairs to RR-4 client, HTTP, and session tests.

The branch also triggers unrelated broad repository workflows. Their results are not substituted for RR-4 qualification. The push-time governance-deployment audit failure is unrelated to RR-4 and is not part of the app-specific completion gate.

## Repository evidence updated

- `docs/reefer-review/RR-4-IDENTITY-PERMISSIONS.md`
- `docs/reefer-review/RR-4-QUALIFICATION.md`
- `docs/reefer-review/RR-ROADMAP.md`
- `docs/audit/REEFER-REVIEW-SECURITY.md`
- `docs/audit/REEFER-REVIEW-AUDIT-REMEDIATION-ROADMAP.md`
- `reefer-review/README.md`
- `reefer-review/web/README.md`

## Milestone status

**RR-4 authority milestone: COMPLETE — Level 1 PASS + Level 2 PASS.**

## Intentionally deferred

### RR-5 — Durable Storage & Rights
Production-persistent publication/revision/moderation storage, qualified 420 Storage encryption/integrity, durable idempotency, and live 420 Rights provenance.

### RR-6 — Ecosystem Integrations
Live 420 Search, Notifications, and 420Mail adapter qualification/reconciliation.

### RR-7 / RR-8 / RR-9
Production news-ingestion security, scheduled feed operations, and production web/deployment/observability/browser qualification.

### RR-10 — Level 3 closeout
Reconciliation with then-current main and comprehensive exact-SHA Level 3 qualification, with canonical owners for Solidity and Genesis inventories and no duplicate full Foundry inventory.

### Existing REEFER-AUDIT live gates
Live dependency integration, deployed security/operations, Genesis decision/release, and production closeout remain governed by the existing REEFER-AUDIT-7 through REEFER-AUDIT-10 roadmap.

## Limitations / blockers

RR-4 has **no repository implementation or qualification blocker**.

Remaining external/live limitations:
- a real deployed Wallet/420Identity gateway/verifier is not configured by RR-4;
- production session issuer/ingress configuration remains a later live/deployment gate;
- the development executable continues to fail closed outside development mode;
- publication storage and downstream ecosystem adapters remain later roadmap work.

These are explicitly deferred by the canonical roadmap and do not block RR-4 completion within the current app audit phase.

## Completion state

- RR-4 requirements: **SATISFIED**
- Level 1: **PASS**
- Authority-milestone Level 2: **PASS**
- Level 3: **DEFERRED TO RR-10**
- TESTNET READY: **NO**
- GENESIS READY: **NO**
- PRODUCTION READY: **NO**

## Next canonical roadmap step

**RR-5 — Durable Storage & Rights**
