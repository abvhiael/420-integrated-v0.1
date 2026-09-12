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
- [x] **DOC-10.9 — Determinism and freshness qualification** — add unified byte-for-byte stale-output detection across every DOC-10 generated family, emit output SHA-256 identities during qualification, and make 420Docs Qualification run the freshness gate whenever documentation or generated-reference implementation sources change.
- [ ] **DOC-10.10 — Reference coverage audit and closeout** — verify every required generated family, provenance marker, environment boundary and DOC-8/DOC-9 cross-link before phase merge.

## DOC-10.1 completed foundation

DOC-10.1 establishes `docs/reference/index.md`, `generation-model.md`, `source-inventory.md`, `reference-sources.json`, `scripts/generate-reference-docs.py`, and the first generated source manifest.

## DOC-10.2 completed contract reference

DOC-10.2 generates `contracts.md` from the checked-in Developer Hub catalogue plus Solidity source. The only checked-in catalogue is local/example scoped and lacks qualified distributable ABI evidence, so ABI publication fails closed rather than presenting example values as canonical deployment data.

## DOC-10.3 completed event/error reference

DOC-10.3 generates catalogue-bounded event/error indexes with canonical signatures, indexed positions, Ethereum Keccak-256 topics and custom-error selectors when types normalize unambiguously. Ambiguous/user-defined types remain unresolved rather than guessed.

## DOC-10.4 completed RPC reference

DOC-10.4 generates `rpc.md` from `420-rpc/src/methods.ts` and `request-policy.ts`, covering the explicit public compatibility surface, parameter rules and public exclusions while keeping Engine/admin/signer namespaces out of public reference.

## DOC-10.5 completed Indexer/API reference

DOC-10.5 generates `indexer-api.md` from the stable Indexer route/transport/query/operational sources, including all public GET routes, envelopes, filters, keyset pagination and readiness/status provenance with `authoritative: false` preserved.

## DOC-10.6 completed SDK/CLI reference

DOC-10.6 generates `sdk-cli.md` from the SDK and CLI packages, recording exported integration surfaces, chain/catalogue checks, Wallet/Smart Account boundaries, stable command forms and signer-secret isolation.

## DOC-10.7 completed network/chain registry reference

DOC-10.7 generates `networks.md` from the checked-in network manifest, schema and discovery implementation. Only the local environment is currently available. Devnet, testnet and mainnet remain explicitly unavailable/fail-closed, and local chain ID/endpoints/contract hints are never promoted into those absent environments.

## DOC-10.8 completed canonical deployment reference

DOC-10.8 adds `deployments.md` plus `reference_deployment_renderer.py`. Deployment plans remain noncanonical (`canonicalDeploymentProof: false`), recorded receipts still require canonical RPC confirmation, and 420Verify results are evidence rather than audit/registration/protocol authority. Because the checked-in deployment request, release candidate and catalogue are example-scoped—and the catalogue's artifact/interface/ABI evidence is not distributable—the generated canonical deployment table intentionally contains no publishable local/devnet/testnet/mainnet deployments.

## DOC-10.9 completed determinism/freshness qualification

DOC-10.9 adds `scripts/qualify-generated-reference.py` as the unified qualification surface for all committed DOC-10 outputs. It loads the original contract/event/source-manifest generation plan plus the RPC, Indexer, SDK/CLI, network and deployment family renderers, computes every expected page in memory and compares committed output byte-for-byte. `--write` can regenerate the complete generated set; normal/`--check` mode fails closed on any missing or stale output and prints deterministic SHA-256 identities for the expected pages.

`420Docs Qualification` now runs this freshness gate before the strict MkDocs build. Its path filters include the generated docs, generator/check scripts, Solidity contract sources, 420RPC/420Indexer source, SDK/CLI source, and the Developer Hub manifest/catalogue/deployment/verification inputs that can change generated output. This makes stale generated reference a documentation qualification failure while leaving broader documentation quality policy and repository-wide documentation CI expansion to DOC-12.

## Phase exit condition

DOC-10 is complete when a developer can navigate from DOC-8/DOC-9 task documentation into machine-derived exact reference for verified contracts/ABIs/NatSpec, events/errors, public RPC, stable service APIs, SDK/CLI, environment identity and approved deployments; every generated page is reproducible from identified sources, environment-scoped where applicable, marked generated, and fails closed on missing/ambiguous/unverified inputs.
