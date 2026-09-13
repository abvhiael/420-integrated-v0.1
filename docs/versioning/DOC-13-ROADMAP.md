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

### DOC-13.2 — Version metadata schema — COMPLETE

- [x] Define normalized version/environment front-matter fields and accepted vocabulary.
- [x] Define compatibility with the existing `version: current` corpus.
- [x] Define release identifiers, aliases and immutable historical labels.
- [x] Add deterministic validation without forcing an unsafe bulk rewrite of legacy pages.

### DOC-13.3 — Version registry and release manifests — COMPLETE

- [x] Add a canonical documentation version registry.
- [x] Represent development, Genesis, testnet and mainnet publication tracks explicitly.
- [x] Bind each published track to repository/release evidence where available.
- [x] Fail closed when a requested release/environment lacks approved evidence.

### DOC-13.4 — URL and renderer version model — COMPLETE

- [x] Define stable URL structure for current and historical documentation.
- [x] Add renderer support for version/environment resolution.
- [x] Preserve existing flat deep links as explicit compatibility surfaces pending DOC-13.8 migration rules.
- [x] Prevent historical/versioned routes from silently resolving to current incompatible content.
- [x] Publish deterministic renderer context during the GitHub Pages build.

### DOC-13.5 — Navigation and version selector — COMPLETE

- [x] Add visible current-version/environment context to rendered 420Docs.
- [x] Add registry-backed version-switch navigation only where a corresponding page inventory proves the target exists.
- [x] Disable unavailable same-page targets instead of manufacturing dead links or falling through to another context.
- [x] Keep existing audience navigation intact while injecting version context after the strict MkDocs build.

Deliverables:

- `docs/versioning/navigation-selector-contract.md`
- `scripts/inject-doc-version-selector.py`
- context-scoped page inventories emitted by `scripts/render-doc-version-context.py`
- Pages and unified CI pipeline order: strict build → version context → selector injection → search/navigation qualification
- exact-head qualification evidence: 420Docs Qualification #722 and 420 Integrated Qualification #2823 passed on `8a42138216a554038c7dc1a4e7843faf4814c4d6`

### DOC-13.6 — Historical retention and archival policy — COMPLETE

- [x] Define when documentation is snapshotted versus updated in place.
- [x] Define immutable historical releases and supported-current aliases.
- [x] Define archival/deprecation banner semantics and unsupported-version behavior.
- [x] Preserve troubleshooting/error identifiers and canonical historical references.
- [x] Add deterministic retention validation to the unified documentation gate.

Deliverables:

- `docs/versioning/historical-retention-contract.md`
- `docs/versioning/historical-retention-policy.json`
- `scripts/validate-doc-historical-retention.py`
- immutable released documentation is retained by release-qualified identity rather than rewritten in place
- moving a track-local `current` alias cannot destroy or reinterpret the previous immutable snapshot
- historical/deprecated releases must remain immutable and explicitly published by release ID while retained
- unsupported historical routes use retained immutable content or an explicit tombstone, never silent fallback to current
- historical/deprecated notice text is renderer metadata and does not mutate the underlying snapshot
- stable `TRB-<DOMAIN>-<NNN>` troubleshooting identifiers remain historically attributable and cannot be silently reassigned
- `historical-retention` added to the unified 420Docs qualification runner and workflow contract

### DOC-13.7 — Generated reference version coupling — COMPLETE

- [x] Bind generated DOC-10 outputs to the version/environment that produced them.
- [x] Prevent generated local/example/dev data from appearing as canonical testnet/mainnet reference.
- [x] Define regeneration rules for mutable development versus immutable release snapshots.
- [x] Require source/provenance hashes for historical generated-reference snapshots.
- [x] Fail closed when an immutable release has no approved generated-reference snapshot.

Deliverables:

- `docs/versioning/generated-reference-version-contract.md`
- `docs/versioning/generated-reference-version-policy.json`
- `scripts/validate-doc-generated-reference-version.py`
- development release manifest explicitly binds the checked-in DOC-10 outputs as `live` development-scoped reference
- Genesis release manifest explicitly marks generated reference `unavailable` until a release-owned frozen snapshot with hashes exists
- `snapshot` mode requires an immutable release, release-owned snapshot root, provenance manifest, exact governed output coverage and SHA-256 matches
- live generated reference is forbidden outside the `development/development` release/environment pair
- network/deployment authority remains false for the current live generated reference
- `generated-reference-version` added to the unified 420Docs qualification runner
- implementation qualification evidence: 420Docs Qualification #736 passed on `66e1d13502b2d86a5287224b44612aeb071cf630`

### DOC-13.8 — Redirects, migration and compatibility — COMPLETE

- [x] Define compatibility behavior for pre-versioned documentation URLs.
- [x] Define page move/rename rules without rewriting immutable historical snapshots.
- [x] Preserve stable troubleshooting/deep-link anchors where their meaning remains equivalent.
- [x] Define explicit retired-route behavior when automatic migration would be misleading.
- [x] Add deterministic migration-policy validation to the unified documentation gate.

Deliverables:

- `docs/versioning/redirect-migration-contract.md`
- `docs/versioning/migration-policy.json`
- `scripts/validate-doc-migration-policy.py`
- legacy flat routes remain `compatibility-only`; they do not acquire Genesis, testnet or mainnet authority
- automatic fallback to `current`, cross-environment mapping and cross-release mapping are disabled
- migration rules must be explicit; current policy intentionally contains zero automatic mappings
- stable anchors and `TRB-<DOMAIN>-<NNN>` identifiers retain semantic identity across compatible moves
- routes without a safe equivalent remain unresolved or explicitly retired instead of being guessed
- `migration-policy` added to the unified 420Docs qualification runner and workflow contract
- implementation qualification evidence: 420Docs Qualification #744 passed on `b4612a6dc827fe59f6aedddf2f01a63a84ad2629`

### DOC-13.9 — Versioning CI and publication safety

- Validate registry/manifests, version metadata and environment compatibility.
- Validate versioned navigation and cross-version links.
- Validate renderer configuration and current aliases.
- Prevent unpublished/unknown version tracks from being advertised as authoritative.
- Integrate versioning checks into the DOC-12 unified documentation gate.
- Audit path triggers so every DOC-13 validator and policy/source surface independently triggers documentation qualification.

### DOC-13.10 — Coverage audit and closeout

- Audit development, Genesis, testnet and mainnet version semantics across the current corpus.
- Verify current/historical/generated-reference behavior and renderer navigation.
- Record deliberate compatibility exceptions and unsupported historical states.
- Reconcile with current `main`, run exact-head 420Docs Qualification and exact-head 420 Integrated Qualification, then merge once.

## Exit condition

420Docs can identify which release and environment a page describes, expose current and historical documentation without cross-environment authority leakage, preserve stable historical references, version generated machine reference with its provenance, and fail closed when a requested documentation track has not been approved or published. Developers and users can tell whether they are reading development, Genesis, testnet or mainnet documentation from the rendered page and URL/navigation context.
