# RR-7 — Newsfeed Security

## Canonical scope
SSRF/redirect/DNS-rebinding controls, parser hardening, sanitization, source allowlisting, fetch limits, copyright/attribution enforcement and adversarial ingestion tests.

## Implemented protection
- The normal news-sync executable uses `FeedFetcher{}` and a guarded production HTTP client.
- HTTPS-only direct feed endpoints, no embedded credentials, no localhost/local-domain or non-public literal IPs.
- Resolver addresses are examined at connection time; private, loopback, link-local, reserved/test and carrier-grade NAT networks are rejected. Connection is made directly to the checked IP with HTTPS hostname semantics retained.
- Redirect responses are rejected, rather than following a chain to an unreviewed destination.
- The preexisting bounded 2 MiB feed body and DTD/ENTITY rejection remain enforced; RSS/Atom entry counts are capped at 500.
- HTML entities are decoded before markup stripping; plain-text metadata is retained for excerpts. Source registry remains reviewed, HTTPS-only, with explicit per-source attribution, excerpt/image flags and minimum polling interval.
- Tests cover non-public endpoints, unexpected redirects, oversize responses, DTD/entity payloads and retained ingestion functionality.

## Important qualification limits
- A deliberately injected `FeedFetcher.HTTP` test/deployment override supplies its own transport. Such a custom transport cannot be considered production-qualified merely because `FeedFetcher.Fetch` runs; callers must use the guarded default client in production. The one-shot production sync path does so.
- No live provider or production deployment security evidence is claimed.
- This is repository-stage security work, not RR-8 scheduling or RR-9 deployed operations.
- Static audit evidence is not a substitute for successful exact-head Go tests, race, vet and security verifier.

## Current qualification
**PENDING exact-implementation-SHA RR-7 Level 1 CI.** Do not mark RR-7 COMPLETE on an unverified SHA. Level 2 remains milestone-based; Level 3 remains RR-10.

## Next canonical step
**RR-8 — Feed Operations** (only after RR-7 qualifies).
