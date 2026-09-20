# GEN-SVC-2.20 — Security and integration qualification

Scope: the Location/Events public read-only HTTP API (`genesis/svc2/httpapi`), the Go SDK, their canonical source adapters, and the Location/Events public UI projections. This checklist is **not** a production security certification. Passing CI qualifies only the tests actually run in the repository.

## Implemented, exercised by automated tests

- Public place projection excludes private and unlisted records. An approximate public place cannot expose coordinates or an exact map pin. Exact coordinates require `EXACT_PUBLIC_PLACE` and public visibility.
- The public event projection rechecks canonical event visibility, lifecycle status, and version against cached discovery entries. A record made private, cancelled, version-changed, or deleted after indexing is not returned by the public HTTP response.
- HTTP endpoints support only `GET /v1/places` and `GET /v1/events`; mutation methods are rejected. Unsupported, repeated, out-of-range, or malformed query parameters fail closed.
- Responses use JSON, `Cache-Control: no-store`, and `X-Content-Type-Options: nosniff`. Neither the HTTP handler nor the SDK has authority to mutate canonical Location/Events records.
- Regression coverage: `genesis/svc2/httpapi/security_integration_test.go`, `genesis/svc2/httpapi/handler_test.go`, `location/uikit/map_test.go`, `events/uikit/events_test.go`; dedicated workflow runs Go tests and vet across Location, Events, and `genesis/svc2`.

## Remaining deployment/integration gates (NOT certified by unit CI)

- Bind the HTTP handler to an authenticated/authorized production gateway, or explicitly approve a public-only deployment. Require TLS, request and response size limits, rate limiting, observability, audit logging, and abuse controls at the actual ingress. Confirm the deployment identity cannot access private records beyond its read scope.
- Ensure discovery index rebuilds are triggered by canonical event create/update/delete and recurrence-exclusion changes, and constrain indexed and query windows. A stale index may omit newly added public events; canonical checks prevent exposure of events that have since become non-public.
- Validate recurrence occurrence integrity and exclusions/cancellations against the canonical recurrence rule at response time, or enforce atomic publication of the canonical snapshot and rebuilt discovery index. A matching event version alone is not a substitute for a verified occurrence schedule.
- Verify all clients use the server-produced public projection and do not receive raw canonical place/event records; test rendered browser/mobile pages, map tile and geocoding provider requests, and third-party SDK integrations for coordinate leakage.
- Run race tests and load tests using representative location/event datasets and actual gateway limits; test retention, operational rollback, and incident procedures. Re-run CI on the final merge commit.

## Qualification status

The feature-branch implementation and regression tests are submitted for GitHub Actions qualification. Production readiness, deployed HTTP accessibility, configured map provider, notification delivery, and end-to-end consumer qualification are separate gates and are **not** implied by green repository CI.
