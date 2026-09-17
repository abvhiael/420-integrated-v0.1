# 420Status Genesis Roadmap

420Status is the public operational-health and incident-presentation layer for 420 Integrated. It aggregates live evidence about network, protocol, infrastructure and application services without becoming canonical authority for consensus, execution, settlement, ownership, validator eligibility, governance, bridge validity, oracle truth or Wallet authorization.

## GEN-10.8 status

- **STATUS-0 — Genesis boundary + executable invariant baseline — COMPLETE**
- **STATUS-1 — runtime/service scaffold — COMPLETE**
- **STATUS-2 — component registry + health model — COMPLETE**
- **STATUS-3 — evidence ingestion + source adapters — COMPLETE**
- **STATUS-4 — incident lifecycle + severity model — COMPLETE**
- STATUS-5 — aggregation, freshness + degraded-state engine — pending
- STATUS-6 — history, provenance + canonical references — pending
- STATUS-7 — API + public status feed — pending
- STATUS-8 — privacy/security + anti-spoofing hardening — pending
- STATUS-9 — Genesis frontend — pending
- STATUS-10 — qualification, reconciliation + closeout — pending

## STATUS-0 — Genesis boundary + executable invariant baseline

Freeze service identity `420/service/status/v1`, require no Status-specific Genesis contract and encode the authority, evidence, privacy, incident and provider-neutrality boundaries in executable Go tests and Genesis configuration.

### Genesis invariants

- **STATUS-INV-001** — 420Status owns no canonical protocol state and requires no Status-specific Genesis contract.
- **STATUS-INV-002** — status observations, dashboards and incidents are operational evidence only and never determine finality, settlement, balances, ownership, validator eligibility, governance state, oracle truth or bridge validity.
- **STATUS-INV-003** — every component observation identifies network/environment, source, observation time and freshness context.
- **STATUS-INV-004** — canonical or protocol references are preserved where available, but a status observation cannot rewrite the referenced canonical state.
- **STATUS-INV-005** — liveness and readiness are distinct; a live component may still be unready, degraded or unavailable for its intended role.
- **STATUS-INV-006** — conflicting observations fail closed to an explicit unknown/degraded presentation state and are resolved against canonical or authoritative domain sources, never by whichever result makes the dashboard green.
- **STATUS-INV-007** — incident severity and lifecycle are coordination/presentation state only and cannot weaken consensus, verification, authorization or settlement rules.
- **STATUS-INV-008** — private keys, signer/JWT credentials, provider secrets, private message content, private Identity data, raw private AI content, raw Attention telemetry and user delivery endpoints are excluded from public status payloads.
- **STATUS-INV-009** — 420Status failure or unavailability cannot block payments, swaps, bridges, governance, staking, contract interaction or canonical node operation.
- **STATUS-INV-010** — alternate status clients and operators may independently derive health from the same public/canonical evidence; 420Status is not a monopoly on operational truth.
- **STATUS-INV-011** — stale observations must be distinguishable from healthy fresh observations and may not remain green indefinitely after evidence expires.
- **STATUS-INV-012** — planned maintenance is distinct from unplanned incident degradation and cannot disguise an active safety or integrity fault.
- **STATUS-INV-013** — public incident/history updates are append-only or auditable; corrections and recoveries preserve prior incident evidence rather than silently rewriting history.
- **STATUS-INV-014** — notifications derived from 420Status remain downstream, opt-in and non-authoritative; failure of 420Notifications does not alter Status evidence or protocol state.

## STATUS-1 — runtime/service scaffold

Implemented configuration validation, service lifecycle, `/healthz` and `/readyz`, chain identity validation, public 420Indexer probing and fail-closed startup. The runtime entrypoint is `status/cmd/status420`.

Readiness is deliberately stricter than process liveness: the configured chain must match the public 420Indexer identity, the Indexer must report ready, and its status evidence must carry a sufficiently recent observation timestamp. Stale, future-dated, missing, wrong-chain or unavailable dependency evidence leaves 420Status unready rather than presenting a misleading healthy surface.

Required environment:

- `STATUS_CHAIN_ID`
- `STATUS_INDEXER_URL`

Optional environment:

- `STATUS_LISTEN_ADDR` (default `:8422`)
- `STATUS_REQUEST_TIMEOUT` (default `5s`)
- `STATUS_MAX_EVIDENCE_AGE` (default `2m`)

Health/readiness responses explicitly report `canonical: false`; service qualification never grants consensus, execution, Wallet or protocol authority.

## STATUS-2 — component registry + health model

Implemented a typed component registry under `status/components` for consensus, execution, RPC, Indexer, Explorer, Search, Analytics, storage/resource services, AI compute, oracle, bridge, Wallet-facing and registered dApp classes.

The registry rejects invalid or duplicate component identities and produces deterministic ID-sorted listings. Component identity includes network and environment so testnet, development and future production observations cannot be silently mixed.

STATUS-2 also defines presentation health separately from process liveness/readiness. Supported presentation states are `healthy`, `degraded`, `unavailable`, `maintenance` and `unknown`. A component cannot validate as healthy unless it is both live and ready; planned maintenance requires an explicit reason; and every snapshot rejects `authoritative: true` so presentation state cannot acquire protocol authority.

## STATUS-3 — evidence ingestion + source adapters

Implemented typed noncanonical observations under `status/evidence`, including component/source/network/environment identity, health/liveness/readiness, observation and expiry timestamps, summaries and preserved protocol/canonical references.

Provider-neutral `Probe` and `ProbeSource` interfaces allow consensus/execution/RPC, 420Indexer, health/readiness and future manifest-backed sources to feed the same evidence pipeline without granting any adapter protocol-write authority. Probe failures are isolated and do not fabricate evidence.

The ingestor binds each observation to a registered component and configured network/environment, rejects unknown components, source-identity mismatches, wrong-network evidence, future-dated observations, invalid freshness windows, partial references and any `canonical: true` authority claim. Latest evidence is retained per component/source with deterministic ordering for downstream aggregation.

## STATUS-4 — incident lifecycle + severity model

Implemented typed incident coordination under `status/incidents` with `INFO`, `WARN`, `MAJOR` and `CRITICAL` severities; `open`, `monitoring` and `resolved` lifecycle states; affected-component sets; evidence references; mitigation notes; planned-maintenance windows; and explicit recovery timestamps.

Incident histories are append-only. The first update must open the incident, updates cannot move backward in time, resolved incidents are immutable, and a resolved record cannot be silently reopened. Corrections therefore require a new auditable incident/update rather than history replacement. Incident updates explicitly reject protocol-authority claims.

Planned maintenance is modeled separately from unplanned incidents and requires a bounded start/end window. The in-memory store returns deterministic active-incident ordering and defensive copies so callers cannot mutate stored history out of band.

## STATUS-5 — aggregation, freshness + degraded-state engine

Aggregate component observations deterministically. Enforce freshness TTLs, explicit unknown state on missing/conflicting evidence, severity-aware rollups and failure isolation so one broken probe does not fabricate a network-wide outage. A green rollup must be supported by fresh evidence.

## STATUS-6 — history, provenance + canonical references

Store rebuildable noncanonical history for observations, incidents and recoveries. Preserve source provenance, chain/environment identity, block/slot/tx/checkpoint references where applicable and auditable correction/recovery transitions.

## STATUS-7 — API + public status feed

Expose read-only component status, aggregate network status, active incidents, maintenance windows and historical incident/recovery feeds with deterministic pagination. Mutating incident/operator endpoints, if present, remain authenticated operator controls and never protocol authority.

## STATUS-8 — privacy/security + anti-spoofing hardening

Enforce public-payload minimization, source binding, hostile metadata validation, bounded payloads, SSRF-safe probe targets, rate/abuse controls and explicit protection against forged component identity or misleading green-state claims.

## STATUS-9 — Genesis frontend

Build the public status page with network banner, component grid, freshness indicators, active incidents, planned maintenance, incident history, provenance/evidence links and explicit language distinguishing operational health from canonical protocol truth.

## STATUS-10 — qualification, reconciliation + closeout

Run the full invariant suite, source-conflict/freshness tests, incident lifecycle tests, restart/failure injection, privacy/security checks and provider-failure isolation. Produce testnet readiness evidence, reconcile the long-lived branch with latest `main`, requalify the exact final head and merge once at phase end.
