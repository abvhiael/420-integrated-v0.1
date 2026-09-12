# DOC-10 — Generated Reference Documentation Roadmap

DOC-10 builds reproducible machine-derived technical reference for 420 Integrated. It is a monolithic phase: DOC-10.1 through DOC-10.10 stay on one branch and PR, then merge once after reconciliation and exact-head qualification.

## Status

- [x] **DOC-10.1 — Generation foundation and source inventory** — establish generated-reference authority rules, source registry, deterministic output layout, generator schema, `generate`/`--check` entry point and initial source manifest.
- [x] **DOC-10.2 — Contract, NatSpec and ABI reference** — generate catalogue/source contract reference, extract contract-level NatSpec and public/external source surfaces, expose ABI provenance/availability, and fail closed rather than publish example-grade or unverifiable ABI evidence.
- [ ] **DOC-10.3 — Events and custom errors** — derive per-contract/global event and custom-error indexes, full signatures, indexed fields and topics/selectors where derivable.
- [ ] **DOC-10.4 — RPC reference** — derive supported public execution JSON-RPC/420RPC-facing methods, parameters/results and public/private classifications without exposing Engine/admin/signer surfaces.
- [ ] **DOC-10.5 — 420Indexer and service API reference** — derive stable routes, query/path parameters, envelopes, pagination/cursors, status/readiness and error surfaces from API source contracts.
- [ ] **DOC-10.6 — SDK and CLI reference** — derive exported SDK types/functions plus stable CLI commands/options/examples from canonical source definitions.
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

## Phase exit condition

DOC-10 is complete when a developer can navigate from DOC-8/DOC-9 task documentation into machine-derived exact reference for verified contracts/ABIs/NatSpec, events/errors, public RPC, stable service APIs, SDK/CLI, environment identity and approved deployments; every generated page is reproducible from identified sources, environment-scoped where applicable, marked generated, and fails closed on missing/ambiguous/unverified inputs.
