# GEN-SVC-3.11.10.2 — live integration qualification record

Status: **BLOCKED — live services and multi-instance acceptance NOT demonstrated**.
Parent implementation: GEN-SVC-3.11.10.1 PR #597 (stacked; must qualify and reconcile before merging this work).
This record is an app-scoped evidence and deployment gate, not a production approval or substitute for endpoint tests.

## Repository-side components already present

- Public service ingress validation and fresh `/readyz`: `deployment_readiness.go` and `cmd/420travel/main.go`. The executable does **not** initialize any private route.
- Session-verifier interface and host-only Travel cookie policy: `identity_session.go`; no deployed introspection URL.
- PostgreSQL trip CRUD and conditional updates: `sql_trips.go`, migration 001.
- PostgreSQL hashed share grants: `sql_trip_shares.go`, migration 002.
- PostgreSQL claim submission, reviewer authorization, serializable decision and audit record: `sql_claims.go`, migration 003.
- Current public-references verifier: `published_trip_verifier.go`; upstream publication freshness and snapshots not independently qualified.
- Read-only Reputation adapter: `reputation_adapter.go`; independently authenticated live moderation and interaction proof not qualified.
- Claims owner/status and optional reviewer HTTP boundary in stacked PR #597; independent external reviewer grant authority not connected.

## Live prerequisites (do not replace these with mocks)

| Release gate | Required evidence | Observed status |
|---|---|---|
| Live Travel staging deployment | HTTPS URL, deployed binary SHA, revision, startup config without secrets | MISSING |
| Identity introspection | Audience, expiry, revocation, cookie scope and signed/verifiable session evidence | MISSING |
| Public Location/Events service | Authenticated trusted service endpoint, publication and withdrawal contract, API version | MISSING |
| Shared PostgreSQL | Service/database instance, TLS enforcement, role privileges, 001/002/003 migration checksums | MISSING |
| Two-instance transactions | Distinct process IDs, create/edit/delete, share issue/revoke, stale CAS and conflict tests | MISSING |
| Publication revocation | Withdrawn place/event immediately rejected by shared/public trip read | MISSING |
| Registry/Verify provenance | Service identity, claimant organization and place binding, issuer and evidence revocation | MISSING |
| Independent reviewer authorization | Separate scoped role authority, self-review denied, audit rows verifiable | MISSING |
| Reputation moderation | Hidden/withdrawn review and revoked interaction proof removed; upstream outage fail-closed | MISSING |
| Operator evidence | Staging URLs, exact SHA, logs without secrets, disabled-feature matrix and run IDs | MISSING |

Connected Render workspace `reefer review` was inspected on 2026-10-09: one unrelated `reeferreview-rss-preview` service, **no PostgreSQL instances** and no Travel service were returned. Do not mutate that unrelated service or claim it is Travel infrastructure.

## Enabled-feature matrix on default Go entrypoint

| Feature | Default `cmd/420travel` |
|---|---|
| Public place/event discovery with configured trusted upstream | ENABLED (subject to upstream availability) |
| Private Trips, shares, business claims and reviews | DISABLED |
| Review/claim integrations in injected test compositions | DEVELOPMENT ONLY; NOT LIVE ACCEPTANCE |
| Booking, payment, escrow, DOOBR transaction | DISABLED — Genesis exclusion |

## Required Level 1 / Level 2 evidence

- Run `python3 scripts/validate-gen-svc-3.py`, `go test ./genesis/svc3/... ./cmd/420travel/...`, `go vet ./genesis/svc3/... ./cmd/420travel/...`, `go build ./cmd/420travel` against exact implementation SHA.
- Add live integration acceptance against **actual** providers and PostgreSQL, not only deterministic SQL-mock tests. Capture service versions, role privileges, migration checksums, two process IDs, read/write/expiry/revoke/rollback/retry logs with sensitive information redacted.
- Re-run at Level 2 app integration boundary when all authorities converge; reserve repository-wide Level 3 for GEN-SVC-3.12.
- Any failed, skipped, queued or untriggered required check remains NOT QUALIFIED.

**Determination:** CODE FOUNDATION PARTIAL; **GEN-SVC-3.11.10.2 NOT COMPLETE**, and the next roadmap step GEN-SVC-3.11.10.3 must not be represented as the current completed gate.
