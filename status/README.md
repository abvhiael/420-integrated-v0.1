# 420Status

420Status is the public operational-health and incident-presentation service for 420 Integrated. It is a non-canonical observation layer: it reports health, readiness, freshness, incidents, maintenance and provenance, but it does not decide consensus, finality, settlement, balances, ownership, validator eligibility, governance state, bridge validity, oracle truth or Wallet authorization.

## Architecture

The implementation is under `status/`:

- `architecture/` — Genesis boundary and invariant model.
- `components/` — typed component registry and presentation-health model.
- `evidence/` — provider-neutral observation adapters and ingestion.
- `incidents/` — append-only incident and maintenance lifecycle.
- `aggregation/` — freshness/conflict/incident-aware component and network rollups.
- `history/` — append-only observation and incident provenance.
- `api/` — read-only public `/v1/*` JSON API.
- `security/` — identifier, payload and probe-target hardening.
- `runtime/` — configuration, dependency qualification, liveness/readiness and HTTP service.
- `web/` — embedded dependency-free public frontend.
- `cmd/status420/` — service entrypoint.
- `closeout/` — cross-phase qualification tests and retained evidence.

420Status requires no Status-specific Genesis contract and has no frozen contract address. Any Registry/discovery entry identifies a service endpoint; it does not grant protocol authority.

## Required configuration

- `STATUS_CHAIN_ID` — non-zero decimal chain ID.
- `STATUS_INDEXER_URL` — public 420Indexer endpoint used for startup qualification.

Optional:

- `STATUS_LISTEN_ADDR` — defaults to `:8422`.
- `STATUS_REQUEST_TIMEOUT` — defaults to `5s`.
- `STATUS_MAX_EVIDENCE_AGE` — defaults to `2m`.

Probe URLs are validated against SSRF/private-network targets and revalidated at dial/redirect time.

## Build and test

From a clean checkout with Go 1.23:

```sh
go test -count=1 ./status/...
go test -race -count=1 ./status/...
go vet ./status/...
go build ./status/cmd/status420
```

The dedicated `420Status Audit Qualification` workflow performs these checks against the exact pull-request head.

## Run locally

A real reachable 420Indexer endpoint is required for successful startup qualification.

```sh
export STATUS_CHAIN_ID=420
export STATUS_INDEXER_URL=https://indexer.example
go run ./status/cmd/status420
```

The process exposes `/healthz`, `/readyz`, the read-only `/v1/status`, `/v1/components`, `/v1/incidents`, `/v1/maintenance`, `/v1/history` API surface, and the embedded public frontend.

Readiness is deliberately stricter than liveness. Wrong-chain, stale, future-dated, unavailable or unready dependency evidence keeps the service unready.

## Public API and privacy

All public responses are non-canonical and declare `canonical:false`. Only public components are projected. Raw free-form observation summaries and private components are not serialized to the public feed. Public history preserves bounded provenance and canonical/protocol references without exposing secrets or private payloads.

There are no public mutation endpoints. Incident/operator mutation remains an operator-side concern and must not be exposed as protocol authority.

## Deployment order

420Status is deployed after the canonical network and the public dependency surfaces it observes are available. A safe production-equivalent testnet sequence is:

1. establish the target chain/genesis identity;
2. deploy and qualify canonical RPC and 420Indexer;
3. configure public component endpoints and environment/network identity;
4. start `status420` and verify `/healthz`;
5. confirm `/readyz` only becomes ready with fresh matching Indexer evidence;
6. exercise outage, stale-evidence, conflicting-evidence, incident, maintenance and recovery cases;
7. publish the public Status endpoint/frontend;
8. retain exact-release deployment and operational evidence.

420Status must not be used as a prerequisite for canonical protocol operation. If the Status service is unavailable, canonical protocol services continue and operators fall back to direct canonical/health interfaces.

## Operational recovery

Recover authority outward: consensus/execution and canonical protocol dependencies first, then RPC/Indexer-derived surfaces, then 420Status, and finally downstream notification delivery. A green Status page is not sufficient proof of protocol recovery.

## Security assumptions

The service trusts canonical/protocol references only as references; observations themselves remain non-authoritative. Conflicting fresh observations fail closed to unknown/degraded presentation. Probe targets are untrusted network inputs. Public payloads must exclude credentials, keys, private Identity data, private message/AI content, raw Attention telemetry and user delivery endpoints.

## Release states

Repository implementation can be code/build/test/documentation complete without being live-testnet, Genesis-deployment or production ready. Live readiness requires a production-equivalent deployment with real endpoints, network identity, incident/recovery exercises and exact-release retained evidence.

Canonical roadmap: `docs/420STATUS-ROADMAP.md`.
Infrastructure authority model: `docs/architecture/infrastructure/observability-status-operator-services.md`.
Audit record: `docs/420STATUS-AUDIT.md`.
