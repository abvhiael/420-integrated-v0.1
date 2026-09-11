# 420 Developer Hub — DEVHUB-14 Dashboard

## Status

DEVHUB-14 adds the first browser dashboard for Developer Hub. It is a dependency-free local web surface backed by the same validated network manifest, contract catalogue and integration-guide registry already consumed by the CLI/runtime.

The dashboard is intentionally read/orchestration only. It does not become a signer, Registry authority, verification authority, wallet capability authority, or canonical protocol-state source.

## Scope

DEVHUB-14 adds:

- `developer-hub/src/dashboard-model.mjs` — deterministic dashboard snapshot model;
- `developer-hub/dashboard/server.mjs` — localhost-only static/API server;
- `developer-hub/dashboard/static/` — dependency-free browser UI;
- `npm run dashboard` from `developer-hub/`;
- dashboard tests in the existing Developer Hub qualification workflow.

## Data model

The dashboard snapshot is generated from:

1. the selected validated network manifest;
2. the canonical contract catalogue for the same chain ID;
3. the checked-in integration-guide registry.

A network/catalogue chain mismatch fails closed.

The dashboard exposes:

- selected network, environment and chain ID;
- configured RPC endpoints;
- service discovery state for Explorer, Indexer, Verify, Status and Faucet;
- canonical contract catalogue rows and verification flags;
- integration-guide discovery;
- explicit authority-boundary summaries for deployment, verification, Indexer and app publishing.

## Local server

Run:

```text
cd developer-hub
npm run dashboard
```

The default listener is:

```text
http://127.0.0.1:4420
```

`PORT` may override the port. The server binds only to `127.0.0.1` in this phase.

The browser consumes:

```text
GET /api/dashboard
```

The endpoint is read-only and generated from local validated configuration. It intentionally exposes no mutation endpoints.

## Authority boundary

The dashboard sets:

```text
canonicalAuthority: false
```

It may display canonical configuration and point developers toward owning authorities, but it does not inherit their powers.

| Surface | Owning authority | Dashboard role |
| --- | --- | --- |
| Network identity | selected manifest + chain ID | display |
| Contract identity | canonical catalogue / Registry provenance | display |
| Protocol state | canonical RPC / owning contract | navigation/context only |
| Deployment | external signer + canonical RPC | handoff only |
| Verification | 420Verify | handoff/status framing only |
| Indexed queries | 420Indexer | projection display only |
| App registration | 420Registry governance | handoff only |
| AppStore presentation | 420AppStore catalogue | non-canonical display |
| Wallet capabilities/signing | 420 Wallet / Smart Account | no authority |

## Invariants

- **DEVHUB-INV-104** — dashboard snapshots fail closed when selected network and contract catalogue chain IDs differ.
- **DEVHUB-INV-105** — the dashboard is explicitly non-canonical even when displaying canonical configuration sources.
- **DEVHUB-INV-106** — the dashboard server exposes no signing, raw-key, mnemonic or raw-transaction submission endpoint.
- **DEVHUB-INV-107** — deployment remains an external-signer/canonical-RPC handoff; dashboard presence cannot execute a deployment.
- **DEVHUB-INV-108** — verification classification remains owned by 420Verify and cannot be fabricated by dashboard state.
- **DEVHUB-INV-109** — Indexer data remains projection-only and cannot authorize protocol state transitions.
- **DEVHUB-INV-110** — application registration remains owned by ProtocolRegistry governance; AppStore visibility remains non-canonical presentation state.
- **DEVHUB-INV-111** — declared wallet scopes displayed by the dashboard do not grant capabilities.
- **DEVHUB-INV-112** — dashboard static asset paths reject traversal outside the dashboard static root.
- **DEVHUB-INV-113** — dashboard/browser and CLI consume the same underlying validated Developer Hub configuration rather than separate authority models.

## Exit criteria

DEVHUB-14 is complete when:

1. a local browser dashboard can start without adding frontend framework dependencies;
2. its API snapshot is built from validated Developer Hub configuration;
3. chain mismatches fail closed;
4. network, services, contracts and guides are visible;
5. deployment, verification, Indexer and publishing authority boundaries are explicit;
6. browser assets expose no signing-secret or raw-transaction path;
7. tests run in the existing Developer Hub CI qualification;
8. the next phase can add logs/events/debug tooling without changing dashboard authority.

## Next

DEVHUB-15 adds logs, event inspection and debugging surfaces, building on the DEVHUB-14 dashboard while preserving canonical-chain and Indexer provenance boundaries.
