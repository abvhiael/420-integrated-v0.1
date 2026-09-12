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

### DOC-13.1 — Versioning model and authority contract

- Define documentation dimensions: lifecycle/release version, environment and publication status.
- Define authoritative meanings for `development`, `genesis`, `testnet` and `mainnet` documentation.
- Define which metadata fields are machine-governed and which remain descriptive.
- Define current-versus-historical authority rules and fail-closed behavior for unknown versions.
- Define the DOC-13 relationship to generated DOC-10 reference and DOC-12 CI.

### DOC-13.2 — Version metadata schema

- Define normalized version/environment front-matter fields and accepted vocabulary.
- Define compatibility with the existing `version: current` corpus.
- Define release identifiers, aliases and immutable historical labels.
- Add deterministic validation without forcing an unsafe bulk rewrite of legacy pages.

### DOC-13.3 — Version registry and release manifests

- Add a canonical documentation version registry.
- Represent development, Genesis, testnet and mainnet publication tracks explicitly.
- Bind each published track to repository/release evidence where available.
- Fail closed when a requested release/environment lacks approved evidence.

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