# GEN-SVC-3.11.10 — Travel integration and staging release gates

Status: **IN PROGRESS / NOT PRODUCTION QUALIFIED.** CI tests and injected adapters are not evidence of a live 420Identity endpoint, real Registry/Verify or Reputation evidence, PostgreSQL failover, or a mobile/browser accessibility audit.

## User journeys wired in this branch

- `cmd/420travel` mounts `PublicTravelHandler`: public discovery, public Location/Events place and event pages, and the public map/list route. No Identity/session service or private repository is created by this binary.
- `HandlerWithQualifiedJourneys(reader,reviews,users,shares)` is the explicit composition for an authorized deployment. It supplies map/list, verified-review pages only with a trusted review adapter, owned Trips create/list/edit, owner-scoped unlisted share issue/revoke, and business claim submission only with independently verified ClaimRepository + session identity.
- Authenticated trip list links to the existing trip editor, and shows unlisted share/revoke POST controls only when share repository, grant store and publication verifier are all configured. Creation and share mutations retain session-bound CSRF and owner checks. Shared URLs are secrets; never store plaintext tokens in logs, referrers, analytics or public indexes.
- Saved place/event IDs remain manual editor inputs and are **not yet** wired to one-click public-place/event save actions. PublishedTripVerifier and ClaimProvenance are trusted interfaces, not deployed-service evidence. Public-trip listing needs separate policy review.

## Deployment prerequisites — verify against actual endpoints before enabling private routes

1. **Identity:** HTTPS ingress; Travel-scoped opaque host-only session cookie; independently verified session on every private request; audience, expiry and revocation tests; forged CSRF, Origin and session failures. A testIdentity mock does not qualify a live 420Identity service.
2. **Trips and shares:** provision PostgreSQL with migrations `001_travel_trips.sql` and `002_travel_trip_shares.sql`, scoped runtime DB role, two independent Travel processes, TLS and timeouts. Test competing writes and CAS, inter-process issue/revoke, expired links, private/public visibility transitions, process crash, backup restore and migration rollback. Single-instance DurableTripStore is a staging fallback, not horizontal persistence qualification.
3. **Public Location/Events:** connect trusted public reader; test withdrawal between saves and reads, kind/coordinate precision, malformed projection, events whose place is withdrawn and service outage. Never project approximate places as pins; verify only public IDs in shared and public trips.
4. **Claims:** apply `003_travel_claims.sql`, connect trusted reviewer authorization and canonical Identity/Location/Registry/Verify provenance; test rejection, conflicted claims, evidence expiration/revocation, reviewer self-approval, replay and audit trail. Travel claim approval must not change Location page authority.
5. **Reputation:** connect actual Reputation service with subject validation, live moderation and independent interaction verifier; test verified/hidden/withdrawn and evidence-revoked records, stale projection and network failure. An injected in-process adapter does not prove live service qualification.

## Final security, recovery and UX qualification (not yet demonstrated)

- Two browser sessions with separate owners and an anonymous client: read/modify/delete attempts on each other's Trips, claims and sharing links must fail indistinguishably from nonexistent records. Test CSRF, Host/Origin mismatch, non-GET mutation attempts, oversized forms, invalid IDs and rate limiting.
- Crash/restart both instances, lose DB and external dependencies, restore encrypted backup, replay migrations transactionally and validate least-privilege credentials. Measure recovery objectives, alerting and trace-redaction rather than claiming a tested RTO/RPO without evidence.
- Desktop/mobile browser and keyboard/screen-reader run through `/travel`, `/travel/events`, `/travel/map`, public place/reviews, authenticated trips and claim submission. Verify focus order, form errors, zoom/reflow at narrow widths, no-JS map list, accessible share-link handling and no unexpected third-party requests.
- Operator evidence: precise staging hostname, deploy SHA, service versions and endpoints (without secrets), migration checksums, timestamped test runs, backup/restore report, monitoring dashboards, incident procedure and signed release decision.

**Merge gate:** Keep PR #356 open until these live acceptance artifacts exist. CI passing on an opt-in route or mock is not production proof. DOOBR and 420BnB transactions remain disabled.
