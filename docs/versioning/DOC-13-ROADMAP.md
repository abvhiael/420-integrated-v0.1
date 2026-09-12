---
title: DOC-13 documentation versioning roadmap
audience:
  - developer
  - operator
category: contributing
status: active
version: current
---

# DOC-13 — Documentation Versioning

DOC-13 establishes how 420Docs represents, publishes, retains and navigates documentation across development, Genesis, testnet and mainnet contexts without allowing one environment or historical release to masquerade as another.

## Phase policy

DOC-13 is monolithic. DOC-13.1 through DOC-13.10 remain on one branch and one pull request. Individual substeps are not merged separately. The phase merges once after DOC-13.10 closeout, reconciliation with current `main`, exact-head 420Docs Qualification and exact-head 420 Integrated Qualification are green.

Branch: `docs/doc-13-versioning`

## Roadmap

### DOC-13.1 — Versioning model and authority contract — COMPLETE

- [x] Define documentation dimensions: lifecycle/release version, environment and publication status.
- [x] Define authoritative meanings for `development`, `genesis`, `testnet` and `mainnet` documentation.
- [x] Define which metadata fields are machine-governed and which remain descriptive.
- [x] Define current-versus-historical authority rules and fail-closed behavior for unknown versions.
- [x] Define the DOC-13 relationship to generated DOC-10 reference and DOC-12 CI.

Deliverables:

- `docs/versioning/version-authority-contract.md`
- explicit separation of release/lifecycle identity, environment and publication status
- `current` defined as a mutable resolver alias rather than an immutable historical version
- fail-closed rules for unknown/unpublished versions and missing environment/deployment evidence
- explicit rule that `genesis`, `testnet` and `mainnet` labels do not create canonical network/deployment authority by themselves
- DOC-10 generated-reference and DOC-12 CI ownership preserved, with DOC-13 adding version/environment identity rather than replacing either system

### DOC-13.2 — Version metadata schema — COMPLETE

- [x] Define normalized version/environment front-matter fields and accepted vocabulary.
- [x] Define compatibility with the existing `version: current` corpus.
- [x] Define release identifiers, aliases and immutable historical labels.
- [x] Add deterministic validation without forcing an unsafe bulk rewrite of legacy pages.

Deliverables:

- `docs/versioning/version-metadata-schema.md` — normalized DOC-13 metadata contract and migration rules
- `docs/versioning/version-metadata-policy.json` — machine vocabulary, aliases, release syntax and compatibility constraints
- `scripts/validate-doc-version-metadata.py` — deterministic complete-tuple and environment/release compatibility validation
- atomic governed tuple: `doc_release`, `doc_environment`, `publication_status`
- compatibility rule preserving existing `version: current` pages without inferring environment or immutable release authority
- historical/deprecated pages prohibited from using mutable aliases such as `current`/`development`
- `docs/versioning` added to governed front-matter roots
- `version-metadata` added to the unified DOC-12 qualification runner and protected by the workflow contract/path triggers

### DOC-13.3 — Version registry and release manifests — COMPLETE

- [x] Add a canonical documentation version registry.
- [x] Represent development, Genesis, testnet and mainnet publication tracks explicitly.
- [x] Bind each published track to repository/release evidence where available.
- [x] Fail closed when a requested release/environment lacks approved evidence.
- [x] Wire registry/manifests into the unified documentation qualification gate.

Deliverables:

- `docs/versioning/version-registry.json` — canonical track/current/published/alias/release routing registry
- `docs/versioning/releases/development.json` — mutable repository-head documentation manifest
- `docs/versioning/releases/genesis.json` — immutable frozen Genesis documentation manifest without live-network/deployment authority claims
- `docs/versioning/version-registry-contract.md` — registry, manifest, alias and fail-closed semantics
- `scripts/validate-doc-version-registry.py` — deterministic track/release/manifest/evidence/alias validation
- `version-registry` stage in `scripts/qualify-documentation.py`, protected by workflow contract/path triggers
- current publication state: development and Genesis published; testnet and mainnet intentionally unavailable until approved evidence exists
- qualification evidence: exact-head 420Docs Qualification #700 passed with the registry validator enabled

### DOC-13.4 — URL and renderer version model

- Define stable URL structure for current and historical documentation.
- Add renderer support for version/environment selection.
- Preserve stable deep links where practical.
- Prevent historical pages from silently resolving to current incompatible content.

### DOC-13.5 — Navigation and version selector

- Add visible current-version/environment context to 420Docs.
- Add version-switch navigation where a corresponding page exists.
- Define behavior when a page did not exist in another version.
- Keep audience navigation intact within each selected documentation context.

### DOC-13.6 — Historical retention and archival policy

- Define when documentation is snapshotted versus updated in place.
- Define immutable historical releases and supported-current aliases.
- Define archival/deprecation banners and unsupported-version semantics.
- Preserve troubleshooting/error identifiers and canonical historical references.

### DOC-13.7 — Generated reference version coupling

- Bind generated DOC-10 outputs to the version/environment that produced them.
- Prevent generated local/example/dev data from appearing as canonical testnet/mainnet reference.
- Define regeneration rules for release snapshots.
- Preserve source/provenance hashes for historical generated reference.

### DOC-13.8 — Redirects, migration and compatibility

- Define redirects from pre-versioned documentation URLs.
- Define page move/rename rules across versions.
- Preserve stable troubleshooting/deep-link anchors where compatible.
- Add explicit tombstone/deprecation behavior when redirecting would be misleading.

### DOC-13.9 — Versioning CI and publication safety

- Validate registry/manifests, version metadata and environment compatibility.
- Validate versioned navigation and cross-version links.
- Validate renderer configuration and current aliases.
- Prevent unpublished/unknown version tracks from being advertised as authoritative.
- Integrate versioning checks into the DOC-12 unified documentation gate.

### DOC-13.10 — Coverage audit and closeout

- Audit development, Genesis, testnet and mainnet version semantics across the current corpus.
- Verify current/historical/generated-reference behavior and renderer navigation.
- Record deliberate compatibility exceptions and unsupported historical states.
- Reconcile with current `main`, run exact-head 420Docs Qualification and exact-head 420 Integrated Qualification, then merge once.

## Exit condition

420Docs can identify which release and environment a page describes, expose current and historical documentation without cross-environment authority leakage, preserve stable historical references, version generated machine reference with its provenance, and fail closed when a requested documentation track has not been approved or published. Developers and users can tell whether they are reading development, Genesis, testnet or mainnet documentation from the rendered page and URL/navigation context.
