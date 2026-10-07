# PB-14 — Backend/API hardening

## Purpose
Materialize and harden the reserved authenticated PuffBuddies API/edge transport boundary after PB-13, while preserving the domain layer as the sole owner of PuffBuddies relationship, consent, eligibility-decision, lifecycle, visibility, deletion, safety and private-access authority.

PB-14 supplies repository-side production-shaped transport behavior. It does **not** claim a deployed public endpoint, production credentials, infrastructure provisioning, testnet readiness or release readiness.

## Canonical API boundary
The canonical repository API base is `/api/puffbuddies/v1`.

The backend dependency direction is:

`web/mobile -> authenticated API transport -> injected PuffBuddies application/domain handlers -> storage/integrations`.

The API edge is a guard and translator. A successful transport check never manufactures a like, match, message authorization, eligibility decision, unblock, safety decision, lifecycle transition, visibility decision or premium entitlement.

## Canonical requirements
1. Materialize `puffbuddies/api/` under PB-STRUCT-003.
2. Preserve the PB-11/PB-12 endpoint contract for session, eligibility, profile/media, discovery, relationships, matches, Messenger entry, Notifications, safety, visibility, lifecycle/deletion, verification and premium state.
3. Permit only explicit method/path pairs; unknown paths fail closed.
4. Production-shaped transport requires HTTPS and an explicit allowed-host set.
5. Do not trust `X-Forwarded-*` as independent authority inside the application adapter.
6. Cross-site requests fail closed; supplied browser Origin must exactly match the effective HTTPS host.
7. All protected routes require a bounded Bearer token.
8. Session authority is injected; missing, invalid, revoked or expired sessions fail closed.
9. Authentication dependency failure fails closed rather than creating an anonymous/fallback authority path.
10. API responses are `Cache-Control: no-store` and include defensive content/frame/referrer/CSP headers.
11. GET routes reject request bodies.
12. JSON mutation bodies are bounded to 64 KiB.
13. Profile-media bodies are bounded to 11 MiB transport size, preserving the PB-11/PB-12 10 MiB media-object policy for application handlers.
14. Content type is explicit; JSON routes reject non-JSON input and multipart media requires a boundary.
15. JSON must be UTF-8, top-level object data and reject duplicate keys.
16. Declared Content-Length mismatch fails closed.
17. Every mutating request requires a bounded Idempotency-Key.
18. Replay reservation is session-scoped and request-fingerprint-bound; duplicate reservation is rejected before application dispatch.
19. Replay-guard failure fails closed.
20. Rate limiting is injected, session/route scoped and evaluated before application dispatch.
21. Rate-limiter failure fails closed; an exceeded limit returns 429 without business dispatch.
22. Request IDs are bounded or server-generated and returned for correlation.
23. Audit emission is limited to request ID, route ID and status; tokens, bodies, subject/profile refs and protected payloads are excluded.
24. An audit-sink failure cannot cause a denied request to succeed; successful operations fail closed if required transport audit emission cannot be retained.
25. Application/domain denials map to generic transport denial without leaking private state.
26. Unexpected application dependency failures map to generic 503 without leaking internals.
27. Gateway success must include a nonnegative authority generation.
28. A gateway generation older than the authenticated session generation fails closed.
29. Successful JSON responses carry the current authority generation and request ID.
30. No public member enumeration, public relationship/safety graph, raw identity evidence, exact location or private-message content is added to the API surface.
31. No administrator force-match, force-unblock, consent-manufacture, safety-bypass or premium-bypass route exists.
32. Web/mobile clients attach mutation idempotency keys but remain presentation-only.
33. The WSGI adapter is deployment-neutral and does not embed a host, secret, token, database URL or provider credential.
34. No new PuffBuddies contract, fixed address, Registry service ID, production hostname, infrastructure manifest or live endpoint is introduced.
35. PB-15 remains owner of the next qualification phase; PB-16 remains security/privacy audit owner; PB-17+ remain live-environment owners.

## Affected components
- `puffbuddies/api/__init__.py`
- `puffbuddies/api/hardening.py`
- `puffbuddies/api/wsgi.py`
- `puffbuddies/web/api-client.js`
- `puffbuddies/mobile/core/api-client.js`
- `puffbuddies/tests/test_pb_14_backend_api_hardening.py`
- `scripts/verify-puffbuddies-pb14.py`
- `.github/workflows/puffbuddies-pb14.yml`
- roadmap/master reconciliation and durable evidence

## Qualification
PB-14 is an ordinary app-scoped hardening step and requires **Level 1 exact-head qualification**.

The PB-14 fast workflow must run:
- Python compilation;
- PB-14 targeted backend/API hardening tests;
- complete retained PuffBuddies Python regressions;
- retained PB-11 web tests/build;
- retained PB-12 mobile tests/build;
- PB-0 structure/authority verification;
- PB-13 cross-app verifier;
- PB-14 static verifier and privacy/authority negative gates.

PB-13 already completed Level-2 milestone D for the accumulated cross-app integration boundary. PB-14 does not introduce a new canonical shared dependency or lifecycle owner, so it does not create another ceremonial Level-2 milestone.

## Level-3 boundary
Full Solidity inventory, Genesis/address-authority, 420 Integrated/global, Docs/global, Geth/fault/soak, current-main reconciliation and deployment/config qualification remain deferred to complete app-phase closeout. They are not required for PB-14 Level 1.

## Dependencies
PB-0.3, PB-0.4, PB-0.5, PB-0.7, PB-0.8, PB-0.9, PB-0.11, PB-0.12, PB-0.15, PB-0.17; PB-1 through **PB-13 — 420Integrated cross-app integration — COMPLETE**.

## Exit criteria
- canonical API path exists in the reserved repository boundary;
- all PB-11/PB-12 protected endpoint contracts are explicitly routed;
- HTTPS/host/origin/session/body/content-type/replay/rate-limit policy fails closed;
- stale authority generations cannot be returned as current success;
- audit/error handling is privacy-safe and generic;
- web/mobile mutation calls participate in replay protection;
- no shadow domain authority, admin bypass or public private-state enumeration exists;
- targeted PB-14 tests and retained PuffBuddies/client regressions pass on one exact implementation SHA;
- PB-0/PB-13 authority verifiers remain green;
- durable exact-SHA evidence is recorded;
- deployment/live/testnet and Level-3 work remain explicitly deferred.
