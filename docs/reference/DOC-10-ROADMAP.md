# DOC-10 — Generated Reference Documentation Roadmap

DOC-10 builds reproducible machine-derived technical reference for 420 Integrated. It is a monolithic phase: DOC-10.1 through DOC-10.10 stay on one branch and PR, then merge once after reconciliation and exact-head qualification.

## Status

- [x] **DOC-10.1 — Generation foundation and source inventory** — establish generated-reference authority rules, source registry, deterministic output layout, generator schema, `generate`/`--check` entry point and initial source manifest.
- [x] **DOC-10.2 — Contract, NatSpec and ABI reference** — generate catalogue/source contract reference, extract contract-level NatSpec and public/external source surfaces, expose ABI provenance/availability, and fail closed rather than publish example-grade or unverifiable ABI evidence.
- [x] **DOC-10.3 — Events and custom errors** — derive per-contract/global event and custom-error indexes, canonical signatures, indexed parameter positions, event topics and error selectors where source types can be normalized unambiguously; fail closed on unresolved/user-defined types.
- [x] **DOC-10.4 — RPC reference** — derive the explicit public 420RPC compatibility surface and request-policy contract from implementation source, including profiles, transports, parameter forms, upstream capabilities, submission/signature flags, JSON-RPC policy/error classes, subscription/block-selector policy and fail-closed excluded namespaces/methods without exposing private Engine/admin/signer surfaces.
- [x] **DOC-10.5 — 420Indexer and service API reference** — derive the stable public v1 route inventory, chain/global scope, query/path parameters, success/error envelopes, paging/cursor policy, route filters, readiness/status semantics and non-authoritative boundary from checked-in Indexer API implementation sources.
- [x] **DOC-10.6 — SDK and CLI reference** — derive the exported `@420/sdk` types/classes/functions, Wallet/Smart Account adapter boundary, stable primary `420` CLI command forms, runtime options/defaults, installed CLI binaries and signer-secret isolation rules from checked-in package/source definitions.
- [ ] **DOC-10.7 — Network and chain registry reference** — derive environment-scoped chain identity, manifests and service-discovery data; never promote local example values into testnet/mainnet output.
- [ ] **DOC-10.8 — Canonical deployment reference** — derive approved contract deployments, versions, addresses, deployment blocks, provenance and verified artifact/ABI identities from canonical/approved records.
- [ ] **DOC-10.9 — Determinism and freshness qualification** — add generator-specific stale-output detection, source/output identity checks and CI qualification while leaving broader documentation CI to DOC-12.
- [ ] **DOC-10.10 — Reference coverage audit and closeout** — verify every required generated family, provenance marker, environment boundary and DOC-8/DOC-9 cross-link before phase merge.

## DOC-10.1 completed foundation

DOC-10.1 establishes:

- `docs/reference/index.md` as the generated-reference entry point;
- `docs/reference/generation-model.md` as the authority/provenance/determinism contract;
- `docs/reference/source-inventory.md` as the current source availability/caveat inventory;
- `docs/reference/reference-sources.json` as the machine-readable family/source registry;
- `scripts/generate-reference-docs.py` as the deterministic generator entry point with `--check` mode;
- `docs/reference/generated/source-manifest.md` as the first generated artifact and proof of the output convention.

## DOC-10.2 completed contract reference

DOC-10.2 extends the generator with `docs/reference/generated/contracts.md`. The renderer currently consumes the checked-in Developer Hub catalogue and matching Solidity source, extracts contract-level NatSpec and public/external functions, and reports artifact/interface/ABI evidence explicitly.

The only checked-in catalogue is `developer-hub/catalogue/local.example.json`. It is example-scoped, its declared `contracts/out/...` artifact and interface are not checked in, and its ABI SHA-256 value is a placeholder. Therefore the generator deliberately reports **Distributable verified ABI: NO — fail closed** rather than presenting the example address or placeholder hash as canonical testnet/mainnet ABI/deployment evidence. When qualified build artifacts/catalogues are added later, the same renderer can publish the verified ABI surface without changing the authority model.

## DOC-10.3 completed event/error reference

DOC-10.3 adds `docs/reference/generated/events-errors.md` and extends the same generator to extract events and custom errors from catalogue-bounded Solidity source. It publishes canonical ABI signatures, indexed event parameter positions, Ethereum Keccak-256 `topic0` values and four-byte custom-error selectors only when the source types are unambiguous.

The generator includes an internal Ethereum Keccak-256 implementation with known-vector self-checks for the empty-string digest and ERC-20 `transfer(address,uint256)` selector. This avoids accidentally substituting NIST SHA3-256 and avoids a new runtime dependency. Elementary Solidity ABI types are normalized (`uint`→`uint256`, `int`→`int256`); source enums are normalized to their ABI integer representation for signature derivation. Any user-defined/ambiguous type fails closed to an unresolved signature rather than being guessed.

## DOC-10.4 completed RPC reference

DOC-10.4 adds `docs/reference/generated/rpc.md` and binds the RPC source inventory to `420-rpc/src/methods.ts` plus `420-rpc/src/request-policy.ts`. `scripts/reference_rpc_renderer.py` deterministically derives the public compatibility list, method profile, HTTP/WebSocket transport, positional parameter form, required upstream capability, chain-mutation flag and user-signature requirement.

The generated reference also records request-envelope rules (`-32600`, `-32601`, `-32602`), accepted block selectors, allowed subscription kinds and the explicit public exclusions. `engine_`, `admin_`, `personal_`, `debug_`, `miner_` and `txpool_` namespaces are outside the public surface, as are node-managed account/signing methods such as `eth_sendTransaction`, `eth_sign`, `eth_signTransaction`, `eth_accounts` and `eth_coinbase`. Result schemas are not invented where 420RPC itself does not redeclare them; successful result shapes remain those of the compatible execution upstream. DOC-10.9 will fold all family renderers into final unified stale-output qualification.

## DOC-10.5 completed Indexer/API reference

DOC-10.5 adds `docs/reference/generated/indexer-api.md` and `scripts/reference_indexer_renderer.py`. The renderer binds to `api-contract.ts`, `api-surface.ts`, `http-transport.ts`, `query-layer.ts` and `operational-api.ts` so the generated page comes from the stable implementation boundary rather than prose.

The generated page covers all 15 public GET routes, chain/global scope, path/query parameters, v1 success/error envelopes, `400 invalid_request`, `404 not_found`, `405 method_not_allowed`, generic `500 internal_error`, and the special readiness behavior where an unready service returns HTTP `503` with the normal readiness data envelope. Paging is recorded as opaque base64url keyset cursors with default `50`, maximum `200`, `asc|desc`, and `{ items, nextCursor }` responses. Readiness/status documentation preserves the implementation's `authoritative: false` boundary and makes clear that Indexer data remains derived and must be canonically rechecked for security-sensitive decisions.

## DOC-10.6 completed SDK/CLI reference

DOC-10.6 adds `docs/reference/generated/sdk-cli.md` and `scripts/reference_sdk_cli_renderer.py`. The renderer consumes the `@420/sdk` package metadata and `index.ts`/`wallet.ts` exports plus the primary `@420/cli` package and `420.mjs` help/dispatch contract.

The generated reference lists the SDK's exported network discovery, contract catalogue, RPC, Wallet, Smart Account and session adapter types/classes/functions. It records the SDK's fail-closed chain/catalogue identity checks, RPC endpoint membership rule, canonical Smart Account factory/capability registry requirements and Wallet-chain validation. The CLI reference is derived from the fixed help contract and covers network/service/contract/RPC, devnet/scaffolding, Faucet/test accounts, deployment/verification, Indexer/debug, integration guides and AppStore publishing-plan commands. Local example manifest/catalogue defaults are explicitly identified as local only. Neither the SDK nor the primary CLI accepts raw private keys, seed phrases or mnemonics; user authorization remains with the qualified Wallet/external signer boundary.

## Phase exit condition

DOC-10 is complete when a developer can navigate from DOC-8/DOC-9 task documentation into machine-derived exact reference for verified contracts/ABIs/NatSpec, events/errors, public RPC, stable service APIs, SDK/CLI, environment identity and approved deployments; every generated page is reproducible from identified sources, environment-scoped where applicable, marked generated, and fails closed on missing/ambiguous/unverified inputs.
