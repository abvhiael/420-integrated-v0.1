# DOC-10 — Generated Reference Documentation Roadmap

DOC-10 builds reproducible machine-derived technical reference for 420 Integrated. It is a monolithic phase: DOC-10.1 through DOC-10.10 stay on one branch and PR, then merge once after reconciliation and exact-head qualification.

## Status

- [x] **DOC-10.1 — Generation foundation and source inventory** — establish generated-reference authority rules, source registry, deterministic output layout, generator schema, `generate`/`--check` entry point and initial source manifest.
- [x] **DOC-10.2 — Contract, NatSpec and ABI reference** — generate catalogue/source contract reference, extract contract-level NatSpec and public/external source surfaces, expose ABI provenance/availability, and fail closed rather than publish example-grade or unverifiable ABI evidence.
- [x] **DOC-10.3 — Events and custom errors** — derive per-contract/global event and custom-error indexes, canonical signatures, indexed parameter positions, event topics and error selectors where source types can be normalized unambiguously; fail closed on unresolved/user-defined types.
- [x] **DOC-10.4 — RPC reference** — derive the explicit public 420RPC compatibility surface and request-policy contract from implementation source, including profiles, transports, parameter forms, upstream capabilities, submission/signature flags, JSON-RPC policy/error classes, subscription/block-selector policy and fail-closed excluded namespaces/methods without exposing private Engine/admin/signer surfaces.
- [x] **DOC-10.5 — 420Indexer and service API reference** — derive the stable public v1 route inventory, chain/global scope, query/path parameters, success/error envelopes, paging/cursor policy, route filters, readiness/status semantics and non-authoritative boundary from checked-in Indexer API implementation sources.
- [x] **DOC-10.6 — SDK and CLI reference** — derive the exported `@420/sdk` interfaces/classes/functions, Wallet adapter boundaries, primary `420` CLI command forms, runtime options/defaults and installed binaries while preserving network/catalogue binding and signer-secret isolation.
- [x] **DOC-10.7 — Network and chain registry reference** — derive environment-scoped chain identity, RPC/service discovery, manifest contract hints and environment availability from checked-in Developer Hub manifest/schema/discovery sources; publish only the local example currently present and fail closed for absent devnet/testnet/mainnet manifests.
- [x] **DOC-10.8 — Canonical deployment reference** — derive the canonical-publication evidence contract from deployment/verification controls and checked-in catalogue/deployment/release records; publish zero canonical deployments when only example-scoped/unconfirmed evidence exists rather than promoting plans, manifest hints, example addresses or unverified artifacts.
- [x] **DOC-10.9 — Determinism and freshness qualification** — unify every generated family behind a byte-for-byte stale/missing-output check, emit deterministic SHA-256 identities, and run that gate in 420Docs Qualification when generated-reference inputs change.
- [x] **DOC-10.10 — Reference coverage audit and closeout** — verify every required generated family, provenance marker, environment boundary and DOC-8/DOC-9 handoff; record the phase audit and closeout criteria.

## Completed generated families

DOC-10 now generates and qualifies:

- `generated/source-manifest.md`
- `generated/contracts.md`
- `generated/events-errors.md`
- `generated/rpc.md`
- `generated/indexer-api.md`
- `generated/sdk-cli.md`
- `generated/networks.md`
- `generated/deployments.md`

See [DOC-10 generated reference coverage audit](coverage-audit.md) for the phase-wide provenance, authority, environment and navigation audit.

## Phase exit condition

DOC-10 is functionally complete when a developer can navigate from DOC-8/DOC-9 task documentation into machine-derived exact reference for verified contracts/ABIs/NatSpec, events/errors, public RPC, stable service APIs, SDK/CLI, environment identity and approved deployment status; every generated page is reproducible from identified sources, environment-scoped where applicable, marked generated, and fails closed on missing/ambiguous/unverified inputs.

The monolithic phase merges only after reconciliation with current `main`, exact-head `420Docs Qualification`, exact-head `420 Integrated Qualification`, and confirmation that PR #229 still points to that qualified head.
