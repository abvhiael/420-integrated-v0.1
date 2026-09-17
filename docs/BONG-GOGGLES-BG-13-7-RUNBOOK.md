# Bong Goggles BG-13.7 — Production Media Delivery Runbook

BG-13.7 closes the Bong Goggles media/storage delivery phase without introducing a parallel CDN, storage or media protocol. Bong Goggles consumes the existing 420Storage v1 developer API, 420Gateway cache-first/store-fallback routing, 420Cache acceleration, 420Repair recovery and 420Media derivative pipeline.

## Launch boundary

- Canonical media identity remains the verified Bong Goggles descriptor plus complete 420Storage object identity.
- Cache/CDN state, route tier, provider ID, node ID, latency and runtime health are operational evidence only.
- Public verified current media may be served with `Cache-Control: public, max-age=31536000, immutable` because the cache key is derived from immutable object identity.
- Private media is always `private, no-store`; authorization is revalidated before retrieval and never converted into durable cache permission.
- Unverified or non-current presentation media is `no-store`.
- Gateway/Cache failure never authorizes bypass of object-integrity verification, social policy or canonical retrievability checks.

## Required telemetry

Track at minimum:

- request/success/failure counts;
- p50, p95 and p99 delivery latency;
- cache-tier and store-tier success counts;
- integrity failures separately from routing/provider failures;
- private authorization denials separately from storage failures at the application boundary;
- upload, retrieval and derivative-processing qualification results.

Structured logs must be secret-free. Authorization headers, cookies, bearer/basic credentials, passwords, private keys, session identifiers, tokens and credential fields are redacted before emission.

## Failure drills

Before launch, exercise and retain evidence for all of the following:

1. **Cache loss:** cache tier unavailable; Gateway falls through to a valid Store source and returned bytes still pass full object verification.
2. **Provider loss:** a discovered provider/node becomes unavailable; another valid source succeeds or delivery fails closed without fabricated success.
3. **Retrieval failure:** all valid routes fail; Bong Goggles returns a delivery failure and records a route failure rather than stale/unverified bytes.
4. **Integrity failure:** wrong size or shard root is returned; delivery fails closed and increments integrity-failure telemetry.
5. **Private-access revocation:** a previously eligible viewer loses social authorization; a fresh delivery request is denied.
6. **Derivative retirement:** a retired/superseded derivative is excluded from current presentation without deleting immutable storage/provenance history.

A drill passes only when the expected failure or fallback is actually observed. A drill that unexpectedly succeeds when failure was required is a failed drill.

## Load qualification

Run bounded production-like tests for:

- upload prepare/ingest;
- verified retrieval through Gateway/Cache;
- representative image/video derivative jobs through 420Media.

Capture request count, concurrency, failures and p95 latency. Launch readiness requires every declared qualification to remain within its configured failure and latency budget. Qualification results are non-authoritative operational evidence and do not replace canonical protocol state.

## Responsive delivery

Responsive image/video source sets are chosen only from the verified descriptor: the original item plus explicitly linked thumbnail/poster/preview/transcode derivatives in the same media family. Candidates are deterministic and preserve their complete canonical storage identity. A responsive choice never rewrites the original object or derivative provenance.

## Launch decision

BG-13 media delivery is launch-ready only when:

- all required failure drills pass;
- all required load qualifications pass;
- no integrity failure remains unresolved in the qualification evidence;
- Bong Goggles Media Verification, 420Docs Qualification and 420 Integrated Qualification are green on the exact final BG-13 branch head;
- the branch is reconciled with current `main` and requalified before merge.

BG-13.7 readiness is an application operations decision. It does not confer Registry, Wallet, storage-settlement, media-job or social-policy authority.
