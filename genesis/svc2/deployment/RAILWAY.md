# GEN-SVC-2 public server — deployment and acceptance

This is a **read-only, single-process staging entry point**, not a canonical publisher or evidence of live records. Its handlers come from [the existing public HTTP API](../httpapi/handler.go). The executable is [`cmd/420svc2-public/main.go`](../../../cmd/420svc2-public/main.go).

## Prerequisites and variables

An authorized, independently qualified canonical Location/Events publisher must provide the existing `420-location-place-store-v1` and `420-events-store-v1` file snapshots. They must be mounted at persistent paths accessible to this service. No test fixtures, blank files, self-generated data, or writable repository assets qualify as published live records. A publisher must atomically replace each snapshot and maintain publication, withdrawal, event cancellation and recurrence-exception consistency. The two stores are **not** an atomic cross-store snapshot; concurrent publisher updates must be coordinated before consumer release. There is no publisher/deployment provenance integration in this PR; `SVC2_PUBLICATION_SOURCE` is an operator-supplied label, not a security attestation.

| Variable | Value |
| --- | --- |
| `SVC2_LISTEN_ADDR` | `0.0.0.0:8080` (if Railway Networking target port is 8080) |
| `SVC2_PLACES_SNAPSHOT` | Absolute path to existing canonical place snapshot on a persistent mounted volume |
| `SVC2_EVENTS_SNAPSHOT` | Absolute path to existing canonical event snapshot on a persistent mounted volume |
| `SVC2_PUBLICATION_SOURCE` | The **actual**, independently verified canonical publisher identifier; do not invent one |

Use repository root as build context and branch `feature/gen-svc-2-public-deployment` for isolated staging. Start command: `go run ./cmd/420svc2-public`. Configure a Railway HTTPS public domain with target port 8080. Do not point either snapshot path at a GitHub fixture or the ephemeral application filesystem. The executable refuses startup on missing/empty/unreadable/corrupt canonical snapshots or missing source identification. It does not expose public mutation routes or enable private audience reads.

## Qualification

`GET /readyz` verifies current snapshot availability and decoding. It is **storage readiness**, not proof of published events, identity, replication health, or authoritative provenance. `GET /v1/places` and `GET /v1/events?from=<RFC3339>&to=<RFC3339>&limit=100` expose the public projections. The event discovery index is rebuilt from a freshly read canonical event snapshot for the requested interval on each request; failed rebuilding returns an unavailable status on valid intervals. All responses are no-store.

Before connecting Travel, independently verify the publisher's actual data and its provenance; test real publication, withdrawal, cancellation, recurrence exceptions, restart/persistence, private/approximate coordinate safety, multi-snapshot consistency, upstream and storage outage behavior, and HTTPS. Then set Travel's `TRAVEL_PUBLIC_SERVICE_URL` to **this service's** verified HTTPS origin. The downstream Travel `/readyz` must return 503 when this feed is inaccessible.

**Do not deploy as a production-complete authoritative feed on the basis of repository CI or an HTTP 200 containing empty `items`.** This branch intentionally does not invent a real publisher or its records.
