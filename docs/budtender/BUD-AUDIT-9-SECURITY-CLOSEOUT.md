# BUD-AUDIT-9 — Security Closeout

Status: IMPLEMENTED — Level 1 exact-head qualification pending

## Authority and scope

BUD-AUDIT-9 closes the repository-level security obligations for the current Budtender application slice without expanding product scope or claiming unresolved testnet/production guarantees.

Canonical authority:

- `docs/budtender/BUD-0-ARCHITECTURE.md`;
- `docs/gaming/420GP-16-SECURITY-PRIVACY.md`;
- qualified BUD-AUDIT-5 through BUD-AUDIT-8 evidence;
- current Budtender simulation/application/web/access implementation;
- active Budtender qualification workflow.

This step does not perform Level 3 repository-wide closeout. It verifies the current Budtender app attack surface and preserves shared Gaming Protocol security boundaries.

## Threat model

The current repository-stage Budtender attack surface includes:

- malformed or oversized web/API input;
- browser cross-origin mutation attempts;
- content-type confusion on mutation requests;
- replay/duplicate customer settlement;
- caller-controlled pricing/economy inputs;
- client-side mutation of authoritative state;
- offline reward injection;
- wallet/session authority confusion;
- cross-game entitlement poisoning;
- unknown Gaming feature escalation;
- unsafe static-file serving;
- browser embedding/content-sniffing/referrer/capability leakage;
- accidental dynamic-code or shell-execution surfaces;
- external Gaming runtime unavailability.

## Existing controls retained

Previously qualified controls remain authoritative:

- safe-integer economy guards;
- non-negative cash/inventory;
- bounded inventory capacity;
- single-use order/customer settlement;
- canonical server-side restock pricing;
- detached application snapshots;
- native private application-service authorities;
- bounded/replay-safe offline progression calculation;
- no offline reward application endpoint;
- wallet-free core gameplay;
- canonical game namespace;
- fail-closed unknown Gaming features;
- cross-game poisoned result rejection;
- no wallet-wide enumeration;
- retained Gaming Protocol hostile-state/adversarial coverage.

## BUD-AUDIT-9 hardening

### Browser/API mutation boundary

All JSON mutation requests must:

- use `application/json`;
- reject malformed/oversized bodies;
- reject browser requests whose `Origin` host does not match the request `Host`;
- leave application state unchanged when rejected.

The host may continue to accept non-browser requests with no `Origin` header for local/operator testing.

### Browser response security

Static and JSON responses must include:

- Content-Security-Policy with self-only default source, no base URI, no framing, self-only form action, and no object source;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: no-referrer`;
- restrictive `Permissions-Policy`;
- `Cross-Origin-Resource-Policy: same-origin`;
- `Cache-Control: no-store`.

### Local default exposure

The repository-stage server default remains bound to `127.0.0.1`, not all interfaces.

Production/network deployment policy belongs to BUD-AUDIT-10 and must not silently broaden this repository-stage default.

### Static verifier

The app-scoped security verifier must fail if:

- required browser/API controls disappear;
- loopback default binding disappears;
- obvious dynamic-code execution or child-process execution surfaces are introduced into the host.

## Security invariants

- `BUD-SEC-001`: rejected mutation requests do not mutate game state.
- `BUD-SEC-002`: non-JSON mutation requests fail closed.
- `BUD-SEC-003`: browser cross-origin mutations fail closed.
- `BUD-SEC-004`: JSON/static responses carry baseline browser security headers.
- `BUD-SEC-005`: repository-stage server defaults to loopback binding.
- `BUD-SEC-006`: static-file serving remains rooted to the public directory and traversal attempts fail closed.
- `BUD-SEC-007`: order/customer settlement remains replay-safe.
- `BUD-SEC-008`: caller-controlled pricing cannot override canonical economy pricing.
- `BUD-SEC-009`: presentation/Gaming policy surfaces cannot mutate authoritative game state outside sanctioned application commands.
- `BUD-SEC-010`: offline reward application remains unavailable until trusted persistence owns the cursor/source state.
- `BUD-SEC-011`: wallet/session/Gaming authority remains shared-protocol scoped and optional for core gameplay.
- `BUD-SEC-012`: cross-game/unknown/hostile Gaming state fails closed.
- `BUD-SEC-013`: no obvious dynamic-code or child-process execution surface exists in the repository-stage web host.
- `BUD-SEC-014`: unresolved live Gaming runtime remains deployment-pending and cannot become authoritative by client assertion.

## Qualification

BUD-AUDIT-9 is an ordinary app-scoped Level 1 security step.

Required exact-head qualification:

- Budtender core syntax/tests;
- Budtender web syntax/tests;
- Budtender web security static verifier;
- Budtender/shared Gaming SDK integration tests;
- retained Gaming client hostile-state/cross-game tests;
- retained Gaming Protocol app-specific adversarial suite.

Level 2 is not required because BUD-AUDIT-8 already completed the shared Gaming integration milestone and BUD-AUDIT-9 does not introduce a new shared authority or lifecycle.

Level 3 remains deferred to the final app-phase closeout.

## Exit criteria

BUD-AUDIT-9 is COMPLETE only when:

1. all BUD-SEC-001 through BUD-SEC-014 invariants are satisfied;
2. browser/API mutation boundary rejects non-JSON and cross-origin mutation attempts without state change;
3. baseline browser security headers are present on static and API responses;
4. loopback default binding is retained;
5. static verifier passes;
6. existing economy, replay, offline, application-service, and Gaming security regressions remain green;
7. exact-head Budtender Qualification passes on the implementation SHA;
8. no unresolved critical/high repository-stage Budtender security finding remains;
9. live/testnet/deployment limitations are explicitly documented rather than represented as complete;
10. durable evidence records implementation SHA, evidence SHA, base/current main, CI run/job results, deferred checks, limitations, blockers, and next roadmap step.

## Known limitations

This security closeout is repository-stage only.

It does not claim:

- production hosting hardening;
- TLS/reverse-proxy/WAF configuration;
- durable authentication/session implementation;
- cloud-save authorization;
- production wallet signing UX;
- live Gaming Protocol deployment/finality qualification;
- native mobile platform hardening;
- persistent data encryption/backups/recovery.

Those belong to later persistence, deployment/operations, live-testnet, and final Level 3 work.
