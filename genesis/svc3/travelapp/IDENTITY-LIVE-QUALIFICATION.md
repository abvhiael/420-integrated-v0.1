# GEN-SVC-3.11.3 — live 420Identity acceptance gate

**Status: integrated Travel-side session + persistent Trips journey is testable; deployed 420Identity connection remains UNVERIFIED and NOT enabled.** Do not describe the controlled integration verifier as production 420Identity.

## What is implemented

- `identity_session.go` requires an opaque `__Host-420travel-session` cookie over a TLS request and calls `IdentitySessionVerifier.VerifyTravelSession` on every authenticated request, including reads and writes. It rejects missing/duplicate cookies, wrong audiences, expired or revoked sessions, missing subjects, and verifier outages. It does not trust browser-supplied user headers or decode unsigned JWT claims.
- `durable_trips.go` provides an owner-scoped, single-instance local-file repository whose private owner identifier is included only in its private on-disk codec. It is not a multi-node database.
- `identity_durable_journey_test.go` qualifies the **Travel-side composition**: authenticated creation, owner isolation, persistence across restart, exclusion from public indexing, cross-session CSRF rejection, fresh per-request revocation/expiry and fail-closed verifier outage. The test deliberately supplies a controlled verifier and is NOT a live service test.

## Exact external dependency before enabling authenticated Trips in deployment

Identify and verify from the owning 420Identity implementation, not an inferred URL or undocumented client headers:

1. The actual session issuance, login/logout, revocation and introspection service code and deployed version; its authenticated server-to-server transport, endpoint, request and response schemas, allowed issuer and session audience (`420travel`).
2. The canonical immutable subject identifier, expiry timestamp and session-bound CSRF token format; whether a Travel-scoped opaque host-only cookie is issued and how its lifecycle is managed without sharing an unrestricted wallet/Identity bearer token with Travel.
3. Real revocation semantics and outage behavior. The verifier must revalidate server-side authority on every protected request; no cached-positive or fail-open fallback, unsigned JWT decoding, browser identity headers or guessed API routes.
4. Trusted TLS ingress behavior. Travel's current adapter requires `r.TLS != nil`; TLS termination upstream must not be represented merely by client-controllable forwarded headers. Cookie issuance requires `Secure`, `HttpOnly`, `Path=/`, no Domain attribute and a reviewed SameSite policy.
5. Deployed acceptance: login -> create private trip -> process restart -> owner read; second user's list cannot see it; logout/revocation -> first user denied immediately; expiry, forged cookie, wrong audience, CSRF mismatch, service timeout and 420Identity outage -> no private data disclosure; session tracing must not log opaque cookies or CSRF tokens.

## Disposition

No live session-introspection endpoint or deployed issuance contract was verified in this milestone, so no guessed HTTP adapter, new synthetic Identity service or authentication-enabling environment flag is introduced. `Handler()` and `cmd/420travel` keep private Trips disabled by default. Live Identity deployment qualification remains a blocker for 3.11.3, alongside production-grade multi-instance transactional Trips storage and the later publication, Registry/Verify and Reputation gates. PR #356 must remain open and should not be represented as a production-complete Travel Genesis release on green simulated-integration CI alone.
