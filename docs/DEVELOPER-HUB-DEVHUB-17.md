# 420 Developer Hub — DEVHUB-17 Status & Service Health

## Status

DEVHUB-17 adds a provenance-aware operational status layer for developers. It aggregates canonical RPC reachability/chain identity, 420Indexer health/readiness/status, and manifest-discovered service reachability without turning any dashboard, probe, Indexer projection, or 420Status response into canonical protocol state.

The architecture rule is simple: canonical state determines what happened; status and observability help determine whether infrastructure appears healthy enough to use safely.

## Aggregation model

A status snapshot binds the selected chain ID and environment and records an explicit observation timestamp. It currently observes:

- canonical RPC chain identity and block-number reachability;
- 420Indexer health, readiness, and status through the DEVHUB-11 client;
- Explorer service health;
- 420Verify service health;
- 420Status service health.

Each service observation records source/provenance, liveness/readiness evidence, endpoint, observation time, and `canonicalAuthority: false` where applicable.

## Classification

DEVHUB-17 uses bounded operational classifications:

- `healthy` — the tested operational evidence is currently passing;
- `degraded` — one or more tested dependencies are impaired or not ready;
- `unavailable` — the tested service could not provide required evidence;
- `unknown` — the service is unconfigured or insufficient evidence exists.

These classifications are operational only. A red service does not prove the chain is unsafe. A green service does not prove a transaction settled, a block finalized, an application is legitimate, or an authorization is valid.

## Canonical RPC boundary

The selected RPC is used to confirm chain identity and basic chain reachability. A returned chain ID that differs from the selected Developer Hub network fails closed. RPC liveness is still not proof of consensus safety or application-level correctness.

## 420Indexer boundary

420Indexer health/readiness/status remains projection evidence with `canonicalAuthority: false`. An Indexer may be live but degraded or behind canonical state. DEVHUB-17 never upgrades Indexer output into transaction, finality, ownership, Registry, governance, or authorization authority.

## 420Status boundary

420Status is treated as another operational observation/presentation service. Developer Hub may consume it, and alternative status clients may independently derive health information. Neither Developer Hub nor 420Status becomes a monopoly on operational truth or a substitute for canonical chain verification.

## Developer surfaces

The local dashboard exposes only GET/read routes:

- `GET /api/status/view` — authority/scope metadata;
- `GET /api/status/check` — a fresh operational snapshot.

The CLI package exposes:

```text
420-status view [MANIFEST_JSON]
420-status check [MANIFEST_JSON]
```

Neither surface signs, submits transactions, mutates protocol state, overrides incidents, changes readiness, or weakens protocol safety rules.

## Invariants

- **DEVHUB-INV-148** — DEVHUB-17 status aggregation has `canonicalAuthority: false` and is operational observation only.
- **DEVHUB-INV-149** — every status snapshot is bound to the selected chain ID and environment and carries an observation timestamp.
- **DEVHUB-INV-150** — canonical RPC chain-ID mismatch fails closed rather than being reported as healthy/degraded on the wrong network.
- **DEVHUB-INV-151** — 420Indexer health/readiness/status remains projection evidence and cannot authorize protocol state transitions.
- **DEVHUB-INV-152** — generic service health cannot prove finality, settlement, ownership, authorization, Registry legitimacy, governance state, or protocol safety.
- **DEVHUB-INV-153** — unavailable service probes degrade operational status without fabricating canonical protocol failure.
- **DEVHUB-INV-154** — unconfigured or insufficiently observed services remain `unknown`; Developer Hub does not invent healthy state.
- **DEVHUB-INV-155** — dashboard status routes are GET-only and expose no mutation, signing, finality override, or authorization surface.
- **DEVHUB-INV-156** — the `420-status` CLI is read-only and does not provide raw transaction submission or safety-override commands.
- **DEVHUB-INV-157** — 420Status is a replaceable presentation/aggregation source, not canonical chain authority.

## Next

After DEVHUB-17 qualifies, DEVHUB-18 adds Developer Hub security/developer qualification: release checks, trust-boundary enforcement, reproducibility, hostile-state regression coverage, and launch qualification gates.
