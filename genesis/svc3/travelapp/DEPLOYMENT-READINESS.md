# GEN-SVC-3.11.10.2 — public deployment readiness (first integration slice)

Status: **partial implementation, NOT live-service or multi-instance qualified**.

`cmd/420travel` accepts `TRAVEL_DEPLOYMENT_MODE=development|staging|production` (unset means development), `TRAVEL_PUBLIC_SERVICE_URL` and `TRAVEL_LISTEN_ADDR`. Staging/production mode refuses startup if the public feed is missing, unparseable, carries embedded credentials or a query/fragment/path, or does not use HTTPS. Development allows an HTTP loopback feed only. No environment variable enables private Trips, sharing, claims, review or booking routes: they require separately qualified Identity, PostgreSQL and upstream adapters. Never store secrets in service URLs.

`GET /readyz` performs a bounded fresh public Location/Events projection read. It returns 503 when the feed is missing or unavailable, and its success text explicitly says private features are disabled. This readiness check is **not** live proof of Identity, PostgreSQL, Registry/Verify, Reputation, publication revocation guarantees, or a complete production release.

Remaining work before 3.11.10.2 can close:

1. Wire independently verified 420Identity introspection and private route authorization to an HTTPS staging ingress with correct audience, expiry and revocation behavior.
2. Provision shared PostgreSQL, apply and checksum migrations 001/002/003, use a least-privilege TLS DB role, and test owner-scoped writes and sharing between two independently running Travel processes.
3. Implement a production `PublishedTripVerifier` that validates current public place/event projections on every shared or public read; disable sharing if current publication/revocation cannot be established.
4. Connect trusted Registry/Verify/Identity claim provenance and independently authenticated reviewers, including revocation/conflict checks. Claim approval never grants place editing rights.
5. Connect real Reputation read and evidence verification, including active moderation and revocation checks. Show no stale verified badges on upstream failure.
6. Capture staging URLs, exact deployed SHA, service versions, nonsecret config, current dependency probes, multi-instance SQL test outputs and feature enable/disable matrix. Do not mark this milestone complete on mock CI alone.

See `GEN-SVC-3-ROADMAP.md` and `GEN-SVC-3.11.10-RELEASE-GATES.md` for subsequent privacy, recovery, browser and release qualification.
